'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useElectron } from '@/hooks/use-electron';
import type { MeetingDetail } from '@shared/types';

function MeetingDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const electron = useElectron();
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'discussion' | 'actions' | 'decisions' | 'transcript'>('summary');
  const [loading, setLoading] = useState(true);

  const meetingId = searchParams.get('id');

  useEffect(() => {
    if (!electron || !meetingId) return;
    electron.getMeeting(meetingId).then((m) => {
      setMeeting(m);
      setLoading(false);
    });
  }, [electron, meetingId]);

  const handleExport = async (format: 'markdown' | 'pdf' | 'clipboard') => {
    if (!electron || !meetingId) return;
    if (format === 'markdown') await electron.exportMarkdown(meetingId);
    else if (format === 'pdf') await electron.exportPDF(meetingId);
    else await electron.exportClipboard(meetingId);
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  }

  if (!meeting) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Meeting not found</p>
        <button onClick={() => router.push('/meetings')} className="text-accent text-sm mt-2">
          Back to meetings
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'summary' as const, label: 'Summary' },
    { id: 'discussion' as const, label: 'Discussion', count: meeting.notes?.discussion_topics?.length },
    { id: 'actions' as const, label: 'Action Items', count: meeting.action_items.length },
    { id: 'decisions' as const, label: 'Decisions', count: meeting.decisions.length },
    { id: 'transcript' as const, label: 'Transcript', count: meeting.transcript.length },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push('/meetings')}
            className="text-sm text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
          <h1 className="text-2xl font-bold">{meeting.title}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-muted-foreground">
              {new Date(meeting.started_at).toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              })}
            </span>
            {meeting.duration_secs && (
              <span className="text-sm text-muted-foreground">
                {Math.round(meeting.duration_secs / 60)} min
              </span>
            )}
            {meeting.notes?.meeting_type && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {meeting.notes.meeting_type}
              </span>
            )}
          </div>
        </div>

        {/* Export */}
        <div className="flex gap-2">
          <button onClick={() => handleExport('clipboard')} className="text-sm px-3 py-1.5 border border-border rounded-lg hover:bg-muted transition-colors">Copy</button>
          <button onClick={() => handleExport('markdown')} className="text-sm px-3 py-1.5 border border-border rounded-lg hover:bg-muted transition-colors">.md</button>
          <button onClick={() => handleExport('pdf')} className="text-sm px-3 py-1.5 border border-border rounded-lg hover:bg-muted transition-colors">PDF</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {activeTab === 'summary' && <SummaryTab meeting={meeting} />}
        {activeTab === 'discussion' && <DiscussionTab meeting={meeting} />}
        {activeTab === 'actions' && <ActionsTab meeting={meeting} />}
        {activeTab === 'decisions' && <DecisionsTab meeting={meeting} />}
        {activeTab === 'transcript' && <TranscriptTab meeting={meeting} />}
      </div>
    </div>
  );
}

export default function MeetingDetailPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Loading...</div>}>
      <MeetingDetailContent />
    </Suspense>
  );
}

// --- Tab Components ---

