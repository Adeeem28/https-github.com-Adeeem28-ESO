# ESO V5.9.1 deployment

## Required Vercel environment variables
Set these in Project Settings -> Environment Variables (Production), then redeploy:
- NEXT_PUBLIC_VAPID_PUBLIC_KEY
- VAPID_PRIVATE_KEY
- VAPID_SUBJECT (for example mailto:admin@company.com)
- CRON_SECRET

Existing Supabase/app environment variables remain unchanged.

## Push activation per device
After login, open the side menu and press **Enable push notifications** once on each device/browser. The browser/OS permission must be accepted. On iPhone/iPad, install the ESO PWA to the Home Screen and enable notifications from the installed PWA.

## Reminder schedule
`vercel.json` requests `/api/cron/reminders` every 15 minutes. Vercel plan limits apply. If the project is on a plan that only permits daily Cron execution, use Vercel Pro or move this schedule to Supabase Cron/Edge Functions before relying on time-sensitive escalation.

## V5.9.1 behavior
- Assignment -> push to assignee.
- Due within 24h -> reminder to assignee (one per task).
- Overdue -> push to assignee.
- 24h overdue -> Supervisor/Admin escalation.
- 48h overdue -> Management/Company Super Admin escalation.
- Critical ESO -> Admin/Management/Super Admin push.
- Completed corrective action -> original ESO reporter push + oversight notification.
- Photo capture is resized/compressed on-device and the API now fails explicitly instead of silently losing the photo.
- Mobile sidebar is fixed to the viewport; background scrolling is locked while it is open.
