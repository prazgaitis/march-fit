# 2026-03-01 Ledger Spreadsheet + CSV Export

## Todo
- [x] Break ledger scoring into base vs activity bonuses vs streak bonus
- [x] Redesign hidden `/ledger` page into spreadsheet-like table layout
- [x] Use a custom wide debug layout for `/ledger` (remove default `max-w-2xl` constraint)
- [x] Add CSV export from ledger page for offline analysis
- [x] Switch debug ledger rendering to `canvas-datagrid` (SheetJS OSS stack)
- [x] Switch CSV export implementation to SheetJS (`xlsx`) writer
- [x] Make debug header/summary sticky with full-bleed grid body
- [x] Fix `LedgerContent` hook ordering regression (no conditional hook calls)
- [x] Fix `canvas-datagrid` init for web component path (`attributes` is read-only)
- [x] Verify web typecheck/tests for touched surfaces
