'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useElectron } from '../hooks/use-electron';
import type { Meeting, ActionItem, CalendarEvent } from '@shared/types';

export default function DashboardPage() {
  const electron = useElectron();
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [pendingActions, setPendingActions] = useState<ActionItem[]>([]);
  const [upcomingCalendar, setUpcomingCalendar] = useState<CalendarEvent[]>([]);
  useEffect(() => {
    if (!electron) return;

    electron.listMeetings().then((m) => setMeetings(m.slice(0, 5)));
    electron.listActionItems().then((items) =>
      setPendingActions(items.filter((a) => !a.completed).slice(0, 5))
    );

    // Listen for upcoming calendar events
    const unsub = electron.onCalendarUpcoming((events) => {
      setUpcomingCalendar(events.slice(0, 3));
    });

    return unsub;
  }, [electron]);

  return (
    <div className="max-w-4xl space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Your meeting intelligence hub</p>
      </div>

      {/* Quick start */}
      <button
        onClick={() => router.push('/record')}
        className="w-full bg-card rounded-lg p-6 text-left transition-all duration-150 group hover:shadow-elevated hover:-translate-y-0.5"
      >
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent/15 transition-colors duration-150">
            <svg className="w-6 h-6 text-accent" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2H3v2a9 9 0 004 7.46V22H8v2h8v-2h-3v-2.54A9 9 0 0021 12v-2h-2z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-foreground">Start Meeting</p>
            <p className="text-sm text-muted-foreground mt-0.5">Record, transcribe, and analyze</p>
          </div>
        </div>
      </button>

      {/* Upcoming meetings from calendar */}
      {upcomingCalendar.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-4">Upcoming Meetings</h2>
          <div className="space-y-1.5">
            {upcomingCalendar.map((event) => {
              const startDate = new Date(event.startTime);
              const minutesUntil = Math.max(0, Math.round((startDate.getTime() - Date.now()) / 60000));
              return (
                <div
                  key={event.eventId}
                  className="bg-card rounded-md p-4 flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      {' '}
                      {minutesUntil <= 0
                        ? '- Starting now'
                        : `- in ${minutesUntil}min`}
                      {event.attendees.length > 0 &&
                        ` - ${event.attendees.length} attendee${event.attendees.length === 1 ? '' : 's'}`}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      try {
                        sessionStorage.setItem('calendarEvent', JSON.stringify(event));
                      } catch {}
                      router.push('/record');
                    }}
                    className="ml-4 text-xs px-3 py-1.5 bg-accent/10 text-accent rounded-md hover:bg-accent/20 transition-colors duration-100 shrink-0"
                  >
                    Record
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5">
        <StatCard label="Total Meetings" value={meetings.length.toString()} />
        <StatCard label="Pending Actions" value={pendingActions.length.toString()} />
        <StatCard
          label="This Week"
          value={meetings.filter((m) => {
            const d = new Date(m.started_at);
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return d >= weekAgo;
          }).length.toString()}
        />
      </div>

      {/* Recent meetings */}
      {meetings.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-4">Recent Meetings</h2>
          <div className="space-y-1.5">
            {meetings.map((m) => (
              <button
                key={m.id}
                onClick={() => router.push(`/meetings/detail?id=${m.id}`)}
                className="w-full bg-card hover:bg-muted/50 rounded-md p-4 text-left transition-colors duration-100"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{m.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(m.started_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                      {m.duration_secs && ` - ${Math.round(m.duration_secs / 60)}min`}
                    </p>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pending action items */}
      {pendingActions.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-4">Pending Action Items</h2>
          <div className="space-y-1">
            {pendingActions.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 bg-card rounded-md p-3.5"
              >
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => {
                    electron?.toggleActionItem(item.id);
                    setPendingActions((prev) => prev.filter((a) => a.id !== item.id));
                  }}
                  className="w-4 h-4 rounded accent-accent"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.description}</p>
                  {item.owner && (
                    <p className="text-xs text-muted-foreground mt-0.5">@{item.owner}</p>
                  )}
                </div>
                <PriorityBadge priority={item.priority} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-lg p-5">
      <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-1.5 uppercase tracking-wider">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-success/10 text-success',
    recording: 'bg-accent/10 text-accent',
    analyzing: 'bg-warning/10 text-warning',
    error: 'bg-accent/10 text-accent',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles[status] || styles.error}`}>
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    high: 'text-accent',
    medium: 'text-warning',
    low: 'text-muted-foreground',
  };
  return (
    <span className={`text-xs font-medium ${styles[priority] || ''}`}>
      {priority}
    </span>
  );
}
