'use client';

import { useEffect, useState } from 'react';
import { useElectron } from '../../hooks/use-electron';
import type { CalendarStatus, CalendarPreferences } from '@shared/types';

export default function SettingsPage() {
  const electron = useElectron();
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
  const [keysConfigured, setKeysConfigured] = useState(true);

  useEffect(() => {
    if (!electron) return;
    electron.calendarGetStatus().then(setCalendarStatus);
    electron.calendarGetPreferences().then(setCalendarPrefs);
    // Check if API keys are configured
    electron.getSettings().then((s) => {
      setKeysConfigured(!!(s.deepgramApiKey && s.anthropicApiKey));
    });
  }, [electron]);

  const handleConnect = async () => {
    if (!electron) return;
    setCalendarLoading(true);
    try {
      const status = await electron.calendarConnect();
      setCalendarStatus(status);
      // Auto-enable calendar alerts after connecting
      if (status.authenticated) {
        await electron.calendarToggle(true);
        const prefs = await electron.calendarGetPreferences();
        setCalendarPrefs({ ...prefs, enabled: true });
      }
    } catch (err: any) {
      console.error('Calendar connect error:', err);
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!electron) return;
    setCalendarLoading(true);
    try {
      await electron.calendarDisconnect();
      setCalendarStatus({ configured: true, authenticated: false, email: null, polling: false });
      setCalendarPrefs((p) => ({ ...p, enabled: false }));
    } finally {
      setCalendarLoading(false);
    }
  };

  return (
    <div className="max-w-xl space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your account and preferences</p>
      </div>

      {/* Status indicators */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</h2>
        <div className="bg-card rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${keysConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="text-sm">
              {keysConfigured ? 'Transcription & AI ready' : 'API keys not configured'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${calendarStatus.authenticated ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
            <span className="text-sm">
              {calendarStatus.authenticated
                ? `Google Calendar connected`
                : 'Google Calendar not connected'}
            </span>
          </div>
        </div>
      </section>

      {/* Google Account */}
      <section className="space-y-5">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Google Account</h2>

        {!calendarStatus.authenticated ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect your Google account to automatically detect meetings and start recording.
            </p>
            <button
              onClick={handleConnect}
              disabled={calendarLoading || !calendarStatus.configured}
              className="flex items-center gap-3 px-5 py-3 bg-white text-zinc-800 rounded-lg text-sm font-medium hover:bg-zinc-100 transition-colors duration-100 disabled:opacity-40 shadow-sm"
            >
              <GoogleIcon />
              {calendarLoading ? 'Connecting...' : 'Sign in with Google'}
            </button>
            {!calendarStatus.configured && (
              <p className="text-xs text-amber-400/80">
                Google integration requires setup by your administrator.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Connected account */}
            <div className="flex items-center justify-between bg-card rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-sm font-medium text-accent">
                  {(calendarStatus.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{calendarStatus.email}</p>
                  <p className="text-xs text-muted-foreground">Google Calendar</p>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={calendarLoading}
                className="text-xs px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors duration-100 disabled:opacity-40"
              >
                Sign out
              </button>
            </div>

            {/* Calendar alerts toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Meeting alerts</p>
                <p className="text-xs text-muted-foreground mt-0.5">Get notified when meetings are about to start</p>
              </div>
              <button
                onClick={async () => {
                  if (!electron) return;
                  const newEnabled = !calendarPrefs.enabled;
                  await electron.calendarToggle(newEnabled);
                  setCalendarPrefs((p) => ({ ...p, enabled: newEnabled }));
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
              <label className="block text-sm font-medium">Alert timing</label>
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

            {/* Auto-record toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-open recording</p>
                <p className="text-xs text-muted-foreground mt-0.5">Jump to the record page when a scheduled meeting starts</p>
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

      {/* App info */}
      <section className="pt-4 border-t border-muted/20">
        <p className="text-xs text-muted-foreground/50">Mother's Notes v0.1.0</p>
      </section>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
