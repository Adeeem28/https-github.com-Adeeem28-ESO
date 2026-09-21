# ESO V5.9.2 Hotfix
- Urgency select now uses stable canonical option values. UI translation no longer changes the value submitted to the API.
- Reports API normalizes supported BS/DE/ES translated urgency labels as a defensive fallback and rejects unknown values before database insert.
- Mobile navigation drawer is fixed to the viewport.
- While the drawer is open, body scroll is locked and the original scroll position is restored when it closes.
- Only the drawer can scroll when its content exceeds the viewport.
- No database migration is required.
