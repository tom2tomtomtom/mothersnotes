'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useElectron } from '../../hooks/use-electron';
import type { CalendarEvent, CalendarStatus } from '@shared/types';

type TimeRange = 'today' | 'tomorrow' | 'week';

export default function CalendarPage() {
  const electron = useElectron();
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [scheduledIds, setScheduledIds] = useState<Set<string>>(new Set());
  const [timeRange, setTimeRange] = useState<TimeRange>('today');

  const fetchEvents = useCallback(async (range: TimeRange) => {
    if (!electron) return;
    const days = range === 'today' ? 1 : range === 'tomorrow' ? 2 : 7;
    setLoading(true);
    try {
      const [data, scheduled] = await Promise.all([
        electron.calendarFetchEvents(days),
        electron.calendarGetScheduled(),
      ]);
      setEvents(data);
      setScheduledIds(new Set(scheduled.map((e) => e.eventId)));
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }, [electron]);

  useEffect(() => {
    if (!electron) return;
    electron.calendarGetStatus().then((s) => {
      setStatus(s);
      if (s.authenticated) fetchEvents(timeRange);
      else setLoading(false);
    });
  }, [electron]);

  useEffect(() => {
    if (status?.authenticated) fetchEvents(timeRange);
  }, [timeRange]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!status?.authenticated) return;
    const interval = setInterval(() => fetchEvents(timeRange), 60_000);
    return () => clearInterval(interval);
  }, [status?.authenticated, timeRange, fetchEvents]);

  const toggleSchedule = async (event: CalendarEvent) => {
    if (!electron) return;
    if (scheduledIds.has(event.eventId)) {
      await electron.calendarUnschedule([event.eventId]);
      setScheduledIds((prev) => {
        const next = new Set(prev);
        next.delete(event.eventId);
        return next;
      });
    } else {
      await electron.calendarSchedule([event]);
      setScheduledIds((prev) => new Set(prev).add(event.eventId));
    }
  };

  const scheduleAll = async () => {
    if (!electron) return;
    const futureEvents = events.filter((e) => new Date(e.endTime).getTime() > Date.now());
    await electron.calendarSchedule(futureEvents);
    setScheduledIds(new Set(futureEvents.map((e) => e.eventId)));
  };

  const unscheduleAll = async () => {
    if (!electron) return;
    await electron.calendarUnschedule(events.map((e) => e.eventId));
    setScheduledIds(new Set());
  };

  const recordNow = (event: CalendarEvent) => {
    try {
      sessionStorage.setItem('calendarEvent', JSON.stringify(event));
    } catch {}
    router.push('/record');
  };

  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Track refresh times
  useEffect(() => {
    if (!loading && events.length >= 0) setLastRefresh(new Date());
  }, [events]);

  const scheduledCount = events.filter((e) => scheduledIds.has(e.eventId)).length;
  const allScheduled = events.length > 0 && scheduledCount === events.length;

  // Not connected
  if (status && !status.authenticated) {
    return (
      <div className="max-w-3xl mx-auto space-y-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground mt-2">Connect Google Calendar to see your meetings</p>
        </div>
        <div className="bg-card rounded-lg p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
            <CalendarIcon className="w-8 h-8 text-accent" />
          </div>
          <p className="text-sm text-muted-foreground">
            {status.configured
              ? 'Connect your Google account to view upcoming meetings'
              : 'Add Google credentials to .env.local first'}
          </p>
          {status.configured && (
            <button
              onClick={() => router.push('/settings')}
              className="text-sm px-4 py-2.5 bg-foreground text-background rounded-md hover:opacity-90 transition-opacity duration-100"
            >
              Go to Settings
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground mt-2">
            {scheduledCount > 0
              ? `${scheduledCount} meeting${scheduledCount !== 1 ? 's' : ''} scheduled for recording`
              : 'Pick meetings to auto-record'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && !loading && (
            <span className="text-xs text-muted-foreground/50">
              {lastRefresh.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => fetchEvents(timeRange)}
            disabled={loading}
            className="text-sm px-3 py-2 bg-card rounded-md hover:bg-muted transition-colors duration-100 disabled:opacity-40"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Time range tabs */}
      <div className="flex gap-1 bg-card rounded-md p-1 w-fit">
        {(['today', 'tomorrow', 'week'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded text-sm capitalize transition-colors duration-100 ${
              timeRange === range
                ? 'bg-foreground text-background font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {range}
          </button>
        ))}
      </div>

      {/* Select all / none bar */}
      {events.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={allScheduled ? unscheduleAll : scheduleAll}
            className="text-xs px-3 py-1.5 bg-card rounded-md hover:bg-muted transition-colors duration-100"
          >
            {allScheduled ? 'Unschedule all' : 'Schedule all for recording'}
          </button>
          {scheduledCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {scheduledCount} of {events.length} scheduled
            </span>
          )}
        </div>
      )}

      {/* Events list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-lg p-5 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="bg-card rounded-lg p-8 text-center">
          <p className="text-sm text-muted-foreground">No meetings found for this time range</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => {
            const start = new Date(event.startTime);
            const end = new Date(event.endTime);
            const isToday = new Date().toDateString() === start.toDateString();
            const now = Date.now();
            const startMs = start.getTime();
            const minutesUntil = Math.round((startMs - now) / 60000);
            const isLive = now >= startMs && now <= end.getTime();
            const isPast = now > end.getTime();
            const isScheduled = scheduledIds.has(event.eventId);

            return (
              <div
                key={event.eventId}
                className={`bg-card rounded-lg p-5 transition-all duration-150 border-2 ${
                  isScheduled
                    ? 'border-accent/50 bg-accent/5'
                    : 'border-transparent'
                } ${isPast ? 'opacity-40' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    {/* Schedule toggle */}
                    <div className="pt-0.5">
                      <button
                        onClick={() => toggleSchedule(event)}
                        disabled={isPast}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all duration-150 ${
                          isScheduled
                            ? 'bg-accent border-accent'
                            : 'border-muted-foreground/30 hover:border-accent/50'
                        } disabled:opacity-30 disabled:cursor-not-allowed`}
                      >
                        {isScheduled && (
                          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Title */}
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{event.title}</p>
                        {isLive && (
                          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-medium uppercase tracking-wider">
                            Live
                          </span>
                        )}
                        {isScheduled && !isLive && !isPast && (
                          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-success/15 text-success font-medium uppercase tracking-wider">
                            Scheduled
                          </span>
                        )}
                      </div>

                      {/* Time */}
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {!isToday && (
                          <span>
                            {start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            {' \u00b7 '}
                          </span>
                        )}
                        {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        {' \u2013 '}
                        {end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        {!isPast && isToday && (
                          <span className="text-foreground/60">
                            {' \u00b7 '}
                            {minutesUntil <= 0 ? 'now' : `in ${minutesUntil}min`}
                          </span>
                        )}
                      </p>

                      {/* Attendees */}
                      {event.attendees.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <div className="flex -space-x-1.5">
                            {event.attendees.slice(0, 4).map((name, i) => (
                              <div
                                key={i}
                                className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium text-muted-foreground ring-2 ring-card"
                                title={name}
                              >
                                {name.charAt(0).toUpperCase()}
                              </div>
                            ))}
                            {event.attendees.length > 4 && (
                              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium text-muted-foreground ring-2 ring-card">
                                +{event.attendees.length - 4}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {event.attendees.slice(0, 2).join(', ')}
                            {event.attendees.length > 2 && ` +${event.attendees.length - 2}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {event.meetingLink && (
                      <a
                        href={event.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2.5 py-1.5 bg-muted rounded-md hover:bg-muted/80 transition-colors duration-100"
                        title="Open meeting link"
                      >
                        Join
                      </a>
                    )}
                    {!isPast && (
                      <button
                        onClick={() => recordNow(event)}
                        className="text-xs px-3 py-1.5 bg-accent/10 text-accent rounded-md hover:bg-accent/20 transition-colors duration-100"
                      >
                        Record now
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
