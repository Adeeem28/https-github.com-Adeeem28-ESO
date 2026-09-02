# ESO Management System — StackBlitz Release

Production-connected Next.js + TypeScript release for the ESO Supabase project.

## Required environment variables
Copy `.env.example` to `.env.local` in local development, or add the variables as StackBlitz Secrets / Vercel Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (server only; never NEXT_PUBLIC)
- `APP_SESSION_SECRET` (server only; 32+ random characters)

## Run
```bash
npm install
npm run dev
```

## Demo accounts seeded in Supabase
- Employee: `10001` (no password)
- Maintenance: `20001` / `maint123`
- Admin: `90001` / `admin123`
- Super Admin: `99999` / `super123`

Change/remove demo credentials before company-wide production rollout.

## Responsive modes
- 0–650 px: mobile, no persistent sidebar
- 651–1300 px: tablet, no persistent sidebar
- 1301–1650 px: laptop, sidebar
- 1651+ px: desktop, sidebar
