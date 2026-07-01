import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export interface AppPreferences {
  // Hide to the system tray on window close instead of quitting, so background
  // tasks (payment reminders, recurring transactions, backups) keep running.
  minimizeToTray: boolean;
  // Launch OneFinance automatically when the user logs in.
  openAtLogin: boolean;
  // Minutes of inactivity before the app auto-locks the database (0 = never).
  autoLockMinutes: number;
}

const DEFAULTS: AppPreferences = {
  minimizeToTray: false,
  openAtLogin: false,
  autoLockMinutes: 0,
};

function getPreferencesPath(): string {
  return path.join(app.getPath('userData'), 'app-preferences.json');
}

export function loadPreferences(): AppPreferences {
  try {
    const raw = fs.readFileSync(getPreferencesPath(), 'utf-8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePreferences(partial: Partial<AppPreferences>): AppPreferences {
  const merged = { ...loadPreferences(), ...partial };
  try {
    fs.writeFileSync(getPreferencesPath(), JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Preferences] Failed to save preferences:', err);
  }
  return merged;
}

/**
 * Registers (or removes) OneFinance as a launch-on-login item.
 * Windows/macOS use Electron's native login-item API; Linux is not supported by
 * that API, so we manage an XDG autostart .desktop entry directly.
 */
export function applyOpenAtLogin(enabled: boolean): void {
  if (process.platform === 'linux') {
    const autostartDir = path.join(app.getPath('home'), '.config', 'autostart');
    const desktopFile = path.join(autostartDir, 'one-finance.desktop');
    try {
      if (enabled) {
        fs.mkdirSync(autostartDir, { recursive: true });
        // In packaged builds execPath is the app binary; in dev it points at the
        // Electron binary and needs the project path as an argument.
        const exec = app.isPackaged ? `"${process.execPath}"` : `"${process.execPath}" "${app.getAppPath()}"`;
        const contents = [
          '[Desktop Entry]',
          'Type=Application',
          'Name=OneFinance',
          `Exec=${exec}`,
          'Terminal=false',
          'X-GNOME-Autostart-enabled=true',
          '',
        ].join('\n');
        fs.writeFileSync(desktopFile, contents, 'utf-8');
      } else {
        fs.rmSync(desktopFile, { force: true });
      }
    } catch (err) {
      console.error('[Preferences] Failed to update Linux autostart entry:', err);
    }
    return;
  }

  app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true });
}
