export interface Migration {
  version: number;
  up: (db: any) => void;
  down?: (db: any) => void; // Optional rollback logic
}

export interface DataMigration {
  version: number;
  run: (data: any) => any;
}
