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
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meetings</h1>
          <p className="text-muted-foreground mt-1">{meetings.length} meetings recorded</p>
        </div>
        <button
          onClick={() => router.push('/record')}
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          New Meeting
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
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
          className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent/50"
        />
      </div>

      {/* Meeting list */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : meetings.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No meetings yet</p>
          <button
            onClick={() => router.push('/record')}
            className="text-accent text-sm mt-2 hover:underline"
          >
            Record your first meeting
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {meetings.map((m) => (
            <div
              key={m.id}
              className="bg-card border border-border rounded-lg p-4 hover:bg-muted transition-colors group"
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => router.push(`/meetings/detail?id=${m.id}`)}
                  className="flex-1 text-left"
                >
                  <p className="font-medium">{m.title}</p>
                  <div className="flex items-center gap-3 mt-1">
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
                  className="opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-accent transition-all"
                  title="Delete meeting"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
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
