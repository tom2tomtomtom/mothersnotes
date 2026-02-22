'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useElectron } from '../../hooks/use-electron';
import type { Meeting } from '@shared/types';

export default function MeetingsPage() {
  const electron = useElectron();
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!electron) return;
    electron.listMeetings().then((m) => {
      setMeetings(m);
      setLoading(false);
    });
  }, [electron]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!electron) return;

    if (query.trim()) {
      const results = await electron.searchMeetings(query);
      setMeetings(results);
    } else {
      const all = await electron.listMeetings();
      setMeetings(all);
    }
  };

  const handleDelete = async (id: string) => {
    if (!electron) return;
    await electron.deleteMeeting(id);
    setMeetings((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meetings</h1>
          <p className="text-muted-foreground mt-2">{meetings.length} meetings recorded</p>
        </div>
        <button
          onClick={() => router.push('/record')}
          className="bg-foreground text-background px-4 py-2.5 rounded-md text-sm font-medium hover:opacity-90 transition-opacity duration-100"
        >
          New Meeting
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search meetings..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full bg-card rounded-md pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 transition-shadow duration-150"
        />
      </div>

      {/* Meeting list */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading...</div>
      ) : meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-12 w-12 rounded-lg bg-card flex items-center justify-center mb-4">
            <svg className="w-5 h-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
          </div>
          <p className="text-muted-foreground text-sm">No meetings yet</p>
          <button
            onClick={() => router.push('/record')}
            className="text-accent text-sm mt-3 hover:underline"
          >
            Record your first meeting
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {meetings.map((m) => (
            <div
              key={m.id}
              className="bg-card hover:bg-muted/50 rounded-md p-4 transition-colors duration-100 group"
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => router.push(`/meetings/detail?id=${m.id}`)}
                  className="flex-1 text-left"
                >
                  <p className="font-medium text-sm">{m.title}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-muted-foreground">
                      {new Date(m.started_at).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                    {m.duration_secs && (
                      <span className="text-xs text-muted-foreground">
                        {Math.round(m.duration_secs / 60)} min
                      </span>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        m.status === 'completed'
                          ? 'bg-success/10 text-success'
                          : m.status === 'analyzing'
                          ? 'bg-warning/10 text-warning'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-accent transition-all duration-100"
                  title="Delete meeting"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
