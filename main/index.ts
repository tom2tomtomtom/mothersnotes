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

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function getOutDir(): string {
  if (isDev) {
    return path.join(__dirname, '..', '..', '..', 'out');
  }
  return path.join(app.getAppPath(), 'out');
}

// Lookup table for common extensions → MIME types
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json',
};

// Register custom protocol scheme BEFORE app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#F5F4F0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Show window once content is ready (prevents flash)
  mainWindow.once('ready-to-show', () => {
    console.log('[Main] ready-to-show fired');
    mainWindow?.show();
  });

  // Fallback: force-show window after 3 seconds if ready-to-show never fires
  const showTimeout = setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.log('[Main] Timeout fallback — force-showing window');
      mainWindow.show();
    }
  }, 3000);

  mainWindow.once('ready-to-show', () => clearTimeout(showTimeout));

  // Log load failures
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[Main] did-fail-load:', errorCode, errorDescription, validatedURL);
  });

  mainWindow.webContents.on('console-message', (_event, _level, message) => {
    console.log('[Renderer]', message);
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3939');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    console.log('[Main] Production mode. outDir:', getOutDir());
    mainWindow.loadURL('app://host/');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Register custom protocol to serve static files from the out/ directory
  protocol.handle('app', (request) => {
    const outDir = getOutDir();
    const url = new URL(request.url);
    let filePath = decodeURIComponent(url.pathname);

    // Remove leading slash
    if (filePath.startsWith('/')) {
      filePath = filePath.slice(1);
    }

    // Route requests: if the path has no extension, it's a page navigation
    const ext = path.extname(filePath);
    if (!ext || filePath === '' || filePath === 'index') {
      // This is a page route — serve the corresponding HTML file
      const route = filePath || 'index';
      let htmlPath = path.join(outDir, `${route}.html`);
      if (!fs.existsSync(htmlPath)) {
        htmlPath = path.join(outDir, route, 'index.html');
      }
      if (!fs.existsSync(htmlPath)) {
        htmlPath = path.join(outDir, 'index.html');
      }
      console.log('[Protocol] Route:', route, '→', htmlPath);
      return net.fetch(`file://${htmlPath}`);
    }

    // Static asset request — serve the file directly
    const assetPath = path.join(outDir, filePath);
    if (fs.existsSync(assetPath)) {
      return net.fetch(`file://${assetPath}`);
    }

    // Fallback: 404
    console.warn('[Protocol] Not found:', filePath);
    return new Response('Not Found', { status: 404 });
  });

  // Create the window FIRST — must always show UI regardless of backend errors
  createWindow();

  // Initialize backend services with error handling so UI always works
  try {
    initDatabase();
  } catch (err) {
    console.error('[Main] Database init failed:', err);
  }

  try {
    registerRecordingIPC();
    registerTranscriptionIPC();
    registerMeetingsIPC();
    registerAnalysisIPC();
    registerExportIPC();
    registerSettingsIPC();
    registerCalendarIPC();
  } catch (err) {
    console.error('[Main] IPC registration failed:', err);
  }

  // Auto-start calendar polling if enabled and authenticated
  try {
    const calPrefs = googleCalendarService.getPreferences();
    if (calPrefs.enabled && googleAuthService.isAuthenticated()) {
      googleCalendarService.start();
    }
  } catch (err) {
    console.error('[Main] Calendar auto-start failed:', err);
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
