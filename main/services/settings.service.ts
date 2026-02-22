import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import type { AppSettings } from '../../shared/types';

const defaults: AppSettings = {
  deepgramApiKey: '',
  anthropicApiKey: '',
  claudeModel: 'claude-sonnet-4-5-20250514',
  audioDeviceId: null,
  storagePath: '',
};

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

function readSettings(): AppSettings {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf-8');
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

function writeSettings(settings: AppSettings): void {
  const dir = path.dirname(getSettingsPath());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
}

export const settingsService = {
  getAll(): AppSettings {
    return readSettings();
  },

  set(updates: Partial<AppSettings>): void {
    const current = readSettings();
    writeSettings({ ...current, ...updates });
  },

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return readSettings()[key];
  },
};
