import { app, BrowserWindow, dialog, ipcMain, Notification, Tray, Menu } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { initializeDatabase, processRecurringTransactions, processSavingsInterest, getDueReminders, openDatabase, rekeyDatabase, isUnlocked, hasPlaintextDbWithData, setAsidePlaintextDb, getSessionPassword } from './db'
import { registerIpcHandlers } from './ipc'
import { checkAndRunBackup } from './backup'
import { loadPreferences, savePreferences, applyOpenAtLogin, AppPreferences } from './preferences'
import { loadSecurity, saveSecurity, hasMasterPassword } from './security'
import { createVerifier, verifyPassword } from './crypto'
import { wrapExport, readImport } from './secureExport'
import fs from 'fs'


const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..');

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST;

// App icon for the window, tray, and reminder notifications. Tray/Notification
// use nativeImage (raster only — PNG/ICO, not SVG): Windows uses logo.png, macOS
// and Linux use icon.png (the rasterized brand logo). Resolves from <root>/assets
// in dev and inside the asar when packaged (included via electron-builder `files`).
const APP_ICON = path.join(
  process.env.APP_ROOT,
  'assets',
  process.platform === 'win32' ? 'logo.png' : 'icon.png',
);

let win: BrowserWindow | null;
let tray: Tray | null = null;
// Set to true by the tray "Quit" item so the window's close handler lets the app exit.
let isQuitting = false;
let appPreferences: AppPreferences = { minimizeToTray: false, openAtLogin: false };

function showWindow() {
  if (!win) {
    createWindow();
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createTray() {
  if (tray) return;
  tray = new Tray(APP_ICON);
  tray.setToolTip('OneFinance');
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open OneFinance', click: () => showWindow() },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => showWindow());
}

function createWindow() {
  win = new BrowserWindow({
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    width: 1400,
    height: 1000,
    minWidth: 1024,
    minHeight: 768,
  });

  win.maximize();

  // Hide to the system tray instead of quitting when that preference is on.
  win.on('close', (event) => {
    if (!isQuitting && appPreferences.minimizeToTray) {
      event.preventDefault();
      win?.hide();
    }
  });

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString());
  });

  if (app.isPackaged) {
    win.setMenu(null);
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  } else if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

ipcMain.handle('save-file', async (_event, {data, defaultName}) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save File',
    defaultPath: defaultName ?? "data.json",
    filters:[
      {name: 'JSON Files', extensions: ['json']},
      {name: 'All Files', extensions:['*']}
    ]
  })

  if (canceled || !filePath){
    return{success:false}
  }

  // Exports are encrypted with the master password so the JSON file isn't a
  // plaintext hole around the encrypted database.
  const password = getSessionPassword();
  if (!password) {
    return { success: false }
  }

  fs.writeFileSync(filePath, wrapExport(data, password), 'utf-8')

  return { success: true, path: filePath}
  }
);

ipcMain.handle('backup:selectFolder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select Backup Folder',
    properties: ['openDirectory', 'createDirectory'],
  });

  if (canceled || filePaths.length === 0) {
    return { canceled: true };
  }

  return { folder: filePaths[0] };
});

ipcMain.handle('import-file', async() => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Import Data",
    properties: ['openFile'],
    filters: [
      { name: 'JSON Files', extensions: ['json']},
      { name: 'All Files', extensions: ['*']}
    ]
  })

  if (canceled || filePaths.length === 0){
    return {success: false}
  }

  const filePath = filePaths[0]
  const contents = fs.readFileSync(filePath, 'utf-8')

  const password = getSessionPassword();
  if (!password) {
    return { success: false, error: 'The database is locked.' }
  }

  try {
    // Decrypts an encrypted OneFinance export; legacy plaintext exports pass through.
    const data = readImport(contents, password)
    return { success: true, path: filePath, data }
  } catch {
    return {
      success: false,
      error: 'Could not read this file. It may be encrypted with a different master password, or it is not a valid OneFinance export.',
    }
  }

});

// Re-encrypts selected backup/export files from the old password to a new one.
// Used by the change-password flow so backups made with the old password stay
// usable after the master password changes.
ipcMain.handle('backups:reencrypt', async (_event, oldPassword: string, newPassword: string) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select backups to re-encrypt with your new password',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (canceled || filePaths.length === 0) {
    return { canceled: true, updated: 0, failed: 0, failures: [] };
  }

  let updated = 0;
  const failures: string[] = [];
  for (const fp of filePaths) {
    try {
      // Decrypt with the old password (legacy plaintext passes straight through),
      // then re-encrypt the same data with the new password.
      const data = readImport(fs.readFileSync(fp, 'utf-8'), oldPassword);
      fs.writeFileSync(fp, wrapExport(JSON.stringify(data), newPassword), 'utf-8');
      updated++;
    } catch {
      failures.push(path.basename(fp));
    }
  }

  return { canceled: false, updated, failed: failures.length, failures };
});

