import { createClient } from "npm:@supabase/supabase-js@2";
const API = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
const j = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: {"content-type":"application/json","cache-control":"no-store"} });
Deno.serve(async req => {
 if(req.method !== "POST")return j({error:"method_not_allowed"},405);
 const authorization=req.headers.get("Authorization")||"";
 if(!authorization.startsWith("Bearer "))return j({error:"unauthorized"},401);
 const db=createClient(API,ANON,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user)return j({error:"unauthorized"},401);
 if(user.id!=="1db152f5-37b0-4430-8cd9-7078812bfdf7"||user.email?.toLowerCase()!=="cativenll@gmail.com"||!user.email_confirmed_at)return j({error:"forbidden"},403);
 let form:FormData;try{form=await req.formData()}catch{return j({error:"invalid_multipart"},400)}
 const entryId=form.get("entry_id");
 const file=form.get("file");
 const replacePath=form.get("replace_path");
 if(typeof entryId!=="string"||!/^[-a-f0-9]{36}$/i.test(entryId)||!(file instanceof File))return j({error:"invalid_input"},400);
 if(!allowed.has(file.type)||file.size<100||file.size>8*1024*1024)return j({error:"invalid_image"},400);
 const probe=new Uint8Array(await file.slice(0,16).arrayBuffer());
 const valid=file.type==="image/jpeg"?probe[0]===0xff&&probe[1]===0xd8&&probe[2]===0xff:
 file.type==="image/png"?probe[0]===137&&probe[1]===80&&probe[2]===78&&probe[3]===71:
 file.type==="image/webp"?String.fromCharCode(...probe.slice(0,4))==="RIFF"&&String.fromCharCode(...probe.slice(8,12))==="WEBP":false;
 if(!valid)return j({error:"invalid_image_signature"},400);
 const {data:entry,error:entryError}=await db.from("food_entries").select("id,photo_paths").eq("id",entryId).eq("user_id",user.id).single();
 if(entryError||!entry)return j({error:"entry_not_found"},404);
 const ext=file.type.split("/")[1].replace("jpeg","jpg");
 const path=user.id+"/"+entry.id+"/"+crypto.randomUUID()+"."+ext;
 const {error:uploadError}=await db.storage.from("meal-photos").upload(path,file,{contentType:file.type,upsert:false});
 if(uploadError)return j({error:"upload_failed",detail:uploadError.message},502);
 const replacing=typeof replacePath==="string" && replacePath.length>0;
 if(replacing && !(entry.photo_paths||[]).includes(replacePath)){await db.storage.from("meal-photos").remove([path]);return j({error:"invalid_replacement"},403)}
 const paths=[...(entry.photo_paths||[]).filter((p:string)=>p!==replacePath),path];
 const {error:saveError}=await db.from("food_entries").update({photo_paths:paths}).eq("id",entry.id).eq("user_id",user.id);
 if(saveError){await db.storage.from("meal-photos").remove([path]);return j({error:"db_write_failed",detail:saveError.message},500)}
 if(replacing)await db.storage.from("meal-photos").remove([replacePath as string]);
 return j({ok:true,entry_id:entry.id,photo_path:path});
});