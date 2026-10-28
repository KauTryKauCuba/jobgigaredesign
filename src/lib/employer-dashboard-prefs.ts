// Plain constants only (no "use client", no React) — shared between
// EmployerDashboardShell (reads/writes it) and the root layout's no-flash
// script (reads it before hydration), without pulling the dashboard's
// client bundle into every page the way importing from a "use client"
// module would.
export const SIDEBAR_COLLAPSED_KEY = "jobgiga:employerSidebarCollapsed";
export const SIDEBAR_COLLAPSED_ATTR = "data-emp-sidebar-collapsed";
