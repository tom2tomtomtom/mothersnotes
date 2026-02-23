import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import type { AppSettings } from '../../shared/types';

// Load .env.local — check packaged app resources first, then project root (dev)
const isDev = !app.isPackaged;
const envPaths = isDev
  ? [path.join(__dirname, '..', '..', '..', '..', '.env.local')]
  : [
      path.join(process.resourcesPath, 'app', '.env.local'),
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

export const settingsService = {
  getAll(): AppSettings {
    return {
      deepgramApiKey: process.env.DEEPGRAM_API_KEY || defaults.deepgramApiKey,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY || defaults.anthropicApiKey,
      claudeModel: process.env.CLAUDE_MODEL || defaults.claudeModel,
      audioDeviceId: defaults.audioDeviceId,
      storagePath: defaults.storagePath,
    };
  },

  set(_updates: Partial<AppSettings>): void {
    // No-op: keys come from .env.local
  },

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.getAll()[key];
  },
};
