// Plain constants only (no "use client", no React) — shared between
// EmployerDashboardShell (reads/writes it) and the root layout's no-flash
// script (reads it before hydration), without pulling the dashboard's
// client bundle into every page the way importing from a "use client"
// module would.
export const SIDEBAR_COLLAPSED_KEY = "jobgiga:employerSidebarCollapsed";
export const SIDEBAR_COLLAPSED_ATTR = "data-emp-sidebar-collapsed";

// Dashboard / Chat mode switch — "chat" turns the dashboard into a
// full-screen assistant. A cookie (not localStorage) so the server renders
// the right mode straight away: no flash of the dashboard on reload.
export const CHAT_MODE_COOKIE = "jobgiga_employer_view";
