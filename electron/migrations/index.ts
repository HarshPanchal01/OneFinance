import path from "node:path";
import fs from "node:fs";
import { app } from "electron";
import { Migration, DataMigration } from "./types";
import { v1 } from "./001-init";

// Import migrations here
// import { v2 } from "./002-example"; 

// ==========================================
// REGISTRY
// ==========================================
// Add new DB migrations here
const DB_MIGRATIONS: Migration[] = [
    v1
];

// Add new Data transformations here
const DATA_MIGRATIONS: DataMigration[] = [
    // { version: 2, run: (data) => { ... } }
];

// ==========================================
// RUNNER
// ==========================================

export class MigrationRunner {
  
  /**
   * Run all pending database migrations.
   * - Checks PRAGMA user_version
   * - Backs up DB
   * - Runs migrations in transaction
   */
  static runDbMigrations(db: any): void {
    // 0. Handle Legacy "Version Table" (from previous PR attempts)
    this.handleLegacyVersionTable(db);

    const currentVersion = db.pragma("user_version", { simple: true });
    
    // Filter migrations that are newer than current DB version
    const pendingMigrations = DB_MIGRATIONS.filter(m => m.version > currentVersion)
                                           .sort((a, b) => a.version - b.version);

    if (pendingMigrations.length === 0) {
      console.log(`[Migration] Database is up to date (Version ${currentVersion}).`);
      return;
    }

    console.log(`[Migration] Found ${pendingMigrations.length} pending migrations.`);

    // 1. Create Backup
    try {
      this.backupDatabase();
    } catch (error) {
      console.error("[Migration] Backup failed. Aborting migration.", error);
      throw error; // Stop if we can't backup
    }

    // 2. Run Migrations
    const runTransaction = db.transaction(() => {
      for (const migration of pendingMigrations) {
        console.log(`[Migration] Applying version ${migration.version}...`);
        migration.up(db);
        
        // Update version after each successful step (or at the end of all)
        // Updating per step in a single transaction is fine.
      }
      
      // Set final version
      const finalVersion = pendingMigrations[pendingMigrations.length - 1].version;
      db.pragma(`user_version = ${finalVersion}`);
      console.log(`[Migration] Database upgraded to version ${finalVersion}`);
    });

    try {
      runTransaction();
    } catch (error) {
      console.error("[Migration] Migration failed. Rolled back.", error);
      // Restore backup? SQLite transaction handles the DB state rollback.
      // But we might want to alert the user.
      throw error;
    }
  }

  /**
   * Transform imported data to match the current app schema.
   * Chains data migrations from file_version -> current_version.
   */
  static migrateData(data: any): any {
    const fileVersion = data.databaseVersion || 0;
    const currentAppVersion = this.getLatestVersion();

    if (fileVersion >= currentAppVersion) {
      return data;
    }

    console.log(`[Migration] Upgrading imported data from v${fileVersion} to v${currentAppVersion}...`);

    let migratedData = JSON.parse(JSON.stringify(data)); // Deep copy to be safe

    const pendingTransformations = DATA_MIGRATIONS.filter(m => m.version > fileVersion)
                                                  .sort((a, b) => a.version - b.version);

    for (const migration of pendingTransformations) {
      console.log(`[Migration] Transforming data to v${migration.version}...`);
      migratedData = migration.run(migratedData);
    }
    
    // Update the version in the data object
    migratedData.databaseVersion = currentAppVersion;
    return migratedData;
  }

  static getLatestVersion(): number {
    const dbMax = DB_MIGRATIONS.length > 0 ? Math.max(...DB_MIGRATIONS.map(m => m.version)) : 1;
    const dataMax = DATA_MIGRATIONS.length > 0 ? Math.max(...DATA_MIGRATIONS.map(m => m.version)) : 1;
    // Base version is 1 (initial release)
    return Math.max(dbMax, dataMax, 1);
  }

  private static backupDatabase() {
    const userDataPath = app.getPath("userData");
    const dbPath = path.join(userDataPath, "one-finance.db");
    const backupPath = path.join(userDataPath, `one-finance.db.bak`);

    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath);
      console.log(`[Migration] Database backed up to ${backupPath}`);
    }
  }

  /**
   * Checks for the existence of the deprecated 'version' table.
   * If found, transfers the version to PRAGMA user_version and drops the table.
   */
  private static handleLegacyVersionTable(db: any): void {
    try {
      const tableExists = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='version'").get() as { count: number };
      
      if (tableExists.count > 0) {
        console.log("[Migration] Found legacy 'version' table. Migrating to PRAGMA user_version.");
        const row = db.prepare("SELECT version FROM version LIMIT 1").get() as { version: number };
        
        if (row) {
          // Round down if it was 2.0
          const ver = Math.floor(row.version); 
          db.pragma(`user_version = ${ver}`);
          console.log(`[Migration] Set PRAGMA user_version to ${ver}`);
        }
        
        db.prepare("DROP TABLE version").run();
        console.log("[Migration] Dropped legacy 'version' table.");
      }
    } catch (e) {
      console.error("[Migration] Error checking legacy version table:", e);
    }
  }
}
