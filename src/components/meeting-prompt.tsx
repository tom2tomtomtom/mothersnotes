'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useElectron } from '../hooks/use-electron';
import type { CalendarEvent } from '@shared/types';

export function MeetingPrompt() {
  const electron = useElectron();
  const router = useRouter();
  const [prompt, setPrompt] = useState<CalendarEvent | null>(null);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    if (!electron) return;
    return electron.onCalendarMeetingApproaching((event) => {
      setPrompt(event);
      setHiding(false);
    });
  }, [electron]);

  const dismiss = useCallback(() => {
    if (!electron || !prompt) return;
    setHiding(true);
    setTimeout(() => {
      electron.calendarDismiss(prompt.eventId);
      setPrompt(null);
    }, 300);
  }, [electron, prompt]);

  const schedule = useCallback(async () => {
    if (!electron || !prompt) return;
    await electron.calendarSchedule([prompt]);
    setHiding(true);
    setTimeout(() => setPrompt(null), 300);
  }, [electron, prompt]);

  const scheduleAndRecord = useCallback(async () => {
    if (!electron || !prompt) return;
    await electron.calendarSchedule([prompt]);
    try {
      sessionStorage.setItem('calendarEvent', JSON.stringify(prompt));
    } catch {}
    setPrompt(null);
    router.push('/record');
  }, [electron, prompt, router]);

  if (!prompt) return null;

  const start = new Date(prompt.startTime);
  const minutesUntil = Math.max(0, Math.round((start.getTime() - Date.now()) / 60000));

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 max-w-sm transition-all duration-300 ${
        hiding ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
      }`}
    >
      <div className="bg-card border border-border rounded-lg shadow-elevated p-5 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-accent uppercase tracking-wider">
              Meeting in {minutesUntil} min
            </p>
            <p className="font-medium text-sm mt-1 truncate">{prompt.title}</p>
          </div>
          <button
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0 p-0.5"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Attendees */}
        {prompt.attendees.length > 0 && (
          <p className="text-xs text-muted-foreground">
            with {prompt.attendees.slice(0, 3).join(', ')}
            {prompt.attendees.length > 3 && ` +${prompt.attendees.length - 3}`}
          </p>
        )}

        {/* Time */}
        <p className="text-xs text-muted-foreground">
          {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </p>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={scheduleAndRecord}
            className="flex-1 text-xs px-3 py-2 bg-accent text-white rounded-md hover:bg-accent/90 transition-colors duration-100 font-medium"
          >
            Record now
          </button>
          <button
            onClick={schedule}
            className="flex-1 text-xs px-3 py-2 bg-accent/10 text-accent rounded-md hover:bg-accent/20 transition-colors duration-100"
          >
            Schedule
          </button>
          <button
            onClick={dismiss}
            className="text-xs px-3 py-2 bg-muted rounded-md hover:bg-muted/80 transition-colors duration-100 text-muted-foreground"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
