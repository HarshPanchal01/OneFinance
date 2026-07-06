// Command registry powering the Ctrl+K command palette (CommandPalette.vue).
// Kept self-contained for now; #151 will unify this with the keydown handler and
// the Settings shortcut list behind one shared registry.

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
  // Display-only hint of the direct shortcut, mirroring Settings → Keyboard Shortcuts.
  shortcut?: string[];
  perform: (ctx: CommandContext) => void;
}

export const commands: Command[] = [
  // Navigation — mirrors the Sidebar navItems.
  { id: "dashboard", label: "Dashboard", section: "Navigation", icon: "pi-home", shortcut: ["Ctrl", "D"], perform: (c) => c.navigate("dashboard") },
  { id: "accounts", label: "Accounts", section: "Navigation", icon: "pi-wallet", shortcut: ["Ctrl", "Shift", "A"], perform: (c) => c.navigate("accounts") },
  { id: "investments", label: "Investments", section: "Navigation", icon: "pi-briefcase", keywords: "portfolio holdings", shortcut: ["Ctrl", "Shift", "I"], perform: (c) => c.navigate("investments") },
  { id: "transactions", label: "Transactions", section: "Navigation", icon: "pi-list", shortcut: ["Ctrl", "T"], perform: (c) => c.navigate("transactions") },
  { id: "recurring", label: "Schedules", section: "Navigation", icon: "pi-sync", keywords: "recurring reminders bills", shortcut: ["Ctrl", "S"], perform: (c) => c.navigate("recurring") },
  { id: "budgets", label: "Budgets", section: "Navigation", icon: "pi-money-bill", shortcut: ["Ctrl", "B"], perform: (c) => c.navigate("budgets") },
  { id: "goals", label: "Goals", section: "Navigation", icon: "pi-flag", keywords: "savings", shortcut: ["Ctrl", "G"], perform: (c) => c.navigate("goals") },
  { id: "insights", label: "General Insights", section: "Navigation", icon: "pi-chart-bar", keywords: "spending trends", shortcut: ["Ctrl", "I"], perform: (c) => c.navigate("insights") },
  { id: "investment-insights", label: "Portfolio Insights", section: "Navigation", icon: "pi-chart-pie", keywords: "investment performance", shortcut: ["Ctrl", "P"], perform: (c) => c.navigate("investment-insights") },
  { id: "calculators", label: "Calculators", section: "Navigation", icon: "pi-calculator", keywords: "loan mortgage compound interest debt", shortcut: ["Ctrl", "Shift", "C"], perform: (c) => c.navigate("calculators") },
  { id: "categories", label: "Labels", section: "Navigation", icon: "pi-tags", keywords: "categories", shortcut: ["Ctrl", "L"], perform: (c) => c.navigate("categories") },
  { id: "settings", label: "Settings", section: "Navigation", icon: "pi-cog", shortcut: ["Ctrl", "Shift", "S"], perform: (c) => c.navigate("settings") },

  // Actions — reuse existing app actions.
  { id: "new-transaction", label: "New Transaction", section: "Actions", icon: "pi-plus", keywords: "add", shortcut: ["Ctrl", "N"], perform: (c) => c.newTransaction() },
  { id: "toggle-privacy", label: "Toggle Privacy Mode", section: "Actions", icon: "pi-eye-slash", keywords: "hide amounts", shortcut: ["Ctrl", "Shift", "P"], perform: (c) => c.togglePrivacy() },
  { id: "lock", label: "Lock OneFinance", section: "Actions", icon: "pi-lock", keywords: "sign out", shortcut: ["Ctrl", "Shift", "L"], perform: (c) => c.lock() },
];