app.on('before-quit', () => {
  isQuitting = true;
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q. When "keep running in tray" is on, the window
// hides rather than closes, so this won't fire — but guard anyway.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !appPreferences.minimizeToTray) {
    app.quit();
    win = null;
  }
});

ipcMain.handle('prefs:get', () => appPreferences);

ipcMain.handle('prefs:set', (_event, partial: Partial<AppPreferences>) => {
  appPreferences = savePreferences(partial);
  if (partial.openAtLogin !== undefined) {
    applyOpenAtLogin(partial.openAtLogin);
  }
  return appPreferences;
});

// Explicit full quit — bypasses the close-to-tray handler (used e.g. after
// deleting the database, where the app must actually exit, not hide to tray).
ipcMain.handle('app:quit', () => {
  isQuitting = true;
  app.quit();
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

const isDev = !app.isPackaged;

if (isDev) {
  // Use a different userData path for development to prevent database conflicts
  const devUserDataPath = path.join(app.getPath('appData'), 'one-finance-dev');
  app.setPath('userData', devUserDataPath);
  console.log(`[Main] Running in dev mode. UserData: ${devUserDataPath}`);
}

// Region/currency mirrored from the renderer so notifications match the user's
// locale (the renderer owns these settings; the main process can't read them).
// Defaults keep cold-start notifications sensible before the renderer reports in.
let reminderLocale: string | undefined;
let reminderCurrency = 'USD';

ipcMain.handle('reminders:setLocale', (_event, locale: string, currency: string) => {
  reminderLocale = locale || undefined;
  if (currency) reminderCurrency = currency;
});

function formatReminderAmount(amount: number): string {
  try {
    return new Intl.NumberFormat(reminderLocale, {
      style: 'currency',
      currency: reminderCurrency,
      currencyDisplay: 'narrowSymbol',
    }).format(amount);
  } catch {
    return String(amount);
  }
}

function formatLongDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// Whole-day difference between today and an ISO date. Uses UTC date-only values
// so DST transitions (23/25-hour local days) don't cause off-by-one phrases.
function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / (24 * 60 * 60 * 1000));
}

function formatDuePhrase(dateStr: string): string {
  const n = daysUntil(dateStr);
  if (n < 0) return `${-n} day${-n === 1 ? '' : 's'} overdue`;
  if (n === 0) return 'due today';
  if (n === 1) return 'due tomorrow';
  if (n === 7) return 'due in a week';
  if (n === 14) return 'due in 2 weeks';
  return `due in ${n} days`;
}

interface PriceAlertPayload {
  symbol: string;
  timeframe: 'daily' | 'weekly' | 'monthly';
  pct: number;
  fromPrice: number;
  toPrice: number;
}

const TIMEFRAME_LABEL: Record<PriceAlertPayload['timeframe'], string> = {
  daily: 'past day',
  weekly: 'past week',
  monthly: 'past month',
};

// Shows a native notification per investment price-change alert. The renderer
// (refreshInvestmentPrices) computes crossings and hands them off here so the
// notification + click-to-navigate stays consistent with payment reminders.
ipcMain.handle('notifications:showPriceAlerts', (_event, alerts: PriceAlertPayload[]) => {
  if (!Array.isArray(alerts) || alerts.length === 0) return;

  for (const a of alerts) {
    const arrow = a.pct >= 0 ? '▲' : '▼';
    const verb = a.pct >= 0 ? 'Rose' : 'Fell';
    const notification = new Notification({
      title: `${a.symbol} ${arrow} ${Math.abs(a.pct).toFixed(1)}% (${TIMEFRAME_LABEL[a.timeframe]})`,
      body: `${verb} from ${formatReminderAmount(a.fromPrice)} to ${formatReminderAmount(a.toPrice)}`,
      icon: APP_ICON,
    });
    notification.on('click', () => {
      if (win) {
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
        win.webContents.send('navigate-investments');
      }
    });
    notification.show();
  }
});

