# Universal Mobile Responsive Update

This update changes layout only. Financial calculations, API routes, authentication, database tables, transactions, budgets, goals, recurring cash flow, reports, analytics, and alerts are unchanged.

## What changed

- Full-width layout remains enabled on desktop.
- Added `100dvh` / `100svh` support for changing mobile browser bars.
- Added safe-area padding for iPhone notches and home indicators.
- Prevented page-level horizontal overflow.
- Made the top navigation horizontally touch-scrollable on narrow screens.
- Stacked dashboard cards and data grids at appropriate phone widths.
- Made forms, filters, action groups, and modal dialogs adapt to small screens.
- Added 44px minimum touch targets for primary interactive controls.
- Set mobile form controls to 16px to prevent Safari input-focus zoom.
- Kept wide financial tables inside horizontal scroll containers rather than breaking the page.
- Made analytics charts scroll safely when they cannot fit all periods on a narrow display.
- Added special handling for compact-width and short landscape phones.
- Updated viewport metadata with `viewport-fit=cover` and mobile keyboard resize support.

No database migration is required.
