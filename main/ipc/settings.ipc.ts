import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { settingsService } from '../services/settings.service';

export function registerSettingsIPC(): void {
  ipcMain.handle(IPC.SETTINGS_GET, async () => {
    return settingsService.getAll();
  });

  ipcMain.handle(IPC.SETTINGS_SET, async (_event, settings: any) => {
    settingsService.set(settings);
  });

  ipcMain.handle(IPC.SETTINGS_VALIDATE_KEYS, async (_event, keys: { deepgram?: string; anthropic?: string }) => {
    const results = { deepgram: false, anthropic: false };

    if (keys.deepgram) {
      try {
        const res = await fetch('https://api.deepgram.com/v1/projects', {
          headers: { Authorization: `Token ${keys.deepgram}` },
        });
        results.deepgram = res.ok;
      } catch {
        results.deepgram = false;
      }
    }

    if (keys.anthropic) {
      try {
        const Anthropic = require('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey: keys.anthropic });
        await client.messages.create({
          model: 'claude-sonnet-4-5-20250514',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'hi' }],
        });
        results.anthropic = true;
      } catch {
        results.anthropic = false;
      }
    }

    return results;
  });

  ipcMain.handle(IPC.SETTINGS_LIST_AUDIO_DEVICES, async () => {
    // Audio devices are listed from the renderer process via navigator.mediaDevices
    // This handler is kept for completeness
    return [];
  });
}
