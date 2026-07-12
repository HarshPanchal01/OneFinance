// Command registry powering the Ctrl+K command palette (CommandPalette.vue).
// Shortcut hints are derived from the shared registry (src/shortcuts.ts) via
// useShortcuts — the palette looks each command up by id, so combos stay OS-aware
// and reflect any custom remaps.

export interface CommandContext {
  navigate: (view: string) => void;
  newTransaction: () => void;
  togglePrivacy: () => void;
  lock: () => void;
}

export interface Command {
  id: string;
  label: string;
  section: "Navigation" | "Actions";
  icon: string;
  // Extra search terms so a command matches under names other than its label.
  keywords?: string;
  perform: (ctx: CommandContext) => void;
}

export const commands: Command[] = [
  // Navigation — mirrors the Sidebar navItems.
  { id: "dashboard", label: "Dashboard", section: "Navigation", icon: "pi-home", perform: (c) => c.navigate("dashboard") },
  { id: "accounts", label: "Accounts", section: "Navigation", icon: "pi-wallet", perform: (c) => c.navigate("accounts") },
  { id: "investments", label: "Investments", section: "Navigation", icon: "pi-briefcase", keywords: "portfolio holdings", perform: (c) => c.navigate("investments") },
  { id: "transactions", label: "Transactions", section: "Navigation", icon: "pi-list", perform: (c) => c.navigate("transactions") },
  { id: "recurring", label: "Schedules", section: "Navigation", icon: "pi-sync", keywords: "recurring reminders bills", perform: (c) => c.navigate("recurring") },
  { id: "budgets", label: "Budgets", section: "Navigation", icon: "pi-money-bill", perform: (c) => c.navigate("budgets") },
  { id: "goals", label: "Goals", section: "Navigation", icon: "pi-flag", keywords: "savings", perform: (c) => c.navigate("goals") },
  { id: "insights", label: "General Insights", section: "Navigation", icon: "pi-chart-bar", keywords: "spending trends", perform: (c) => c.navigate("insights") },
  { id: "investment-insights", label: "Portfolio Insights", section: "Navigation", icon: "pi-chart-pie", keywords: "investment performance", perform: (c) => c.navigate("investment-insights") },
  { id: "calculators", label: "Calculators", section: "Navigation", icon: "pi-calculator", keywords: "loan mortgage compound interest debt", perform: (c) => c.navigate("calculators") },
  { id: "categories", label: "Labels", section: "Navigation", icon: "pi-tags", keywords: "categories", perform: (c) => c.navigate("categories") },
  { id: "settings", label: "Settings", section: "Navigation", icon: "pi-cog", perform: (c) => c.navigate("settings") },

  // Actions — reuse existing app actions.
  { id: "new-transaction", label: "New Transaction", section: "Actions", icon: "pi-plus", keywords: "add", perform: (c) => c.newTransaction() },
  { id: "toggle-privacy", label: "Toggle Privacy Mode", section: "Actions", icon: "pi-eye-slash", keywords: "hide amounts", perform: (c) => c.togglePrivacy() },
  { id: "lock", label: "Lock OneFinance", section: "Actions", icon: "pi-lock", keywords: "sign out", perform: (c) => c.lock() },
];
