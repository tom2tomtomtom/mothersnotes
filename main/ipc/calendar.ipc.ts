import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { googleAuthService } from '../services/google-auth.service';
import { googleCalendarService } from '../services/google-calendar.service';
import type { CalendarEvent, CalendarPreferences, CalendarStatus } from '../../shared/types';

export function registerCalendarIPC(): void {
  ipcMain.handle(IPC.CALENDAR_CONNECT, async (): Promise<CalendarStatus> => {
    const authStatus = await googleAuthService.connect();
    // Auto-start polling after connecting
    const prefs = googleCalendarService.getPreferences();
    if (prefs.enabled) {
      googleCalendarService.start();
    }
    return {
      ...authStatus,
      polling: googleCalendarService.isPolling(),
    };
  });

  ipcMain.handle(IPC.CALENDAR_DISCONNECT, async (): Promise<void> => {
    googleCalendarService.stop();
    await googleAuthService.disconnect();
  });

  ipcMain.handle(IPC.CALENDAR_STATUS, async (): Promise<CalendarStatus> => {
    const authStatus = await googleAuthService.getStatus();
    return {
      ...authStatus,
      polling: googleCalendarService.isPolling(),
    };
  });

  ipcMain.handle(IPC.CALENDAR_GET_PREFERENCES, async (): Promise<CalendarPreferences> => {
    return googleCalendarService.getPreferences();
  });

  ipcMain.handle(IPC.CALENDAR_SET_PREFERENCES, async (_event, prefs: Partial<CalendarPreferences>): Promise<CalendarPreferences> => {
    return googleCalendarService.setPreferences(prefs);
  });

  ipcMain.handle(IPC.CALENDAR_FETCH_EVENTS, async (_event, daysAhead?: number) => {
    return googleCalendarService.fetchEvents(daysAhead);
  });

  ipcMain.handle(IPC.CALENDAR_SCHEDULE, async (_event, events: CalendarEvent[]) => {
    googleCalendarService.schedule(events);
  });

  ipcMain.handle(IPC.CALENDAR_UNSCHEDULE, async (_event, eventIds: string[]) => {
    googleCalendarService.unschedule(eventIds);
  });

  ipcMain.handle(IPC.CALENDAR_GET_SCHEDULED, async () => {
    return googleCalendarService.getScheduled();
  });

  ipcMain.handle(IPC.CALENDAR_DISMISS, async (_event, eventId: string) => {
    googleCalendarService.dismiss(eventId);
  });

  ipcMain.handle(IPC.CALENDAR_TOGGLE, async (_event, enabled: boolean): Promise<void> => {
    googleCalendarService.setPreferences({ enabled });
    if (enabled && googleAuthService.isAuthenticated()) {
      googleCalendarService.start();
    } else {
      googleCalendarService.stop();
    }
  });
}
