# ESO Management System — Release v3

Next.js + TypeScript + Supabase production release for Environmental & Safety Opportunities.

## v3 changes
- Separate **Take Photo** and **Choose from Gallery** actions when submitting ESO.
- Same camera/gallery options for **Completion / After Photo** when a corrective task is completed.
- Employee, Maintenance, Supervisor, Admin and Super Admin can all submit ESO reports.
- New **Supervisor** role.
- Admin / Super Admin can assign ESO corrective tasks to Maintenance or Supervisor users.
- Maintenance / Supervisor users get a **My Tasks** list showing work assigned to them and can start and complete their tasks.
- Completing a task supports corrective-action text plus an optional completion photo.
- Admin / Super Admin can also complete assigned tasks.
- ESO detail view shows the original reported photo and the completion/after photo.
- Admin / Super Admin can edit user name, department, role and annual ESO target, reset privileged-user passwords and safe-delete/deactivate users.
- Maintenance, Supervisor, Admin and Super Admin can change their own password from the sidebar.
- PWA manifest and install icons included.
- Compact mobile layout retained and further tightened.

## Vercel environment variables
Set these in Production and Preview:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
APP_SESSION_SECRET=a-long-random-secret-at-least-32-characters
```

Do not commit the Supabase secret key to GitHub.

## Deploy
1. Upload/replace the repository files with this release.
2. Commit to `main`.
3. Vercel should automatically deploy the new commit.
4. If automatic deployment is disabled, redeploy the latest `main` commit.

## Important user behavior
Employee accounts use Employee ID only. Maintenance, Supervisor, Admin and Super Admin use Employee ID + password.

Deleting a user in the UI is implemented as **safe deletion/deactivation**, preserving historical ESO reports and audit data.
