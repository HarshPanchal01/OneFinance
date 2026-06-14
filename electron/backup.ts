import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {
  getDatabaseVersion,
  getAccounts,
  getAllTransactions,
  getCategories,
  getAccountTypes,
  getLedgerYears,
  getRecurringTransactions,
  getInvestmentHoldings,
  getAllInvestmentTransactions,
  getGlobalInvestmentHistory,
  getInvestmentAdjustments,
} from './db';

export type BackupFrequency = 'daily' | 'weekly';

export interface BackupSettings {
  enabled: boolean;
  folder: string | null;
  frequency: BackupFrequency;
  lastBackupDate: string | null;
  hasSeenBackupPrompt: boolean;
}

const DEFAULTS: BackupSettings = {
  enabled: false,
  folder: null,
  frequency: 'daily',
  lastBackupDate: null,
  hasSeenBackupPrompt: false,
};

const AUTO_MAX = 5;

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'backup-settings.json');
}

export function loadSettings(): BackupSettings {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    if (!['daily', 'weekly'].includes(parsed.frequency)) parsed.frequency = DEFAULTS.frequency;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(partial: Partial<BackupSettings>): BackupSettings {
  const current = loadSettings();
  const merged = { ...current, ...partial };
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Backup] Failed to save settings:', err);
  }
  return merged;
}

function buildFilename(type: 'auto' | 'manual'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return `one-finance-${type}-${year}-${month}-${day}_${hour}-${minute}-${second}.json`;
}

function listBackupFiles(folder: string, type: 'auto' | 'manual'): string[] {
  const prefix = `one-finance-${type}-`;
  try {
    return fs.readdirSync(folder)
      .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
      .sort(); // lexicographic = chronological given YYYY-MM-DD_HH-MM format
  } catch {
    return [];
  }
}

function buildExportPayload(): object {
  return {
    databaseVersion: getDatabaseVersion(),
    accounts: getAccounts(),
    transactions: getAllTransactions(),
    categories: getCategories(),
    accountTypes: getAccountTypes(),
    ledgerYears: getLedgerYears(),
    recurringTransactions: getRecurringTransactions(),
    investmentHoldings: getInvestmentHoldings(),
    investmentTransactions: getAllInvestmentTransactions(),
    investmentHistory: getGlobalInvestmentHistory(),
    investmentAdjustments: getInvestmentAdjustments(),
  };
}

export function getLatestManualBackup(folder: string): { exists: boolean; filename: string | null } {
  const files = listBackupFiles(folder, 'manual');
  if (files.length === 0) return { exists: false, filename: null };
  return { exists: true, filename: files[files.length - 1] };
}

export function runBackup(type: 'auto' | 'manual', override = false): { success: boolean; error?: string } {
  try {
    const settings = loadSettings();

    if (!settings.folder) {
      return { success: false, error: 'no folder configured' };
    }

    try {
      fs.accessSync(settings.folder, fs.constants.W_OK);
    } catch {
      console.error('[Backup] Folder is missing or not writable:', settings.folder);
      return { success: false, error: 'folder not writable' };
    }

    if (type === 'auto') {
      // Rotate: keep at most AUTO_MAX auto backups, deleting the oldest first
      const autoFiles = listBackupFiles(settings.folder, 'auto');
      while (autoFiles.length >= AUTO_MAX) {
        const oldest = autoFiles.shift()!;
        try { fs.unlinkSync(path.join(settings.folder, oldest)); } catch { /* silent */ }
      }
    } else if (type === 'manual' && override) {
      // Delete the most recent manual backup before writing the new one
      const manualFiles = listBackupFiles(settings.folder, 'manual');
      if (manualFiles.length > 0) {
        const latest = manualFiles[manualFiles.length - 1];
        try { fs.unlinkSync(path.join(settings.folder, latest)); } catch { /* silent */ }
      }
    }

    const filename = buildFilename(type);
    const backupPath = path.join(settings.folder, filename);
    fs.writeFileSync(backupPath, JSON.stringify(buildExportPayload(), null, 2), 'utf-8');

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    saveSettings({ lastBackupDate: today });

    console.log('[Backup] Written:', backupPath);
    return { success: true };
  } catch (err) {
    console.error('[Backup] Unexpected error:', err);
    return { success: false, error: String(err) };
  }
}

export function checkAndRunBackup(): boolean {
  try {
    const settings = loadSettings();

    if (!settings.enabled || !settings.folder) return false;

    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const last = settings.lastBackupDate;

    let isDue = false;
    if (!last) {
      isDue = true;
    } else if (settings.frequency === 'daily') {
      isDue = last < today;
    } else if (settings.frequency === 'weekly') {
      const diffMs = new Date(today).getTime() - new Date(last).getTime();
      isDue = diffMs >= 7 * 24 * 60 * 60 * 1000;
    }

    if (!isDue) return false;

    const result = runBackup('auto');
    return result.success;
  } catch (err) {
    console.error('[Backup] Error in checkAndRunBackup:', err);
    return false;
  }
}
