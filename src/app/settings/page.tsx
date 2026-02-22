'use client';

import { useEffect, useState } from 'react';
import { useElectron } from '../../hooks/use-electron';
import type { AppSettings } from '@shared/types';

export default function SettingsPage() {
  const electron = useElectron();
  const [settings, setSettings] = useState<AppSettings>({
    deepgramApiKey: '',
    anthropicApiKey: '',
    claudeModel: 'claude-sonnet-4-5-20250514',
    audioDeviceId: null,
    storagePath: '',
  });
  const [saved, setSaved] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<{ deepgram: boolean | null; anthropic: boolean | null }>({
    deepgram: null,
    anthropic: null,
  });

  useEffect(() => {
    if (!electron) return;
    electron.getSettings().then(setSettings);
  }, [electron]);

  const handleSave = async () => {
    if (!electron) return;
    await electron.setSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleValidate = async () => {
    if (!electron) return;
    setValidating(true);
    const result = await electron.validateApiKeys({
      deepgram: settings.deepgramApiKey || undefined,
      anthropic: settings.anthropicApiKey || undefined,
    });
    setValidation(result);
    setValidating(false);
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your API keys and preferences</p>
      </div>

      {/* API Keys */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">API Keys</h2>

        <div>
          <label className="block text-sm font-medium mb-1">
            Deepgram API Key
            {validation.deepgram === true && <span className="text-success ml-2">Valid</span>}
            {validation.deepgram === false && <span className="text-accent ml-2">Invalid</span>}
          </label>
          <input
            type="password"
            value={settings.deepgramApiKey}
            onChange={(e) => setSettings((s) => ({ ...s, deepgramApiKey: e.target.value }))}
            placeholder="Enter your Deepgram API key"
            className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent/50"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Get your key at deepgram.com/dashboard
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Anthropic API Key
            {validation.anthropic === true && <span className="text-success ml-2">Valid</span>}
            {validation.anthropic === false && <span className="text-accent ml-2">Invalid</span>}
          </label>
          <input
            type="password"
            value={settings.anthropicApiKey}
            onChange={(e) => setSettings((s) => ({ ...s, anthropicApiKey: e.target.value }))}
            placeholder="Enter your Anthropic API key"
            className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent/50"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Get your key at console.anthropic.com
          </p>
        </div>

        <button
          onClick={handleValidate}
          disabled={validating || (!settings.deepgramApiKey && !settings.anthropicApiKey)}
          className="text-sm px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
        >
          {validating ? 'Validating...' : 'Validate Keys'}
        </button>
      </section>

      {/* AI Model */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">AI Model</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Claude Model</label>
          <select
            value={settings.claudeModel}
            onChange={(e) => setSettings((s) => ({ ...s, claudeModel: e.target.value }))}
            className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent/50"
          >
            <option value="claude-sonnet-4-5-20250514">Claude Sonnet 4.5 (Recommended)</option>
            <option value="claude-opus-4-20250514">Claude Opus 4</option>
            <option value="claude-haiku-3-5-20241022">Claude Haiku 3.5 (Fastest)</option>
          </select>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <button
          onClick={handleSave}
          className="bg-accent text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          Save Settings
        </button>
        {saved && <span className="text-sm text-success">Settings saved</span>}
      </div>
    </div>
  );
}
