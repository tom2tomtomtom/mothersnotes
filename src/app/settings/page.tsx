'use client';

import { useEffect, useState } from 'react';
import { useElectron } from '../../hooks/use-electron';
import type { AppSettings, CalendarStatus, CalendarPreferences } from '@shared/types';

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
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus>({
    configured: false,
    authenticated: false,
    email: null,
    polling: false,
  });
  const [calendarPrefs, setCalendarPrefs] = useState<CalendarPreferences>({
    enabled: false,
    leadTimeMinutes: 2,
    autoOpen: false,
  });
  const [calendarLoading, setCalendarLoading] = useState(false);

  useEffect(() => {
    if (!electron) return;
    electron.getSettings().then(setSettings);
    electron.calendarGetStatus().then(setCalendarStatus);
    electron.calendarGetPreferences().then(setCalendarPrefs);
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
    <div className="max-w-xl space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Configure your API keys and preferences</p>
      </div>

      {/* API Keys */}
      <section className="space-y-5">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">API Keys</h2>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium">
            Deepgram API Key
            {validation.deepgram === true && <span className="text-success ml-2 text-xs font-normal">Valid</span>}
            {validation.deepgram === false && <span className="text-accent ml-2 text-xs font-normal">Invalid</span>}
          </label>
          <input
            type="password"
            value={settings.deepgramApiKey}
            onChange={(e) => setSettings((s) => ({ ...s, deepgramApiKey: e.target.value }))}
            placeholder="Enter your Deepgram API key"
            className="w-full bg-card rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-shadow duration-150"
          />
          <p className="text-xs text-muted-foreground">
            Get your key at deepgram.com/dashboard
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium">
            Anthropic API Key
            {validation.anthropic === true && <span className="text-success ml-2 text-xs font-normal">Valid</span>}
            {validation.anthropic === false && <span className="text-accent ml-2 text-xs font-normal">Invalid</span>}
          </label>
          <input
            type="password"
            value={settings.anthropicApiKey}
            onChange={(e) => setSettings((s) => ({ ...s, anthropicApiKey: e.target.value }))}
            placeholder="Enter your Anthropic API key"
            className="w-full bg-card rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-shadow duration-150"
          />
          <p className="text-xs text-muted-foreground">
            Get your key at console.anthropic.com
          </p>
        </div>

        <button
          onClick={handleValidate}
          disabled={validating || (!settings.deepgramApiKey && !settings.anthropicApiKey)}
          className="text-sm px-4 py-2.5 bg-card rounded-md hover:bg-muted transition-colors duration-100 disabled:opacity-40"
        >
          {validating ? 'Validating...' : 'Validate Keys'}
        </button>
      </section>

      {/* AI Model */}
      <section className="space-y-5">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">AI Model</h2>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium">Claude Model</label>
          <select
            value={settings.claudeModel}
            onChange={(e) => setSettings((s) => ({ ...s, claudeModel: e.target.value }))}
            className="w-full bg-card rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-shadow duration-150"
          >
            <option value="claude-sonnet-4-5-20250514">Claude Sonnet 4.5 (Recommended)</option>
            <option value="claude-opus-4-20250514">Claude Opus 4</option>
            <option value="claude-haiku-3-5-20241022">Claude Haiku 3.5 (Fastest)</option>
          </select>
        </div>
      </section>

      {/* Calendar Integration */}
      <section className="space-y-5">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Calendar Integration</h2>

        {!calendarStatus.configured ? (
          <div className="bg-card rounded-md p-5 space-y-2">
            <p className="text-sm font-medium">Google Calendar not configured</p>
            <p className="text-xs text-muted-foreground">
              Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your .env.local file, then enable the Google Calendar API in your Google Cloud Console.
            </p>
          </div>
        ) : !calendarStatus.authenticated ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Connect your Google Calendar to get meeting reminders and auto-record.</p>
            <button
              onClick={async () => {
                if (!electron) return;
                setCalendarLoading(true);
                try {
                  const status = await electron.calendarConnect();
                  setCalendarStatus(status);
                } catch (err: any) {
                  console.error('Calendar connect error:', err);
                } finally {
                  setCalendarLoading(false);
                }
              }}
              disabled={calendarLoading}
              className="text-sm px-4 py-2.5 bg-foreground text-background rounded-md hover:opacity-90 transition-opacity duration-100 disabled:opacity-40"
            >
              {calendarLoading ? 'Connecting...' : 'Connect Google Calendar'}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between bg-card rounded-md p-4">
              <div>
                <p className="text-sm font-medium">Connected</p>
                {calendarStatus.email && (
                  <p className="text-xs text-muted-foreground mt-0.5">{calendarStatus.email}</p>
                )}
              </div>
              <button
                onClick={async () => {
                  if (!electron) return;
                  setCalendarLoading(true);
                  try {
                    await electron.calendarDisconnect();
                    setCalendarStatus({ configured: true, authenticated: false, email: null, polling: false });
                    setCalendarPrefs((p) => ({ ...p, enabled: false }));
                  } finally {
                    setCalendarLoading(false);
                  }
                }}
                disabled={calendarLoading}
                className="text-xs px-3 py-1.5 bg-muted rounded-md hover:bg-muted/80 transition-colors duration-100 disabled:opacity-40"
              >
                Disconnect
              </button>
            </div>

            {/* Enable / Disable */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable calendar alerts</p>
                <p className="text-xs text-muted-foreground mt-0.5">Get notified when meetings are about to start</p>
              </div>
              <button
                onClick={async () => {
                  if (!electron) return;
                  const newEnabled = !calendarPrefs.enabled;
                  await electron.calendarToggle(newEnabled);
                  setCalendarPrefs((p) => ({ ...p, enabled: newEnabled }));
                  setCalendarStatus((s) => ({ ...s, polling: newEnabled }));
                }}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  calendarPrefs.enabled ? 'bg-accent' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${
                    calendarPrefs.enabled ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            {/* Lead time */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">Alert lead time</label>
              <select
                value={calendarPrefs.leadTimeMinutes}
                onChange={async (e) => {
                  if (!electron) return;
                  const val = Number(e.target.value) as 1 | 2 | 5;
                  const updated = await electron.calendarSetPreferences({ leadTimeMinutes: val });
                  setCalendarPrefs(updated);
                }}
                className="w-full bg-card rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-shadow duration-150"
              >
                <option value={1}>1 minute before</option>
                <option value={2}>2 minutes before</option>
                <option value={5}>5 minutes before</option>
              </select>
            </div>

            {/* Auto-open toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-open record page</p>
                <p className="text-xs text-muted-foreground mt-0.5">Automatically navigate to the record page when a meeting starts</p>
              </div>
              <button
                onClick={async () => {
                  if (!electron) return;
                  const updated = await electron.calendarSetPreferences({ autoOpen: !calendarPrefs.autoOpen });
                  setCalendarPrefs(updated);
                }}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  calendarPrefs.autoOpen ? 'bg-accent' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${
                    calendarPrefs.autoOpen ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Save */}
      <div className="flex items-center gap-4 pt-6">
        <button
          onClick={handleSave}
          className="bg-foreground text-background px-5 py-2.5 rounded-md text-sm font-medium hover:opacity-90 transition-opacity duration-100"
        >
          Save Settings
        </button>
        {saved && <span className="text-sm text-success">Settings saved</span>}
      </div>
    </div>
  );
}
