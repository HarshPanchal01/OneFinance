export function migrateDatabase(db: any, currentVersion: number, targetVersion: number): void {
  if (currentVersion >= targetVersion) {
    return;
  }

  console.log(`[Migration] Starting migration from v${currentVersion} to v${targetVersion}`);

  // Run migrations sequentially
  if (currentVersion < 2.0) {
    migrate1to2(db);
    updateVersion(db, 2.0);
    currentVersion = 2.0;
  }

  console.log(`[Migration] Finished migrating to v${targetVersion}`);
}

function updateVersion(db: any, version: number): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS version (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version REAL NOT NULL
    )
  `);
  const versionCount = db.prepare("SELECT COUNT(*) as count FROM version").get() as { count: number };
  if (versionCount.count === 0) {
    db.prepare("INSERT INTO version (version) VALUES (?)").run(version);
  } else {
    db.prepare("UPDATE version SET version = ?").run(version);
  }
}

function migrate1to2(db: any): void {
  console.log("[Migration] Running v1 to v2 migration steps");
  
  // Ensure version table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS version (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version REAL NOT NULL
    )
  `);

  // Move the old categories alter hack here
  try {
    db.exec("ALTER TABLE categories ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'");
    // Update known default income categories during migration for existing users
    db.exec("UPDATE categories SET type = 'income' WHERE name = 'Salary'");
    db.exec("UPDATE categories SET type = 'both' WHERE name = 'Other'");
  } catch (e: any) {
    if (!e?.message?.includes('duplicate column name')) {
      console.error('[Migration] Migration error (v1 to v2):', e);
    }
  }

  // Update transactions table to support transfers
  try {
    db.exec(`
      CREATE TABLE new_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
        notes TEXT,
        categoryId INTEGER,
        accountId INTEGER NOT NULL,
        transferAccountId INTEGER,
        FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (transferAccountId) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);
    
    db.exec(`
      INSERT INTO new_transactions (id, title, amount, date, type, notes, categoryId, accountId)
      SELECT id, title, amount, date, type, notes, categoryId, accountId FROM transactions
    `);
    
    db.exec("DROP TABLE transactions");
    db.exec("ALTER TABLE new_transactions RENAME TO transactions");
  } catch (e) {
    const error = e as any;
    if (!error?.message?.includes('already exists')) {
      console.error('[Migration] Migration error for transactions (v1 to v2):', error);
    }
  }

  // Add recurring transactions support
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS recurring_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
        categoryId INTEGER,
        accountId INTEGER NOT NULL,
        transferAccountId INTEGER,
        frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'bi-weekly', 'monthly', 'yearly')),
        startDate TEXT NOT NULL,
        nextRunDate TEXT NOT NULL,
        isActive BOOLEAN NOT NULL DEFAULT 1,
        FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (transferAccountId) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);
    
    db.exec("ALTER TABLE transactions ADD COLUMN recurringId INTEGER REFERENCES recurring_transactions(id) ON DELETE SET NULL");
  } catch (e) {
    const error = e as any;
    if (!error?.message?.includes('duplicate column name')) {
      console.error('[Migration] Migration error for recurring_transactions (v1 to v2):', error);
    }
  }

  // Add classification to accountType
  try {
    db.exec("ALTER TABLE accountType ADD COLUMN classification TEXT NOT NULL DEFAULT 'liquid' CHECK(classification IN ('liquid', 'asset', 'liability', 'investment'))");
  } catch (e) {
    const error = e as any;
    if (!error?.message?.includes('duplicate column name')) {
      console.error('[Migration] Migration error for accountType classification (v1 to v2):', error);
    }
  }

  // Add isExpenseTransfer and isIncomeTransfer
  try {
    db.exec("ALTER TABLE transactions ADD COLUMN isExpenseTransfer BOOLEAN DEFAULT 0");
  } catch (e) {
    const error = e as any;
    if (!error?.message?.includes('duplicate column name')) {
      console.error('[Migration] Migration error adding isExpenseTransfer to transactions:', error);
    }
  }
  try {
    db.exec("ALTER TABLE transactions ADD COLUMN isIncomeTransfer BOOLEAN DEFAULT 0");
  } catch (e) {
    const error = e as any;
    if (!error?.message?.includes('duplicate column name')) {
      console.error('[Migration] Migration error adding isIncomeTransfer to transactions:', error);
    }
  }

  try {
    db.exec("ALTER TABLE recurring_transactions ADD COLUMN isExpenseTransfer BOOLEAN DEFAULT 0");
  } catch (e) {
    const error = e as any;
    if (!error?.message?.includes('duplicate column name')) {
      console.error('[Migration] Migration error adding isExpenseTransfer to recurring_transactions:', error);
    }
  }
  try {
    db.exec("ALTER TABLE recurring_transactions ADD COLUMN isIncomeTransfer BOOLEAN DEFAULT 0");
  } catch (e) {
    const error = e as any;
    if (!error?.message?.includes('duplicate column name')) {
      console.error('[Migration] Migration error adding isIncomeTransfer to recurring_transactions:', error);
    }
  }

  // Add Investment Tables
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS investment_holdings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        accountId INTEGER NOT NULL,
        symbol TEXT NOT NULL,
        name TEXT,
        quantity REAL NOT NULL,
        lastPrice REAL,
        lastUpdated TEXT,
        sectorWeightings TEXT,
        FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS investment_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        holdingId INTEGER NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
        quantity REAL NOT NULL,
        price REAL NOT NULL,
        fees REAL DEFAULT 0,
        FOREIGN KEY (holdingId) REFERENCES investment_holdings(id) ON DELETE CASCADE
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS investment_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        accountId INTEGER NOT NULL,
        date TEXT NOT NULL,
        totalValue REAL NOT NULL,
        FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS investment_adjustments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        accountId INTEGER NOT NULL,
        date TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        notes TEXT,
        FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE CASCADE
      )
    `);

  } catch (e) {
    console.error('[Migration] Migration error creating investment tables:', e);
  }

  // Add savings account interest fields
  try {
    db.exec("ALTER TABLE accounts ADD COLUMN interestRate REAL DEFAULT NULL");
  } catch (e) {
    const error = e as any;
    if (!error?.message?.includes('duplicate column name')) {
      console.error('[Migration] Migration error adding interestRate to accounts:', error);
    }
  }
  try {
    db.exec("ALTER TABLE accounts ADD COLUMN interestCompounding TEXT DEFAULT NULL");
  } catch (e) {
    const error = e as any;
    if (!error?.message?.includes('duplicate column name')) {
      console.error('[Migration] Migration error adding interestCompounding to accounts:', error);
    }
  }
  try {
    db.exec("ALTER TABLE accounts ADD COLUMN nextInterestDate TEXT DEFAULT NULL");
  } catch (e) {
    const error = e as any;
    if (!error?.message?.includes('duplicate column name')) {
      console.error('[Migration] Migration error adding nextInterestDate to accounts:', error);
    }
  }

  // Add payment reminder fields to recurring transactions
  try {
    db.exec("ALTER TABLE recurring_transactions ADD COLUMN reminderEnabled BOOLEAN DEFAULT 0");
  } catch (e) {
    const error = e as any;
    if (!error?.message?.includes('duplicate column name')) {
      console.error('[Migration] Migration error adding reminderEnabled to recurring_transactions:', error);
    }
  }
  try {
    db.exec("ALTER TABLE recurring_transactions ADD COLUMN reminderDaysBefore INTEGER DEFAULT 1");
  } catch (e) {
    const error = e as any;
    if (!error?.message?.includes('duplicate column name')) {
      console.error('[Migration] Migration error adding reminderDaysBefore to recurring_transactions:', error);
    }
  }
  try {
    db.exec("ALTER TABLE recurring_transactions ADD COLUMN lastNotifiedDate TEXT DEFAULT NULL");
  } catch (e) {
    const error = e as any;
    if (!error?.message?.includes('duplicate column name')) {
      console.error('[Migration] Migration error adding lastNotifiedDate to recurring_transactions:', error);
    }
  }

  // Add investment price-change alert fields to holdings
  const holdingAlertColumns = [
    "ALTER TABLE investment_holdings ADD COLUMN alertDailyPct REAL DEFAULT NULL",
    "ALTER TABLE investment_holdings ADD COLUMN alertWeeklyPct REAL DEFAULT NULL",
    "ALTER TABLE investment_holdings ADD COLUMN alertMonthlyPct REAL DEFAULT NULL",
    "ALTER TABLE investment_holdings ADD COLUMN refClose1w REAL DEFAULT NULL",
    "ALTER TABLE investment_holdings ADD COLUMN refClose1m REAL DEFAULT NULL",
    "ALTER TABLE investment_holdings ADD COLUMN refDate TEXT DEFAULT NULL",
    "ALTER TABLE investment_holdings ADD COLUMN alertDailyNotified TEXT DEFAULT NULL",
    "ALTER TABLE investment_holdings ADD COLUMN alertWeeklyNotified TEXT DEFAULT NULL",
    "ALTER TABLE investment_holdings ADD COLUMN alertMonthlyNotified TEXT DEFAULT NULL",
  ];
  for (const sql of holdingAlertColumns) {
    try {
      db.exec(sql);
    } catch (e) {
      const error = e as any;
      if (!error?.message?.includes('duplicate column name')) {
        console.error('[Migration] Migration error adding holding alert column:', error);
      }
    }
  }

  // Add category budgets table
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        categoryId INTEGER NOT NULL UNIQUE,
        amount REAL NOT NULL,
        period TEXT NOT NULL DEFAULT 'monthly',
        FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE
      )
    `);
  } catch (e) {
    console.error('[Migration] Migration error creating budgets table:', e);
  }

  // Add savings goals table
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS savings_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        targetAmount REAL NOT NULL,
        targetDate TEXT,
        accountId INTEGER,
        currentAmount REAL NOT NULL DEFAULT 0,
        startingAmount REAL NOT NULL DEFAULT 0,
        createdDate TEXT NOT NULL,
        FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE SET NULL
      )
    `);
  } catch (e) {
    console.error('[Migration] Migration error creating savings_goals table:', e);
  }

  // Add native quote currency to holdings (multi-currency portfolios)
  try {
    db.exec("ALTER TABLE investment_holdings ADD COLUMN currency TEXT DEFAULT NULL");
  } catch (e) {
    const error = e as any;
    if (!error?.message?.includes('duplicate column name')) {
      console.error('[Migration] Migration error adding currency to investment_holdings:', error);
    }
  }
}

