import { app, BrowserWindow, ipcMain, protocol, net } from 'electron';
import path from 'path';
import fs from 'fs';
import { initDatabase } from './database/connection';
import { registerRecordingIPC } from './ipc/recording.ipc';
import { registerTranscriptionIPC } from './ipc/transcription.ipc';
import { registerAnalysisIPC } from './ipc/analysis.ipc';
import { registerMeetingsIPC } from './ipc/meetings.ipc';
import { registerExportIPC } from './ipc/export.ipc';
import { registerSettingsIPC } from './ipc/settings.ipc';
import { registerCalendarIPC } from './ipc/calendar.ipc';
import { googleCalendarService } from './services/google-calendar.service';
import { googleAuthService } from './services/google-auth.service';
import { pathToFileURL } from 'url';

const isDev = !app.isPackaged;
const outDir = path.join(__dirname, '..', '..', '..', 'out');

let mainWindow: BrowserWindow | null = null;

function setupCustomProtocol() {
  // Serve the Next.js static export via a custom app:// protocol
  // This makes client-side routing work correctly in the packaged app
  protocol.handle('app', (request) => {
    let url = request.url.replace('app://-/', '');
    // Strip query strings and hashes
    url = url.split('?')[0].split('#')[0];

    // If it's a file with extension, serve it directly
    if (path.extname(url)) {
      const filePath = path.join(outDir, url);
      return net.fetch(pathToFileURL(filePath).href);
    }

    // Otherwise it's a route — serve the corresponding HTML file
    // e.g. "record" -> "record.html", "meetings/detail" -> "meetings/detail.html"
    const routePath = url || 'index';
    let htmlPath = path.join(outDir, `${routePath}.html`);
    if (!fs.existsSync(htmlPath)) {
      htmlPath = path.join(outDir, routePath, 'index.html');
    }
    if (!fs.existsSync(htmlPath)) {
      htmlPath = path.join(outDir, 'index.html');
    }
    return net.fetch(pathToFileURL(htmlPath).href);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#F5F4F0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3939');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadURL('app://-/');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register custom protocol scheme before app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

app.whenReady().then(() => {
  // Set up custom protocol for serving static files
  if (!isDev) {
    setupCustomProtocol();
  }

  // Initialize database
  initDatabase();

  // Register all IPC handlers
  registerRecordingIPC();
  registerTranscriptionIPC();
  registerMeetingsIPC();
  registerAnalysisIPC();
  registerExportIPC();
  registerSettingsIPC();
  registerCalendarIPC();

  createWindow();

  // Auto-start calendar polling if enabled and authenticated
  const calPrefs = googleCalendarService.getPreferences();
  if (calPrefs.enabled && googleAuthService.isAuthenticated()) {
    googleCalendarService.start();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Re-create window when calendar triggers meeting alert and all windows are closed (macOS)
  app.on('second-instance', () => {
    if (mainWindow === null) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
