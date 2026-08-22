# Full-width dashboard update

This version changes only the application layout CSS.

## What changed

- Removed the 1180px maximum width from `.dashboard-shell`.
- Dashboard now uses the full browser width.
- Added responsive horizontal padding using `clamp()` on desktop.
- Reduced horizontal padding on small screens.
- Explicitly set `html`, `body`, and `#root` to full width.

No database, API, authentication, finance, reports, alerts, or transaction logic was changed.
