
export function migrateDatabaseExample(appVersion: number, db: any): void {

    const targetVersion = 2.0 // This is what you are currently migrating to
    
    // If the app version is already at or above the current version, no migration is needed
    if (appVersion >= targetVersion) {
        return;
    }

    // 
    // Perform migration steps here
    //

    db.exec(`
        CREATE TABLE IF NOT EXISTS version (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          version INTEGER NOT NULL
        )
      `);
    
    const versionCount = db
        .prepare("SELECT COUNT(*) as count FROM version")
        .get() as { count: number };
    if (versionCount.count === 0) {
        const insert =  db.prepare(
            "INSERT INTO version (version) VALUES (?)"
          );
        
        insert.run(targetVersion);
    }

    //
    // Update the database version after migration
    //

    const stmt = db.prepare("UPDATE version SET version = ?");
    stmt.run(targetVersion);

}





export function migrateDatabaseVersion2to3(appVersion: number, db: any): void { 

    const targetVersion = 3.0;

    // If the app version is already at or above the target version, no migration is needed
    if (appVersion >= targetVersion) {
        return;
    }


}