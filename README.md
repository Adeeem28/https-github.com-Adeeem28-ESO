# ESO Management System — v5.6.1

Multi-plant architecture release based on v5.6.

## Architecture

The application now uses the hierarchy:

**Company → Plant → Department → Employee → ESO → Corrective Action**

The current company can contain multiple plants while keeping operational data separated by plant.

### Access model
- Employee, Maintenance, Supervisor, Admin and Management are scoped to their assigned plant.
- Super Admin is company-wide and can see all plants, create/manage plants, and view corporate plant metrics.
- Plant-scoped users cannot assign tasks to or browse employees, departments, locations or ESO records from another plant.

### Current data migration
All existing data is preserved and assigned to the initial plant:

- Plant: **Cazin**
- Plant code: **CAZIN**

For the connected production Supabase project this migration has already been applied. Do not run it again there. The SQL file is included for source control and fresh installations.

## New in v5.6.1
- `plants` table and plant ownership across operational tables.
- Plant-aware login with optional Plant Code.
- Super Admin **Plants** administration page.
- Super Admin can create, edit, activate and deactivate plants.
- Super Admin can select a plant when creating/editing employees, departments and locations.
- Admin is restricted to their own plant.
- ESO reporting, corrective actions, notifications, dashboards, monthly analytics and exports are plant-scoped for non-Super Admin roles.
- Super Admin receives a **Corporate Plant Overview** with plant-level metrics.
- Employee import template supports Plant Code.
- Data exports include Plant / Plant Code and an XLSX Plant Summary sheet.
- Maintenance/Supervisor assignment is restricted to the ESO's plant.

## Login
Company and Plant Code can remain blank while an Employee ID uniquely identifies one active user. If Employee IDs overlap, use the codes to disambiguate the account.

Current initial values are:
- Company Code: `DEFAULT`
- Plant Code: `CAZIN`

## Adding another plant
A company Super Admin can open **Plants**, create e.g. `Madrid / MADRID`, and then create/import Madrid employees, departments and locations under that plant. Cazin users remain isolated from Madrid data, while Super Admin can view both.

## Supabase migration
Fresh installations should run:

`supabase/v5_6_1_multi_plant_migration.sql`

The migration is additive/backfilling and preserves existing data by assigning it to the first plant.

## Deploy
Upload/commit the project to GitHub `main` and allow Vercel to deploy. For the current connected ESO Supabase project, the required v5.6 and v5.6.1 database migrations have already been applied.

## V5.7 Platform Owner / Multi-Corporation SaaS
- New Platform Owner Console: `/owner`
- First platform owner is bootstrapped from Employee ID `10375305` and uses the same existing password.
- Platform Owner can create a new corporation, Company Code, first Plant and first Company Super Admin in one onboarding workflow.
- Company-specific login URLs use `/c/COMPANYCODE` so Employee IDs may safely overlap between different corporations while the employee login screen stays simple.
- Company Super Admin remains cross-plant only inside their own corporation; Plant Admin and other roles remain plant-scoped.
- Platform Owner can edit plan/subscription state and activate/deactivate corporations.
- Supabase migrations required for V5.7 are included in `supabase/v5_7_platform_owner_migration.sql` and have already been applied to the current ESO Supabase project used during development.
