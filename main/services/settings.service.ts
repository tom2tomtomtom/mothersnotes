import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import type { AppSettings } from '../../shared/types';

// Load .env.local — check multiple locations for dev and packaged app
const isDev = !app.isPackaged;
const envPaths = isDev
  ? [path.join(__dirname, '..', '..', '..', '..', '.env.local')]
  : [
      // Inside the asar (bundled via electron-builder files config)
      path.join(app.getAppPath(), '.env.local'),
      // Alongside the asar (extraResources)
      path.join(process.resourcesPath, '.env.local'),
    ];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

const defaults: AppSettings = {
  deepgramApiKey: '',
  anthropicApiKey: '',
  claudeModel: 'claude-sonnet-4-6',
  audioDeviceId: null,
  storagePath: '',
};

// User settings file (for any overrides entered in the UI)
const userSettingsPath = path.join(app.getPath('userData'), 'user-settings.json');

function loadUserSettings(): Partial<AppSettings> {
  try {
    if (fs.existsSync(userSettingsPath)) {
      return JSON.parse(fs.readFileSync(userSettingsPath, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveUserSettings(settings: Partial<AppSettings>): void {
  try {
    const existing = loadUserSettings();
    fs.writeFileSync(userSettingsPath, JSON.stringify({ ...existing, ...settings }, null, 2));
  } catch {}
}

export const settingsService = {
  getAll(): AppSettings {
    const user = loadUserSettings();
    return {
      deepgramApiKey: user.deepgramApiKey || process.env.DEEPGRAM_API_KEY || defaults.deepgramApiKey,
      anthropicApiKey: user.anthropicApiKey || process.env.ANTHROPIC_API_KEY || defaults.anthropicApiKey,
      claudeModel: user.claudeModel || process.env.CLAUDE_MODEL || defaults.claudeModel,
      audioDeviceId: user.audioDeviceId ?? defaults.audioDeviceId,
      storagePath: user.storagePath || defaults.storagePath,
    };
  },

  set(updates: Partial<AppSettings>): void {
    saveUserSettings(updates);
  },

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.getAll()[key];
  },

  /** Check if the critical API keys are configured (from any source) */
  isConfigured(): boolean {
    const s = this.getAll();
    return !!(s.deepgramApiKey && s.anthropicApiKey);
  },
};
