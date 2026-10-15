'use client';
import {useEffect,useMemo,useState} from 'react';
import {createClient, type SupabaseClient, type User} from '@supabase/supabase-js';
type Entry={id:string,user_id:string,entry_date:string,meal:string,calories:number,note:string|null,photo_paths:string[]|null,created_at:string};
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'';const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';
const supa:SupabaseClient|null=url&&anon?createClient(url,anon,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
export default function Home(){
const [user,setUser]=useState<User|null>(null),[loaded,setLoaded]=useState(false),[rows,setRows]=useState<Entry[]>([]),[photos,setPhotos]=useState<Record<string,string>>({}),[filter,setFilter]=useState(today()),[mealFilter,setMealFilter]=useState(''),[date,setDate]=useState(today()),[meal,setMeal]=useState('早餐'),[cal,setCal]=useState(''),[note,setNote]=useState(''),[images,setImages]=useState<File[]>([]),[weight,setWeight]=useState('69'),[weightDate,setWeightDate]=useState(today()),[weights,setWeights]=useState<{entry_date:string,weight_kg:number}[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
useEffect(()=>{if(!supa){setLoaded(true);return}const s=supa;s.auth.getUser().then(({data})=>{setUser(data.user);setLoaded(true)});const {data:{subscription}}=s.auth.onAuthStateChange((_e,session)=>setUser(session?.user||null));return()=>subscription.unsubscribe()},[]);
async function refresh(){if(!supa||!user)return;const [r,w]=await Promise.all([supa.from('food_entries').select('*').eq('user_id',user.id).order('entry_date',{ascending:false}).order('created_at',{ascending:false}),supa.from('weight_entries').select('entry_date,weight_kg').eq('user_id',user.id).order('entry_date',{ascending:false})]);if(r.error)setError(r.error.message);else setRows(r.data||[]);if(!w.error)setWeights(w.data||[])}
useEffect(()=>{refresh()},[user?.id]);
useEffect(()=>{if(!supa)return;const paths=[...new Set(rows.flatMap(r=>r.photo_paths||[]))].filter(p=>!photos[p]);if(!paths.length)return;const s=supa;s.storage.from('meal-photos').createSignedUrls(paths,3600).then(({data})=>{if(data)setPhotos(old=>({...old,...Object.fromEntries(data.filter(x=>x.signedUrl).map(x=>[x.path!,x.signedUrl!]))}))})},[rows]);
const display=rows.filter(r=>(!filter||r.entry_date===filter)&&(!mealFilter||r.meal===mealFilter));
const total=rows.filter(r=>r.entry_date===today()).reduce((a,r)=>a+Number(r.calories),0);
const grouped=useMemo(()=>Object.entries(rows.reduce((a,r)=>{a[r.entry_date]=(a[r.entry_date]||0)+Number(r.calories);return a},{} as Record<string,number>)).sort(([a],[b])=>b.localeCompare(a)),[rows]);
async function add(e:React.FormEvent){e.preventDefault();if(!supa||!user)return;setBusy(true);setError('');let paths:string[]=[];try{for(const file of images){if(!file.type.startsWith('image/'))throw Error('只能上传图片');if(file.size>8*1024*1024)throw Error('单张图片不能超过 8 MB');const ext=file.name.split('.').pop()?.replace(/[^a-z0-9]/gi,'').toLowerCase()||'jpg';const path=user.id+'/'+crypto.randomUUID()+'.'+ext;const {error}=await supa.storage.from('meal-photos').upload(path,file,{contentType:file.type});if(error)throw error;paths.push(path)}const {error}=await supa.from('food_entries').insert({user_id:user.id,entry_date:date,meal,calories:Number(cal),note,photo_paths:paths});if(error)throw error;setCal('');setNote('');setImages([]);const inp=document.getElementById('images') as HTMLInputElement;if(inp)inp.value='';await refresh()}catch(e){setError(String(e))}finally{setBusy(false)}}
async function uploadExistingPhoto(entryId:string, file:File|undefined){
 if(!file||!supa||!user)return;
 setBusy(true);setError('');
 try{
  const data=new FormData();
  data.append('entry_id',entryId);
  data.append('file',file);
  const result=await supa.functions.invoke('secure-meal-photo-upload',{body:data});
  if(result.error)throw result.error;
  if(!result.data?.ok)throw Error(result.data?.error||'上传失败');
  setPhotos({});await refresh();
  alert('照片已保存到 Supabase 私有存储');
 }catch(e){setError('照片上传失败：'+String(e))}
 finally{setBusy(false)}
}
async function remove(r:Entry){if(!supa||!confirm('删除这条饮食记录？'))return;const {error}=await supa.from('food_entries').delete().eq('id',r.id).eq('user_id',user!.id);if(error)setError(error.message);else {if(r.photo_paths?.length)await supa.storage.from('meal-photos').remove(r.photo_paths);refresh()}}
async function importExisting(){if(!supa||!user)return;setBusy(true);setError('');try{const items=[{meal:'早餐',calories:250,note:'用户提供热量：250 kcal'},{meal:'午餐',calories:590,note:'按餐前/餐后照片估算，约 480–720 kcal；原始照片待上传'}];const {data:existing,error:readError}=await supa.from('food_entries').select('meal,calories').eq('user_id',user.id).eq('entry_date','2026-10-15');if(readError)throw readError;const pending=items.filter(x=>!existing?.some(e=>e.meal===x.meal&&Number(e.calories)===x.calories));if(!pending.length){alert('2026-10-15 的早餐和午餐已经存在，无需重复导入');return;}const {error:insertError}=await supa.from('food_entries').insert(pending.map(x=>({...x,user_id:user.id,entry_date:'2026-10-15',photo_paths:[]})));if(insertError)throw insertError;await refresh();setFilter('2026-10-15');alert('已导入 '+pending.length+' 条饮食记录。午餐照片请之后补传。')}catch(e){setError(String(e))}finally{setBusy(false)}}
async function addWeight(e:React.FormEvent){e.preventDefault();if(!supa||!user)return;const {error}=await supa.from('weight_entries').upsert({user_id:user.id,entry_date:weightDate,weight_kg:Number(weight)},{onConflict:'user_id,entry_date'});if(error)setError(error.message);else refresh()}
const [mailboxCode,setMailboxCode]=useState(''),[syncBusy,setSyncBusy]=useState(false),[syncMessage,setSyncMessage]=useState('');
const bmi=Number(weight)/(1.72*1.72);

async function syncInbox(){
 if(!supa||!user||syncBusy)return;
 setSyncBusy(true);setSyncMessage('');
 try{
  const existing=await supa.from('chat_sync_mailboxes').select('inbox_code').eq('user_id',user.id).maybeSingle();
  if(existing.error)throw existing.error;
  let code:string=existing.data?.inbox_code;
  if(!code){
   const created=await supa.from('chat_sync_mailboxes').insert({user_id:user.id}).select('inbox_code').single();
   if(created.error){
    const retry=await supa.from('chat_sync_mailboxes').select('inbox_code').eq('user_id',user.id).single();
    if(retry.error)throw retry.error;
    code=retry.data.inbox_code;
   }else code=created.data.inbox_code;
  }
  setMailboxCode(code);
  const queue=await supa.from('chat_sync_inbox').select('*').eq('inbox_code',code).order('created_at',{ascending:true}).limit(30);
  if(queue.error)throw queue.error;
  let count=0;
  for(const item of queue.data||[]){
   const already=await supa.from('food_entries').select('id,photo_paths').eq('incoming_id',item.id).eq('user_id',user.id).maybeSingle();
   if(already.error)throw already.error;
   let target=already.data;
   if(!target && item.source_key?.startsWith('qingka-photo-attach-')){
     const match=await supa.from('food_entries').select('id,photo_paths').eq('user_id',user.id).eq('entry_date',item.entry_date).eq('meal',item.meal).eq('calories',item.calories).order('created_at',{ascending:true}).limit(1).maybeSingle();
     if(match.error)throw match.error;
     target=match.data;
   }
   if(!already.data){
    const paths:string[]=[];
    for(const dataUrl of (Array.isArray(item.photos)?item.photos:[])){
     if(typeof dataUrl!=='string')throw Error('照片内容格式不正确');
     const match=dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
     if(!match)throw Error('照片需要是 JPEG、PNG 或 WebP');
     const raw=atob(match[2]);
     if(raw.length>8*1024*1024)throw Error('照片超过 8MB');
     const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
     const ext=match[1].split('/')[1].replace('jpeg','jpg');
     const path=user.id+'/'+(target?.id||item.id)+'/'+crypto.randomUUID()+'.'+ext;
     const up=await supa.storage.from('meal-photos').upload(path,bytes,{contentType:match[1]});
     if(up.error)throw up.error;
     paths.push(path);
    }
    if(target){
     const updated=await supa.from('food_entries').update({photo_paths:[...(target.photo_paths||[]),...paths]}).eq('id',target.id).eq('user_id',user.id);
     if(updated.error)throw updated.error;
    }else{
     const saved=await supa.from('food_entries').insert({user_id:user.id,incoming_id:item.id,entry_date:item.entry_date,meal:item.meal,calories:item.calories,note:item.note,photo_paths:paths});
     if(saved.error && saved.error.code!=='23505')throw saved.error;
    }
   }
   const deleted=await supa.from('chat_sync_inbox').delete().eq('id',item.id);
   if(deleted.error)throw deleted.error;
   count++;
  }
  if(count){await refresh();setSyncMessage('已同步 '+count+' 条饮食记录及照片');}
 }catch(e){setSyncMessage('同步失败：'+String(e))}
 finally{setSyncBusy(false)}
}
useEffect(()=>{if(user?.id)void syncInbox()},[user?.id]);
useEffect(()=>{if(!user)return;const onFocus=()=>void syncInbox();window.addEventListener('focus',onFocus);return()=>window.removeEventListener('focus',onFocus)},[user?.id,syncBusy]);
if(!loaded)return <main>正在加载…</main>;
if(!supa)return <main className="card login"><h1>轻卡 · 配置待完成</h1><p>请在 Vercel 设置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY。</p></main>;
if(!user)return <main className="card login"><div className="logo">轻<em>卡</em></div><h1>你的私人饮食日记</h1><p className="muted">用 Google 账号安全登录，随时查看每天的热量、照片和体重。</p><button onClick={async()=>{const {error}=await supa.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin}});if(error)setError(error.message)}}>使用 Google 登录</button>{error&&<p className="error">{error}</p>}</main>;
return <main><header className="top"><div><div className="logo">轻<em>卡</em> · Food Journal</div><div className="muted">{user.email}</div></div><button className="ghost" onClick={()=>supa.auth.signOut()}>退出登录</button></header>
{!rows.some(r=>r.entry_date==='2026-10-15' && r.meal==='早餐' && Number(r.calories)===250)||!rows.some(r=>r.entry_date==='2026-10-15' && r.meal==='午餐' && Number(r.calories)===590)?<section className="card" style={{borderColor:'#a9dacc',background:'#effaf4'}}><div className="between"><div><strong>导入已有饮食数据</strong><p className="muted">2026-10-15 · 早餐 250 kcal，午餐约 590 kcal（合计 840 kcal）</p></div><button disabled={busy} onClick={importExisting}>{busy?'导入中…':'一键导入'}</button></div><p className="note">不会重复导入已存在的同餐次同热量记录；照片需要另外补传。</p></section>:null}
<section className="card" style={{borderColor:'#a9dacc',background:'#f0faf5',marginTop:18}}><div className="between"><div><strong>ChatGPT 饮食同步</strong><p className="muted">首次复制下面的绑定码并发给 ChatGPT。以后你只需发照片；网站再次打开或切回时，会自动将记录和照片从私人队列保存到云端。</p></div><button className="ghost" disabled={syncBusy} onClick={()=>void syncInbox()}>{syncBusy?'同步中…':'立即同步'}</button></div><div className="between" style={{flexWrap:'wrap',gap:10}}><code style={{fontSize:12,overflowWrap:'anywhere'}}>{mailboxCode||'正在生成…'}</code><button className="ghost" disabled={!mailboxCode} onClick={()=>navigator.clipboard.writeText(mailboxCode)}>复制绑定码</button></div><p className="note">{syncMessage||'只需提供此随机绑定码，不要提供 Google/Supabase 登录 Token。'}</p></section><section className="hero"><small>今日摄入 · {today()}</small><h1>你的健康，由每一餐积累</h1><big>{total}</big> <small>/ 1800 kcal</small><div className="bar"><div className="fill" style={{width:Math.min(total/1800*100,100)+'%'}}/></div><div className="three"><div><small>剩余预算</small><div><b>{Math.max(0,1800-total)} kcal</b></div></div><div><small>体重</small><div><b>{weights[0]?.weight_kg||69} kg</b></div></div><div><small>BMI</small><div><b>{((weights[0]?.weight_kg||69)/(1.72*1.72)).toFixed(1)}</b></div></div></div></section>
{error&&<p className="error">{error}</p>}<div className="columns"><div><section className="card"><h2>饮食记录</h2><div className="fields"><div><label>选择日期</label><input type="date" value={filter} onChange={e=>setFilter(e.target.value)}/></div><div><label>餐次筛选</label><select value={mealFilter} onChange={e=>setMealFilter(e.target.value)}><option value="">全部</option>{['早餐','午餐','晚餐','加餐'].map(x=><option key={x}>{x}</option>)}</select></div></div><p className="note"><button className="ghost" onClick={()=>setFilter('')}>查看所有日期</button></p>{display.length===0?<p className="muted">该日期暂无记录</p>:display.map(r=><div className="record" key={r.id}><div className="between"><div><strong>{r.meal}</strong><div className="muted">{r.entry_date} · {new Date(r.created_at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</div></div><div><b style={{color:'#07825f'}}>{r.calories} kcal</b> <button className="danger" onClick={()=>remove(r)}>删除</button></div></div><p className="muted">{r.note}</p><div style={{marginTop:10}}><label style={{display:'inline-block',cursor:'pointer',padding:'7px 11px',borderRadius:9,background:'#eef7f2',color:'#176c54'}}>给本条记录补传照片<input type="file" accept="image/jpeg,image/png,image/webp" style={{display:'none'}} disabled={busy} onChange={e=>{void uploadExistingPhoto(r.id,e.target.files?.[0]);e.currentTarget.value=''}}/></label></div>{r.photo_paths?.map(p=>photos[p]?<a href={photos[p]} target="_blank" rel="noreferrer" key={p}><img src={photos[p]} alt="饮食照片"/></a>:<span key={p} className="muted">照片加载中…</span>)}</div>)}</section><section className="card"><h2>每日热量查询汇总</h2>{grouped.map(([d,c])=><div className="summary" key={d}><button className="ghost" onClick={()=>{setFilter(d);setMealFilter('')}}>{d}</button><b style={{color:c>=1800?'#b44434':'#07825f'}}>{c} kcal</b></div>)}</section></div>
<div><section className="card"><h2>＋ 新增饮食记录</h2><form onSubmit={add}><label>日期</label><input type="date" required value={date} onChange={e=>setDate(e.target.value)}/><div className="fields"><div><label>餐次</label><select value={meal} onChange={e=>setMeal(e.target.value)}>{['早餐','午餐','晚餐','加餐'].map(x=><option key={x}>{x}</option>)}</select></div><div><label>大卡 kcal</label><input type="number" required min="0" value={cal} onChange={e=>setCal(e.target.value)}/></div></div><label>食物及估算备注</label><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="记录吃了什么、分量及热量估算依据"/><label>上传照片（支持多张）</label><input id="images" type="file" multiple accept="image/*" onChange={e=>setImages(Array.from(e.target.files||[]))}/><p className="note">单张不超过 8MB，照片仅本人可访问</p><button disabled={busy} type="submit">{busy?'保存中…':'保存记录'}</button></form></section><section className="card"><h2>体重记录</h2><form onSubmit={addWeight}><label>日期</label><input type="date" value={weightDate} onChange={e=>setWeightDate(e.target.value)}/><label>体重 kg</label><input type="number" min="15" max="500" step="0.1" value={weight} onChange={e=>setWeight(e.target.value)}/><p className="note">身高 172cm · 当前录入 BMI {bmi.toFixed(1)}</p><button type="submit">保存体重</button></form>{weights.slice(0,5).map(w=><div className="summary" key={w.entry_date}><span>{w.entry_date}</span><b>{w.weight_kg} kg</b></div>)}</section></div></div><p className="note">热量均为估算值。严格低于 1800 kcal，摄入应小于剩余额度；数据仅对本人登录账户可见。</p></main>
}