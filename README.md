# ESO Management System — v5.5.1

Patch release based on v5.5.

Changes:
- Mobile quick navigation automatically hides while the left hamburger/sidebar menu is open, so Log out, Notifications, and Change password remain accessible.
- ESO Details photos are displayed side-by-side on mobile: Reported Photo and Completion / After Photo.
- Mobile attachment cards use equal widths, contained image sizing, and compact full-image buttons.

## V5.6 — Multi-company architecture

V5.6 introduces tenant/company isolation. **Before deploying this release**, run `supabase/v5_6_multi_company_migration.sql` once in the Supabase SQL Editor.

The migration:
- creates `companies`;
- preserves all existing data under `Default Company` (`DEFAULT`);
- adds `company_id` ownership to all business tables;
- changes Employee ID and Department Name uniqueness to per-company uniqueness;
- adds tenant-aware login (`verify_eso_login_tenant`);
- adds indexes and an integrity-review view.

The application API now scopes company data by the authenticated user's `company_id`, including users, departments, locations, ESO reports, tasks, notifications, analytics and exports. New records inherit the current user's company automatically. Storage object paths are also company-prefixed for new report/completion images.

### Login behavior
A Company Code field is now available. It can remain blank while an Employee ID is globally unique. Once two companies use the same Employee ID, Company Code is required to disambiguate the login. This allows the first/current company to migrate without forcing every employee to change their login flow immediately.

### Creating another company
V5.6 establishes the secure data architecture but intentionally does not yet expose a platform-owner tenant provisioning screen inside a customer's Admin UI. New tenant provisioning should be a platform-level operation, separate from company Admin/Super Admin permissions. This separation is important for SaaS security.