function SummaryTab({ meeting }: { meeting: MeetingDetail }) {
  return (
    <div className="space-y-6">
      {meeting.attendees.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Attendees</h3>
          <div className="flex flex-wrap gap-2">
            {meeting.attendees.map((a, i) => (
              <span key={i} className="text-sm bg-card border border-border rounded-full px-3 py-1">
                {a.name}{a.role && <span className="text-muted-foreground ml-1">({a.role})</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {meeting.notes?.executive_summary && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Executive Summary</h3>
          <p className="text-foreground leading-relaxed bg-card border border-border rounded-lg p-4">
            {meeting.notes.executive_summary}
          </p>
        </div>
      )}

      {meeting.notes?.key_takeaways?.length ? (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Key Takeaways</h3>
          <ul className="space-y-2">
            {meeting.notes.key_takeaways.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm"><span className="text-accent">-</span><span>{t}</span></li>
            ))}
          </ul>
        </div>
      ) : null}

      {meeting.notes?.next_steps?.length ? (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Next Steps</h3>
          <ul className="space-y-2">
            {meeting.notes.next_steps.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm"><span className="text-accent">-</span><span>{s}</span></li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function DiscussionTab({ meeting }: { meeting: MeetingDetail }) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  if (!meeting.notes?.discussion_topics?.length) {
    return <p className="text-muted-foreground text-sm">No discussion topics recorded</p>;
  }

  return (
    <div className="space-y-3">
      {meeting.notes.discussion_topics.map((topic, i) => (
        <div key={i} className="bg-card border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setExpanded((p) => ({ ...p, [i]: !p[i] }))}
            className="w-full text-left p-4 flex items-center justify-between hover:bg-muted transition-colors"
          >
            <div>
              <p className="font-medium text-sm">{topic.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{topic.summary}</p>
            </div>
            <svg className={`w-4 h-4 text-muted-foreground transition-transform ${expanded[i] ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {expanded[i] && topic.details?.length > 0 && (
            <div className="px-4 pb-4 border-t border-border pt-3">
              <ul className="space-y-1.5">
                {topic.details.map((d, j) => (
                  <li key={j} className="text-sm text-muted-foreground flex gap-2"><span className="text-accent">-</span>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ActionsTab({ meeting }: { meeting: MeetingDetail }) {
  const electron = useElectron();
  const [items, setItems] = useState(meeting.action_items);

  const handleToggle = async (id: number) => {
    await electron?.toggleActionItem(id);
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, completed: !a.completed } : a)));
  };

  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">No action items recorded</p>;
  }

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...items].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
  });

  return (
    <div className="space-y-2">
      {sorted.map((item) => (
        <div key={item.id} className={`flex items-start gap-3 bg-card border border-border rounded-lg p-4 transition-opacity ${item.completed ? 'opacity-50' : ''}`}>
          <input type="checkbox" checked={item.completed} onChange={() => handleToggle(item.id)} className="w-4 h-4 mt-0.5 rounded accent-accent" />
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${item.completed ? 'line-through' : ''}`}>{item.description}</p>
            <div className="flex items-center gap-3 mt-1">
              {item.owner && <span className="text-xs text-muted-foreground">@{item.owner}</span>}
              {item.due_date && <span className="text-xs text-muted-foreground">Due: {item.due_date}</span>}
            </div>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            item.priority === 'high' ? 'bg-accent/10 text-accent' : item.priority === 'medium' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'
          }`}>{item.priority}</span>
        </div>
      ))}
    </div>
  );
}

function DecisionsTab({ meeting }: { meeting: MeetingDetail }) {
  if (meeting.decisions.length === 0) {
    return <p className="text-muted-foreground text-sm">No decisions recorded</p>;
  }
  return (
    <div className="space-y-3">
      {meeting.decisions.map((d, i) => (
        <div key={i} className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm font-medium">{d.description}</p>
          {d.context && <p className="text-xs text-muted-foreground mt-1">{d.context}</p>}
          {d.decided_by && <p className="text-xs text-muted-foreground mt-1">Decided by: {d.decided_by}</p>}
        </div>
      ))}
    </div>
  );
}

function TranscriptTab({ meeting }: { meeting: MeetingDetail }) {
  const [searchTerm, setSearchTerm] = useState('');
  const filtered = searchTerm
    ? meeting.transcript.filter((s) => s.content.toLowerCase().includes(searchTerm.toLowerCase()))
    : meeting.transcript;

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Search transcript..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full bg-card border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-accent/50"
      />
      <div className="space-y-1 max-h-[600px] overflow-y-auto">
        {filtered.map((seg, i) => (
          <div key={i} className="text-sm py-1.5">
            <span className="text-accent font-medium text-xs">{seg.speaker_label}</span>
            <span className="text-muted-foreground text-xs ml-2">
              {Math.floor(seg.start_time / 60)}:{Math.floor(seg.start_time % 60).toString().padStart(2, '0')}
            </span>
            <p className="text-foreground mt-0.5">{seg.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
