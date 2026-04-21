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
}
