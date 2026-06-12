import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { initializeDatabase, processRecurringTransactions, processSavingsInterest } from './db'
import { registerIpcHandlers } from './ipc'
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

let win: BrowserWindow | null;

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(__dirname, "assets", 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    width: 1400,
    height: 1000,
    minWidth: 1024,
    minHeight: 768,
  });

  win.maximize();

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

  fs.writeFileSync(filePath, data, 'utf-8')

  return { success: true, path: filePath}
  }
);

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

  const data = JSON.parse(contents)

  return{
    success: true,
    path: filePath,
    data: data,
  }

});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
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

// Background task to check for due recurring transactions and savings interest
function startRecurringTransactionsTask() {
  // Check every 1 minute
  setInterval(() => {
    if (processRecurringTransactions()) {
      BrowserWindow.getAllWindows().forEach(w => w.webContents.send('recurring-processed'));
    }
    if (processSavingsInterest()) {
      BrowserWindow.getAllWindows().forEach(w => w.webContents.send('savings-interest-processed'));
    }
  }, 60 * 1000);
}

if (app.isPackaged) {
  const gotTheLock = app.requestSingleInstanceLock()

  if (!gotTheLock) {
    app.quit()
  } else {
    app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
      // Someone tried to run a second instance, we should focus our window.
      if (win) {
        if (win.isMinimized()) win.restore()
        win.focus()
      }
    })

    app.whenReady().then(() => {
      // Initialize database and IPC handlers before creating window
      initializeDatabase();
      registerIpcHandlers();
      
      createWindow();
      startRecurringTransactionsTask();
    });
  }
} else {
  // Development mode: No single instance lock, just start
  app.whenReady().then(() => {
    initializeDatabase();
    registerIpcHandlers();
    
    createWindow();
    startRecurringTransactionsTask();
  });
}