// Fires native desktop notifications for any payment reminders that are due.
// Runs before processRecurringTransactions so a "0 days before" (due-date)
// reminder fires before the same heartbeat advances nextRunDate.
function runReminderCheck() {
  const due = getDueReminders();
  if (due.length === 0) return;

  for (const rec of due) {
    const notification = new Notification({
      title: `Upcoming payment: ${rec.title}`,
      body: `${formatReminderAmount(rec.amount)} ${formatDuePhrase(rec.nextRunDate)} on ${formatLongDate(rec.nextRunDate)}`,
      icon: APP_ICON,
    });
    notification.on('click', () => {
      if (win) {
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
        win.webContents.send('navigate-reminders');
      }
    });
    notification.show();
  }

  BrowserWindow.getAllWindows().forEach(w => w.webContents.send('reminder-notified'));
}

// Background task to check for due recurring transactions, savings interest, and automated backups
function startRecurringTransactionsTask() {
  // Check every 1 minute
  setInterval(() => {
    runReminderCheck();
    if (processRecurringTransactions()) {
      BrowserWindow.getAllWindows().forEach(w => w.webContents.send('recurring-processed'));
    }
    if (processSavingsInterest()) {
      BrowserWindow.getAllWindows().forEach(w => w.webContents.send('savings-interest-processed'));
    }
    if (checkAndRunBackup()) {
      BrowserWindow.getAllWindows().forEach(w => w.webContents.send('silent-backup-complete'));
    }
  }, 60 * 1000);
}

// Background tasks (the 1-minute heartbeat) must start exactly once, and only
// after the database has been unlocked.
let tasksStarted = false;

// Opens the encrypted database with the master password and brings the app to
// life: runs migrations, starts the background heartbeat once, and performs the
// startup catch-up checks. Shared by auth:create and auth:unlock.
function unlockAndStart(password: string): void {
  openDatabase(password);
  initializeDatabase();

  if (!tasksStarted) {
    startRecurringTransactionsTask();
    tasksStarted = true;
  }

  // Catch-up checks: run now in case anything was missed while the app was closed.
  runReminderCheck();
  if (checkAndRunBackup()) {
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('silent-backup-complete'));
  }
}

ipcMain.handle('auth:getStatus', () => ({
  hasMasterPassword: hasMasterPassword(),
  isUnlocked: isUnlocked(),
}));

ipcMain.handle('auth:create', (_event, password: string) => {
  if (hasMasterPassword()) {
    return { success: false, error: 'A master password already exists.' };
  }
  if (!password) {
    return { success: false, error: 'Password cannot be empty.' };
  }
  try {
    // Preserve any pre-existing plaintext database before creating a fresh
    // encrypted one (data is recovered via export/import).
    if (hasPlaintextDbWithData()) {
      setAsidePlaintextDb();
    }
    saveSecurity({ verifier: createVerifier(password) });
    unlockAndStart(password);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('auth:unlock', (_event, password: string) => {
  const { verifier } = loadSecurity();
  if (!verifier || !verifyPassword(verifier, password)) {
    return { success: false, error: 'Incorrect master password.' };
  }
  try {
    unlockAndStart(password);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('auth:changePassword', (_event, oldPassword: string, newPassword: string) => {
  const { verifier } = loadSecurity();
  if (!verifier || !verifyPassword(verifier, oldPassword)) {
    return { success: false, error: 'Current password is incorrect.' };
  }
  if (!newPassword) {
    return { success: false, error: 'New password cannot be empty.' };
  }
  try {
    rekeyDatabase(newPassword);
    saveSecurity({ verifier: createVerifier(newPassword) });
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
});

if (app.isPackaged) {
  const gotTheLock = app.requestSingleInstanceLock()

  if (!gotTheLock) {
    app.quit()
  } else {
    app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
      // Someone tried to run a second instance, we should reveal our window
      // (it may be hidden in the tray).
      showWindow()
    })

    app.whenReady().then(() => {
      // Required for Windows toast notifications to render with the correct app identity
      app.setAppUserModelId(app.getName());

      appPreferences = loadPreferences();

      // The database stays locked until the renderer collects the master password
      // and calls auth:create / auth:unlock — only then do we open it and start the
      // background tasks (see unlockAndStart). Handlers register now; their DB calls
      // throw until unlocked.
      registerIpcHandlers();

      createWindow();
      createTray();
    });
  }
} else {
  // Development mode: No single instance lock, just start
  app.whenReady().then(() => {
    app.setAppUserModelId(app.getName());

    appPreferences = loadPreferences();

    // DB stays locked until the renderer unlocks it via auth:create/auth:unlock
    // (see unlockAndStart). Handlers register now; their DB calls throw until then.
    registerIpcHandlers();

    createWindow();
    createTray();
  });
}
