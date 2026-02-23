import { Notification, app } from 'electron';
import fs from 'fs';
import path from 'path';
import { googleAuthService } from './google-auth.service';
import { getMainWindow } from '../index';
import { IPC } from '../../shared/ipc-channels';
import type { CalendarEvent, CalendarPreferences } from '../../shared/types';

const PREFS_PATH = () => path.join(app.getPath('userData'), 'calendar-prefs.json');
const SCHEDULED_PATH = () => path.join(app.getPath('userData'), 'calendar-scheduled.json');

const DEFAULT_PREFERENCES: CalendarPreferences = {
  enabled: false,
  leadTimeMinutes: 2,
  autoOpen: false,
};

// Scheduled meetings the user picked for recording
let scheduledMeetings: Map<string, CalendarEvent> = new Map();

// Track already-fired alerts to prevent duplicates
const firedAlerts = new Set<string>();
// Track meetings we've already prompted about (so we don't nag)
const promptedMeetings = new Set<string>();
// Track meetings the user dismissed (won't prompt again)
const dismissedMeetings = new Set<string>();
let pollInterval: ReturnType<typeof setInterval> | null = null;
let isPolling = false;

// --- Preferences ---

function getPreferences(): CalendarPreferences {
  try {
    const data = fs.readFileSync(PREFS_PATH(), 'utf-8');
    const saved = JSON.parse(data) as Partial<CalendarPreferences>;
    return { ...DEFAULT_PREFERENCES, ...saved };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function setPreferences(updates: Partial<CalendarPreferences>): CalendarPreferences {
  const current = getPreferences();
  const updated = { ...current, ...updates };
  fs.writeFileSync(PREFS_PATH(), JSON.stringify(updated), 'utf-8');
  return updated;
}

// --- Scheduled meetings persistence ---

function loadScheduled(): void {
  try {
    const data = fs.readFileSync(SCHEDULED_PATH(), 'utf-8');
    const arr = JSON.parse(data) as CalendarEvent[];
    scheduledMeetings = new Map(arr.map((e) => [e.eventId, e]));
    // Prune past events
    const now = Date.now();
    for (const [id, event] of scheduledMeetings) {
      if (new Date(event.endTime).getTime() < now - 60 * 60 * 1000) {
        scheduledMeetings.delete(id);
      }
    }
    saveScheduled();
  } catch {
    scheduledMeetings = new Map();
  }
}

function saveScheduled(): void {
  const arr = Array.from(scheduledMeetings.values());
  fs.writeFileSync(SCHEDULED_PATH(), JSON.stringify(arr), 'utf-8');
}

// --- Google Calendar API ---

async function fetchEventsForRange(hoursAhead: number, maxResults = 50): Promise<CalendarEvent[]> {
  const accessToken = await googleAuthService.getAccessToken();
  const now = new Date();
  const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(maxResults),
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('[Calendar] API error:', err);
    return [];
  }

  const data = (await res.json()) as any;
  const items = data.items || [];

  return items
    .filter((event: any) => event.start?.dateTime) // skip all-day
    .map((event: any) => mapToCalendarEvent(event));
}

function extractMeetingLink(event: any): string | null {
  if (event.conferenceData?.entryPoints) {
    const videoEntry = event.conferenceData.entryPoints.find(
      (ep: any) => ep.entryPointType === 'video'
    );
    if (videoEntry?.uri) return videoEntry.uri;
  }
  if (event.hangoutLink) return event.hangoutLink;
  if (event.description) {
    const urlMatch = event.description.match(
      /https?:\/\/[^\s]*(?:zoom\.us|meet\.google\.com|teams\.microsoft\.com)[^\s]*/i
    );
    if (urlMatch) return urlMatch[0];
  }
  return null;
}

function mapToCalendarEvent(event: any): CalendarEvent {
  return {
    eventId: event.id,
    title: event.summary || 'Untitled Meeting',
    startTime: event.start.dateTime,
    endTime: event.end.dateTime,
    attendees: (event.attendees || [])
      .filter((a: any) => !a.self)
      .map((a: any) => a.displayName || a.email),
    meetingLink: extractMeetingLink(event),
  };
}

// --- Alerts (only for scheduled meetings) ---

function triggerMeetingAlert(event: CalendarEvent): void {
  console.log(`[Calendar] Triggering alert for: ${event.title}`);
  const win = getMainWindow();

  // Always auto-open for scheduled meetings — that's the whole point
  if (win) {
    win.webContents.send(IPC.CALENDAR_MEETING_STARTING, event);
    if (win.isMinimized()) win.restore();
    win.focus();
  }

  // Also show a notification in case the app is in the background
  const attendeeText = event.attendees.length > 0
    ? `with ${event.attendees.slice(0, 3).join(', ')}${event.attendees.length > 3 ? '...' : ''}`
    : '';

  const notification = new Notification({
    title: 'Recording: Meeting Starting',
    body: `${event.title} ${attendeeText}`.trim(),
  });

  notification.on('click', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  notification.show();
}

// --- Polling ---

async function poll(): Promise<void> {
  try {
    const prefs = getPreferences();

    // Send upcoming events to renderer for dashboard widget
    const upcomingEvents = await fetchEventsForRange(1); // next hour
    const win = getMainWindow();
    if (win) {
      win.webContents.send(IPC.CALENDAR_UPCOMING, upcomingEvents);
    }

    // Check scheduled meetings — fire alert if within lead time
    const now = Date.now();
    const leadMs = prefs.leadTimeMinutes * 60 * 1000;

    for (const [eventId, event] of scheduledMeetings) {
      const startMs = new Date(event.startTime).getTime();
      const timeUntilStart = startMs - now;

      // Fire alert if within lead time and not already fired
      if (timeUntilStart <= leadMs && timeUntilStart > -60000 && !firedAlerts.has(eventId)) {
        firedAlerts.add(eventId);
        triggerMeetingAlert(event);
      }

      // Clean up past scheduled meetings (ended more than 1 hour ago)
      if (new Date(event.endTime).getTime() < now - 60 * 60 * 1000) {
        scheduledMeetings.delete(eventId);
        firedAlerts.delete(eventId);
      }
    }

    saveScheduled();

    // Prompt for unscheduled meetings approaching within 5 minutes
    const promptWindow = 5 * 60 * 1000; // 5 minutes
    for (const event of upcomingEvents) {
      const startMs = new Date(event.startTime).getTime();
      const timeUntilStart = startMs - now;
      const isScheduled = scheduledMeetings.has(event.eventId);
      const wasDismissed = dismissedMeetings.has(event.eventId);
      const wasPrompted = promptedMeetings.has(event.eventId);

      if (
        !isScheduled &&
        !wasDismissed &&
        !wasPrompted &&
        timeUntilStart <= promptWindow &&
        timeUntilStart > -60000
      ) {
        promptedMeetings.add(event.eventId);
        // Send to renderer — it will show an in-app prompt
        if (win) {
          win.webContents.send(IPC.CALENDAR_MEETING_APPROACHING, event);
        }
      }
    }
  } catch (err) {
    console.error('[Calendar] Poll error:', err);
  }
}

// --- Exported service ---

export const googleCalendarService = {
  getPreferences,
  setPreferences,

  isPolling(): boolean {
    return isPolling;
  },

  start(): void {
    if (pollInterval) return;
    loadScheduled();
    console.log(`[Calendar] Polling started (${scheduledMeetings.size} meetings scheduled)`);
    isPolling = true;
    poll();
    pollInterval = setInterval(poll, 30000);
  },

  stop(): void {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    isPolling = false;
    console.log('[Calendar] Polling stopped');
  },

  async fetchEvents(daysAhead = 1): Promise<CalendarEvent[]> {
    return fetchEventsForRange(daysAhead * 24);
  },

  // Schedule specific meetings for recording
  schedule(events: CalendarEvent[]): void {
    for (const event of events) {
      scheduledMeetings.set(event.eventId, event);
      console.log(`[Calendar] Scheduled: ${event.title}`);
    }
    saveScheduled();
    // Auto-start polling if not already running and authenticated
    if (!isPolling && googleAuthService.isAuthenticated()) {
      this.start();
    }
  },

  unschedule(eventIds: string[]): void {
    for (const id of eventIds) {
      const event = scheduledMeetings.get(id);
      if (event) console.log(`[Calendar] Unscheduled: ${event.title}`);
      scheduledMeetings.delete(id);
      firedAlerts.delete(id);
    }
    saveScheduled();
  },

  getScheduled(): CalendarEvent[] {
    return Array.from(scheduledMeetings.values());
  },

  isScheduled(eventId: string): boolean {
    return scheduledMeetings.has(eventId);
  },

  dismiss(eventId: string): void {
    dismissedMeetings.add(eventId);
  },
};
