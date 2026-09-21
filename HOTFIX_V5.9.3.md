# ESO V5.9.3 Hotfix

## Vercel Hobby deployment fix
- Removed the 15-minute Vercel Cron schedule from `vercel.json`.
- `/api/cron/reminders` remains available and protected by `CRON_SECRET`.
- Automatic reminders/escalations are intended to be triggered by Supabase Cron every 15 minutes.
- Existing V5.9.2 urgency normalization and mobile sidebar fixes are retained.

## Supabase Cron setup
After production deploy, create an HTTP cron job in Supabase that calls:
`https://YOUR-PRODUCTION-DOMAIN/api/cron/reminders`
every 15 minutes with header:
`Authorization: Bearer <the same CRON_SECRET stored in Vercel>`

Do not commit the secret to GitHub.
