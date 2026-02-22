'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useElectron } from '../hooks/use-electron';
import type { Meeting, ActionItem } from '@shared/types';

export default function DashboardPage() {
  const electron = useElectron();
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [pendingActions, setPendingActions] = useState<ActionItem[]>([]);
  const [hasKeys, setHasKeys] = useState(true);

  useEffect(() => {
    if (!electron) return;

    electron.listMeetings().then((m) => setMeetings(m.slice(0, 5)));
    electron.listActionItems().then((items) =>
      setPendingActions(items.filter((a) => !a.completed).slice(0, 5))
    );
    electron.getSettings().then((s) => {
      setHasKeys(Boolean(s.deepgramApiKey && s.anthropicApiKey));
    });
  }, [electron]);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Your meeting intelligence hub</p>
      </div>

      {!hasKeys && (
        <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
          <p className="text-sm text-accent font-medium">Setup Required</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add your Deepgram and Anthropic API keys to get started.
          </p>
          <button
            onClick={() => router.push('/settings')}
            className="mt-2 text-sm text-accent hover:underline"
          >
            Go to Settings
          </button>
        </div>
      )}

      {/* Quick start */}
      <button
        onClick={() => router.push('/record')}
        className="w-full bg-card hover:bg-muted border border-border rounded-lg p-6 text-left transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
            <svg className="w-6 h-6 text-accent" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2H3v2a9 9 0 004 7.46V22H8v2h8v-2h-3v-2.54A9 9 0 0021 12v-2h-2z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-foreground">Start Meeting</p>
            <p className="text-sm text-muted-foreground">Record, transcribe, and analyze</p>
          </div>
        </div>
      </button>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
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
          <h2 className="text-lg font-semibold mb-3">Recent Meetings</h2>
          <div className="space-y-2">
            {meetings.map((m) => (
              <button
                key={m.id}
                onClick={() => router.push(`/meetings/detail?id=${m.id}`)}
                className="w-full bg-card hover:bg-muted border border-border rounded-lg p-4 text-left transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{m.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
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
          <h2 className="text-lg font-semibold mb-3">Pending Action Items</h2>
          <div className="space-y-1">
            {pendingActions.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 bg-card border border-border rounded-lg p-3"
              >
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => {
                    electron?.toggleActionItem(item.id);
                    setPendingActions((prev) => prev.filter((a) => a.id !== item.id));
                  }}
                  className="w-4 h-4 rounded border-border accent-accent"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.description}</p>
                  {item.owner && (
                    <p className="text-xs text-muted-foreground">@{item.owner}</p>
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
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
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
