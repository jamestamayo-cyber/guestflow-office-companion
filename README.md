# Guestflow Office Companion

Design a clickable, responsive web prototype for an "Office Visitor Management System" used by an administrative office to replace a paper visitor logbook. Style: clean, professional, trustworthy (green/neon green primary, white cards, soft gray background, green/amber/red status badges), sidebar navigation, rounded cards, readable tables.



ROLES: Office Staff/Receptionist and Administrator (role-based access).



SCREENS TO BUILD

1. Login: username, password, show/hide password toggle, "Sign in" button, error state for invalid credentials, note "Authorized personnel only." After login, route by role.



1. Receptionist Dashboard: today's visitor count, currently inside office count, quick buttons "Register Visitor" and "Check Out Visitor".



1. Visitor Registration form: full name, contact number, purpose of visit (dropdown + "Other"), person/department to visit, date and time-in (auto-filled, read-only). Inline validation errors (required fields, phone format). "Save & Time-In" button, success toast.



1. Current Visitors: table of visitors inside the office (name, purpose, host/department, time-in, status badge "Inside") with a "Record Time-Out" button per row and a confirmation modal.



1. Search Visitor Records: search by name or date, filters, results table (name, contact partially masked, purpose, host, time-in, time-out, status).



1. Admin Dashboard: cards for Total Visitors, Current Visitors, Daily Visitors; a small daily-visits chart; recent activity list.



1. Admin Visitor Records: full table with search by name/date, view details drawer, "Edit" button (opens edit modal with a "Reason for edit" field and a warning that changes are logged), archive/retention action.



1. Reports: choose Daily / Weekly / Monthly, date range picker, summary stats, chart, preview table, "Export PDF/CSV" buttons.



1. Manage Staff Accounts: table (name, username, role, status), Add Staff modal, Edit, Deactivate, Reset Password.



1. Activity Logs: table (timestamp, user, action such as Registered / Edited / Checked-out visitor / Login, record ID) with filters by user, action and date.



1. Records Retention/Archiving: list of records older than a chosen period with "Archive" and "Restore" actions.



1. Access Denied page shown if a receptionist tries to open admin-only pages; session timeout modal ("Your session expired, please log in again").



SECURITY UI ELEMENTS (visual indicators)

Role badge in header, masked contact numbers for receptionists, "Logged in as" label, auto-logout warning, audit-log notices on edit forms, password rules hint on staff forms.



PROTOTYPE FLOW

Login → Register Visitor → Current Visitors → Record Time-Out → (Admin) Records → Reports → Activity Logs. Include sidebar navigation that differs by role (receptionist sees 4 items, admin sees 7), hover/active states, and a logout button.



Use realistic sample data (8-10 visitors, 3 staff, 2 admins). Do not add features beyond those listed.



Expected output

A working multi-page prototype with login, role-based sidebars, and about 12 linked screens.

Receptionist flow: log in, register a visitor, see them in Current Visitors, record time-out, and search records.

Admin flow: dashboard, edit records with logged changes, reports with charts, staff management, and activity logs.

Form validation, modals, toasts, and badges that show the security requirements visually. Note that Figma Make can't implement real hashing or SQL injection prevention, so you'd show those in your documentation or the actual code.

Two things in your spec to check:

The admin module mentions "View all submitted leave applications," which doesn't fit a visitor system. It's probably a copy-paste error, so I left it out.

Your document skips section F, so you may be missing a section.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://guestflow-office-companion.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5d44a000-e169-401e-8acf-281be0c0ae9f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
