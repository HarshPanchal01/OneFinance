import { Migration } from "./types";

export const v1: Migration = {
  version: 1,
  up: (db) => {
    // Ledger Years
    db.exec(`
      CREATE TABLE IF NOT EXISTS ledger_years (
        year INTEGER PRIMARY KEY
      )
    `);

    // Categories
    db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        colorCode TEXT NOT NULL DEFAULT '#6366f1',
        icon TEXT NOT NULL DEFAULT 'pi-tag'
      )
    `);

    // Account Type
    db.exec(`
      CREATE TABLE IF NOT EXISTS accountType (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL
      )
    `);

    // Accounts
    db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        accountName TEXT NOT NULL,
        institutionName TEXT,
        startingBalance REAL NOT NULL,
        accountTypeId INTEGER,
        isDefault BOOLEAN NOT NULL,
        FOREIGN KEY (accountTypeId) REFERENCES accountType(id) ON DELETE SET NULL
      )
    `);

    // Transactions
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        notes TEXT,
        categoryId INTEGER,
        accountId INTEGER NOT NULL,
        FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);

    // Indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(categoryId);
      CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(accountId);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    `);

    // Seed Data
    seedDefaultCategories(db);
    seedDefaultAccountData(db);
  }
};

function seedDefaultCategories(db: any): void {
  const count = db.prepare("SELECT COUNT(*) as count FROM categories").get() as { count: number };
  if (count.count > 0) return;

  const defaultCategories = [
    { name: "Salary", colorCode: "#22c55e", icon: "pi-wallet" },
    { name: "Food & Dining", colorCode: "#f97316", icon: "pi-shopping-cart" },
    { name: "Transportation", colorCode: "#3b82f6", icon: "pi-car" },
    { name: "Entertainment", colorCode: "#a855f7", icon: "pi-ticket" },
    { name: "Shopping", colorCode: "#ec4899", icon: "pi-shopping-bag" },
    { name: "Bills & Utilities", colorCode: "#eab308", icon: "pi-bolt" },
    { name: "Healthcare", colorCode: "#14b8a6", icon: "pi-heart" },
    { name: "Other", colorCode: "#6b7280", icon: "pi-ellipsis-h" },
  ];

  const insert = db.prepare("INSERT INTO categories (name, colorCode, icon) VALUES (?, ?, ?)");
  for (const cat of defaultCategories) {
    insert.run(cat.name, cat.colorCode, cat.icon);
  }
}

function seedDefaultAccountData(db: any): void {
  const count = db.prepare("SELECT COUNT(*) as count FROM accountType").get() as { count: number };
  if (count.count > 0) return;

  const defaultAccountTypes = [{type: "Cash"}, {type: "Chequing"}, {type: "Savings"}];
  const defaultAccounts = [
    {accountName: "OneFinance", institutionName: null, startingBalance: 0, accountTypeId: 0, isDefault: true},
  ];

  const insertAccountType = db.prepare("INSERT INTO accountType (type) VALUES (?)");
  let result = null;
  for (const accType of defaultAccountTypes){
    result = insertAccountType.run(accType.type);
  }

  const id = result?.lastInsertRowid ?? 0; 
  const insertAccount = db.prepare("INSERT INTO accounts (accountName, institutionName, startingBalance, accountTypeId, isDefault) VALUES (?,?,?,?,?)");

  for (const acc of defaultAccounts){
    insertAccount.run(acc.accountName, acc.institutionName, acc.startingBalance, id, Number(acc.isDefault));
  }
}
