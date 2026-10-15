# 轻卡 · 私人饮食记录
Next.js + Supabase Auth (Google) + Supabase PostgreSQL + 私有照片存储。

## 部署
1. 在 [Supabase](https://supabase.com/dashboard) 创建项目，SQL Editor 执行 `supabase/schema.sql`。
2. Supabase Authentication > Providers > Google：设置 Google OAuth Client ID / Client Secret。注意：Google Cloud 的 Authorized redirect URI 填 Supabase 提供的 `https://<project-ref>.supabase.co/auth/v1/callback`，不是 Vercel 首页。
3. Supabase Authentication > URL Configuration：Site URL 设置最终 Vercel 域名，Redirect URLs 加上 `https://<your-site>.vercel.app/**`。
4. Vercel 导入本 GitHub 仓库，设置 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` 两个环境变量；构建部署。
5. Google 登录后，可手动录入 2026-10-15 早餐 250 kcal 和午餐约 590 kcal，午餐前后照片从本地上传。

## 重要
不应把 Google Client Secret、Supabase service_role key 提交到 GitHub。仅 Supabase anon/publishable key 用于浏览器。数据与图片通过 RLS 按 auth.uid 隔离；新站不会擅自公开用户照片。

## 用户要求
每日目标严格小于 1800 kcal；身高 172cm，体重初始 69kg。查询每日热量、照片与体重。