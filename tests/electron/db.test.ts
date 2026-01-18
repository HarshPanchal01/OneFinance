// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import fs from 'fs';
import initSqlJs from 'sql.js';

// Mock Electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/test-one-finance'),
  },
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock better-sqlite3
let mockSql: any; // SQL.js instance
let mockDbInstance: any; // The database instance

// Mock node:module to intercept createRequire
vi.mock('node:module', async (importOriginal) => {
  const mod: any = await importOriginal();
  return {
    ...mod,
    createRequire: (url: string) => {
      return (id: string) => {
        if (id === 'better-sqlite3') {
          // Return a constructor function that delegates to the global class
          return function(path: string) {
             const MockClass = (globalThis as any).MockDatabaseClass;
             if (!MockClass) throw new Error("MockDatabaseClass not found on globalThis");
             return new MockClass(path);
          };
        }
        return mod.createRequire(url)(id);
      };
    }
  };
});

// Mock better-sqlite3 logic
// We define it here and attach to globalThis so the mock factory can find it.
class MockDatabase {
  constructor() {
    if (!mockSql) throw new Error("SQL.js not initialized");
    mockDbInstance = new mockSql.Database();
    return new DatabaseAdapter(mockDbInstance);
  }
}

(globalThis as any).MockDatabaseClass = MockDatabase;

// Adapter to match better-sqlite3 API
class DatabaseAdapter {
  db: any;
  constructor(db: any) { this.db = db; }
  
  pragma() {} // Ignore
  
  exec(sql: string) { 
    this.db.run(sql); 
    return this; 
  }
  
  prepare(sql: string) {
    return new StatementAdapter(this.db, sql);
  }
  
  transaction(fn: (...args: any[]) => any) {
    return (...args: any[]) => {
      this.db.run("BEGIN");
      try {
        const res = fn(...args);
        this.db.run("COMMIT");
        return res;
      } catch (e) {
        this.db.run("ROLLBACK");
        throw e;
      }
    };
  }
  
  close() { this.db.close(); }
}

class StatementAdapter {
  stmt: any;
  db: any;
  constructor(db: any, sql: string) {
    this.db = db;
    this.stmt = db.prepare(sql);
  }

  run(...params: any[]) {
    const p = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    this.stmt.bind(p);
    this.stmt.step();
    this.stmt.reset();
    
    let lastId = 0;
    try {
        const res = this.db.exec("SELECT last_insert_rowid()");
        if (res.length && res[0].values.length) {
            lastId = res[0].values[0][0];
        }
    } catch {
        // ignore
    }

    return { changes: 1, lastInsertRowid: lastId };
  }

  get(...params: any[]) {
    const p = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    this.stmt.bind(p);
    let res = undefined;
    if (this.stmt.step()) {
      res = this.stmt.getAsObject();
    }
    this.stmt.reset();
    return res;
  }

  all(...params: any[]) {
    const p = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    this.stmt.bind(p);
    const result: any[] = [];
    while (this.stmt.step()) {
      result.push(this.stmt.getAsObject());
    }
    this.stmt.reset();
    return result;
  }
}

// Import DB logic
import * as DB from '../../electron/db';

describe('Electron Database', () => {
  const testDir = '/tmp/test-one-finance';

  beforeAll(async () => {
    mockSql = await initSqlJs();
  });

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    // Force re-init DB
    // We need to access the private _db or call closeDb then getDb
    DB.closeDb();
    DB.initializeDatabase();
  });

  afterEach(() => {
    DB.closeDb();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Categories', () => {
    it('seeds default categories', () => {
      const categories = DB.getCategories();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories.find(c => c.name === 'Food & Dining')).toBeDefined();
    });

    it('creates and retrieves a category', () => {
      const newCat = DB.createCategory('New Cat', '#000', 'pi-test');
      expect(newCat.id).toBeDefined();
      
      const retrieved = DB.getCategoryById(newCat.id);
      expect(retrieved).toEqual(newCat);
    });

    it('updates a category', () => {
      const cat = DB.createCategory('To Update', '#fff', 'pi-1');
      const updated = DB.updateCategory(cat.id, 'Updated', '#000', 'pi-2');
      
      expect(updated?.name).toBe('Updated');
      expect(updated?.colorCode).toBe('#000');
    });

    it('deletes a category', () => {
      const cat = DB.createCategory('To Delete', '#fff', 'pi-1');
      const success = DB.deleteCategory(cat.id);
      expect(success).toBe(true);
      
      const missing = DB.getCategoryById(cat.id);
      expect(missing).toBeUndefined();
    });
  });

  describe('Accounts', () => {
    it('seeds default account', () => {
      const accounts = DB.getAccounts();
      expect(accounts.length).toBeGreaterThan(0);
      expect(accounts[0].isDefault).toBeTruthy();
    });

    it('creates an account', () => {
      const types = DB.getAccountTypes();
      const typeId = types[0].id;
      
      const id = DB.insertAccount({
        id: 0,
        accountName: 'Test Acc',
        institutionName: 'Bank',
        startingBalance: 100,
        accountTypeId: typeId,
        isDefault: false
      });

      expect(id).not.toBeNull();
      
      const acc = DB.getAccountById(id as number);
      expect(acc?.accountName).toBe('Test Acc');
      expect(acc?.startingBalance).toBe(100);
    });
  });

  describe('Transactions', () => {
    let accountId: number;
    let categoryId: number;

    beforeEach(() => {
      const accounts = DB.getAccounts();
      accountId = accounts[0].id;
      const categories = DB.getCategories();
      categoryId = categories[0].id;
    });

    it('creates and retrieves a transaction', () => {
      const input = {
        title: 'Test Tx',
        amount: 50.00,
        date: '2023-01-01',
        type: 'expense' as const,
        accountId: accountId,
        categoryId: categoryId,
        notes: 'Notes'
      };

      const tx = DB.createTransaction(input);
      expect(tx.id).toBeDefined();
      expect(tx.title).toBe('Test Tx');

      const retrieved = DB.getTransactionById(tx.id);
      expect(retrieved?.title).toBe('Test Tx');
    });

    it('gets monthly trends', () => {
       // Need to ensure dates match format YYYY-MM-DD
       DB.createTransaction({
        title: 'Income', amount: 1000, date: '2023-01-15', type: 'income', accountId, categoryId
       });
       DB.createTransaction({
        title: 'Expense', amount: 200, date: '2023-01-20', type: 'expense', accountId, categoryId
       });

       const trends = DB.getMonthlyTrends(2023);
       const jan = trends.find(t => t.month === 1);
       
       expect(jan).toBeDefined();
       expect(jan?.totalIncome).toBe(1000);
       expect(jan?.totalExpenses).toBe(200);
       expect(jan?.balance).toBe(800);
    });

    it('searches transactions', () => {
      DB.createTransaction({ title: 'Apple', amount: 10, date: '2023-01-01', type: 'expense', accountId, categoryId });
      DB.createTransaction({ title: 'Banana', amount: 20, date: '2023-01-01', type: 'expense', accountId, categoryId });

      const results = DB.searchTransactions({ text: 'Apple' });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Apple');
    });
  });
});
