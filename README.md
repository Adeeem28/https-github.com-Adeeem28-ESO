# ESO Management System v4.1

This release adds Admin/Super Admin Department Management (add, edit, code, activate/deactivate) and a dedicated mobile UI pass for 0–650 px screens.

# ESO Management System — v4

Next.js + TypeScript web application for Environmental & Safety Opportunities (ESO), designed for StackBlitz → GitHub → Vercel with Supabase as the shared backend.

## Roles
- Employee — Employee ID login, Report ESO, own history and annual target.
- Maintenance — ID + password, Report ESO, own history, assigned My Tasks, corrective action and completion photo.
- Supervisor — ID + password, same task workflow as Maintenance.
- Management — ID + password, company dashboard, all ESO reports, notifications and data/report exports. No user administration.
- Admin — Management access plus user management, location management and task assignment.
- Super Admin — full Admin access, including Super Admin account management.

## v4 additions
- Maintenance/Supervisor session routing fix.
- New Management role.
- In-app notifications with unread badge, mark-read behavior and direct ESO opening.
- Admin/Super Admin location management: add, edit, activate/deactivate.
- Bulk employee import from Excel with downloadable template and validation results.
- Excel management report export with ESO Data, Summary, Department Summary and Employee Performance sheets.
- Raw CSV and JSON exports for Power BI, integrations and other downstream uses.
- Active/inactive user handling: Delete User disables login and removes the user from normal active lists while retaining historical ESO references.
- Employee role changes include Employee, Maintenance, Supervisor, Management, Admin and Super Admin (subject to permissions).
- All non-Employee roles retain Change Password.
- Camera and Gallery remain separate upload choices both on new ESO reports and task completion.

## Required environment variables
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
APP_SESSION_SECRET=use-a-long-random-secret
```
Set them in Vercel for Production and Preview.

## StackBlitz / local
```bash
npm install
npm run dev
```

## Vercel
Push this release to the GitHub `main` branch. Vercel should automatically create a new Production deployment.

## Supabase
The live ESO Supabase project has already received the v4 notifications-table migration and the Management role constraint was applied previously. `supabase/v4_migration.sql` is included as a reference for another environment.

## v5.1 UI / PWA update
- Approved navy/orange ESO safety brand and app icon
- Real PWA service worker registration for installable app behavior
- Four primary KPI cards with visual status icons
- Critical Open + Employee With Most ESO YTD in a 50/50 highlight row
- Employee dashboard also shows Employee With Most ESO YTD
- Mobile dashboard keeps the two highlight cards side-by-side at 100% browser zoom
- Department Performance returns to full-width for better readability
