export type DashboardWidgetId =
  | "kpis"
  | "netWorth"
  | "recentTransactions"
  | "spending"
  | "upcomingBills"
  | "watchlist";

export interface DashboardWidgetDef {
  id: DashboardWidgetId;
  label: string;
  // "top" widgets keep their fixed position (toggle-only); "detail" widgets sit
  // in the reorderable bottom row.
  zone: "top" | "detail";
}

export const DASHBOARD_WIDGETS: DashboardWidgetDef[] = [
  { id: "kpis", label: "Key Metrics", zone: "top" },
  { id: "netWorth", label: "Net Worth", zone: "top" },
  { id: "recentTransactions", label: "Recent Transactions", zone: "detail" },
  { id: "spending", label: "Top Spending", zone: "detail" },
  { id: "upcomingBills", label: "Upcoming Bills", zone: "detail" },
  { id: "watchlist", label: "Watchlist", zone: "detail" },
];

export const DEFAULT_DETAIL_ORDER: DashboardWidgetId[] = DASHBOARD_WIDGETS.filter(
  (w) => w.zone === "detail"
).map((w) => w.id);
