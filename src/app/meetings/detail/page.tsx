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
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [googleDocsConfigured, setGoogleDocsConfigured] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const meetingId = searchParams.get('id');

  useEffect(() => {
    if (!electron || !meetingId) return;
    electron.getMeeting(meetingId).then((m) => {
      setMeeting(m);
      setLoading(false);
    });
    electron.getGoogleDocsStatus().then((status) => {
      setGoogleDocsConfigured(status.configured);
    });
  }, [electron, meetingId]);

  const handleExport = async (format: 'markdown' | 'pdf' | 'clipboard' | 'google-docs') => {
    if (!electron || !meetingId) return;
    setExporting(format);
    try {
      if (format === 'markdown') await electron.exportMarkdown(meetingId);
      else if (format === 'pdf') await electron.exportPDF(meetingId);
      else if (format === 'google-docs') await electron.exportGoogleDocs(meetingId);
      else await electron.exportClipboard(meetingId);
    } finally {
      setExporting(null);
    }
  };

  const handleRename = async () => {
    if (!electron || !meetingId || !editTitle.trim()) {
      setIsEditing(false);
      return;
    }
    const newTitle = editTitle.trim();
    if (newTitle !== meeting?.title) {
      await electron.renameMeeting(meetingId, newTitle);
      setMeeting((prev) => prev ? { ...prev, title: newTitle } : prev);
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!electron || !meetingId) return;
    await electron.deleteMeeting(meetingId);
    router.push('/meetings');
  };

  if (loading) {
    return <div className="text-center py-16 text-muted-foreground">Loading...</div>;
  }

  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">Meeting not found</p>
        <button onClick={() => router.push('/meetings')} className="text-accent text-sm mt-3 hover:underline">
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
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <button
            onClick={() => router.push('/meetings')}
            className="text-sm text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1 transition-colors duration-100"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
          {isEditing ? (
            <input
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              onBlur={handleRename}
              className="text-3xl font-bold tracking-tight bg-transparent border-b-2 border-accent outline-none w-full"
            />
          ) : (
            <h1
              className="text-3xl font-bold tracking-tight cursor-pointer group flex items-center gap-2"
              onClick={() => { setEditTitle(meeting.title); setIsEditing(true); }}
            >
              <span className="truncate">{meeting.title}</span>
              <svg className="w-4 h-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
              </svg>
            </h1>
          )}
          <div className="flex items-center gap-3 mt-2">
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

        {/* Export + Delete */}
        <div className="flex gap-1.5 items-center shrink-0">
          <button onClick={() => handleExport('clipboard')} disabled={exporting === 'clipboard'} className="text-sm px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-card transition-colors duration-100 disabled:opacity-40">Copy</button>
          <button onClick={() => handleExport('markdown')} disabled={exporting === 'markdown'} className="text-sm px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-card transition-colors duration-100 disabled:opacity-40">.md</button>
          <button onClick={() => handleExport('pdf')} disabled={exporting === 'pdf'} className="text-sm px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-card transition-colors duration-100 disabled:opacity-40">PDF</button>
          {googleDocsConfigured && (
            <button onClick={() => handleExport('google-docs')} disabled={exporting === 'google-docs'} className="text-sm px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-card transition-colors duration-100 disabled:opacity-40">
              {exporting === 'google-docs' ? 'Opening...' : 'Google Docs'}
            </button>
          )}

          <div className="w-px h-5 bg-border mx-1" />

          {deleteConfirm ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Delete?</span>
              <button onClick={handleDelete} className="text-xs px-2.5 py-1.5 bg-accent/10 text-accent rounded-md hover:bg-accent/15 transition-colors duration-100">Yes</button>
              <button onClick={() => setDeleteConfirm(false)} className="text-xs px-2.5 py-1.5 bg-card text-muted-foreground rounded-md hover:bg-muted transition-colors duration-100">No</button>
            </div>
          ) : (
            <button onClick={() => setDeleteConfirm(true)} className="p-2 text-muted-foreground hover:text-accent transition-colors duration-100 rounded-md hover:bg-card" title="Delete meeting">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm rounded-md transition-colors duration-100 ${
              activeTab === tab.id
                ? 'bg-card text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`ml-1.5 text-xs ${activeTab === tab.id ? 'text-muted-foreground' : ''}`}>{tab.count}</span>
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
    <Suspense fallback={<div className="text-center py-16 text-muted-foreground">Loading...</div>}>
      <MeetingDetailContent />
    </Suspense>
  );
}

// --- Tab Components ---

function SummaryTab({ meeting }: { meeting: MeetingDetail }) {
  return (
    <div className="space-y-8">
      {meeting.attendees.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Attendees</h3>
          <div className="flex flex-wrap gap-2">
            {meeting.attendees.map((a, i) => (
              <span key={i} className="text-sm bg-card rounded-full px-3.5 py-1.5">
                {a.name}{a.role && <span className="text-muted-foreground ml-1">({a.role})</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {meeting.notes?.executive_summary && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Executive Summary</h3>
          <p className="text-foreground leading-relaxed bg-card rounded-lg p-5">
            {meeting.notes.executive_summary}
          </p>
        </div>
      )}

      {meeting.notes?.key_takeaways?.length ? (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Key Takeaways</h3>
          <ul className="space-y-2.5">
            {meeting.notes.key_takeaways.map((t, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="text-accent mt-0.5 shrink-0">-</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {meeting.notes?.next_steps?.length ? (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Next Steps</h3>
          <ul className="space-y-2.5">
            {meeting.notes.next_steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="text-accent mt-0.5 shrink-0">-</span>
                <span>{s}</span>
              </li>
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
    return <p className="text-muted-foreground text-sm py-8 text-center">No discussion topics recorded</p>;
  }

  return (
    <div className="space-y-2">
      {meeting.notes.discussion_topics.map((topic, i) => (
        <div key={i} className="bg-card rounded-lg overflow-hidden">
          <button
            onClick={() => setExpanded((p) => ({ ...p, [i]: !p[i] }))}
            className="w-full text-left p-5 flex items-center justify-between hover:bg-muted/30 transition-colors duration-100"
          >
            <div>
              <p className="font-medium text-sm">{topic.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{topic.summary}</p>
            </div>
            <svg className={`w-4 h-4 text-muted-foreground transition-transform duration-150 ${expanded[i] ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {expanded[i] && topic.details?.length > 0 && (
            <div className="px-5 pb-5 pt-0">
              <div className="border-t border-border pt-4">
                <ul className="space-y-2">
                  {topic.details.map((d, j) => (
                    <li key={j} className="text-sm text-muted-foreground flex gap-3">
                      <span className="text-accent shrink-0">-</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
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
    return <p className="text-muted-foreground text-sm py-8 text-center">No action items recorded</p>;
  }

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...items].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
  });

  return (
    <div className="space-y-1.5">
      {sorted.map((item) => (
        <div key={item.id} className={`flex items-start gap-3 bg-card rounded-lg p-4 transition-opacity duration-150 ${item.completed ? 'opacity-40' : ''}`}>
          <input type="checkbox" checked={item.completed} onChange={() => handleToggle(item.id)} className="w-4 h-4 mt-0.5 rounded accent-accent" />
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${item.completed ? 'line-through' : ''}`}>{item.description}</p>
            <div className="flex items-center gap-3 mt-1.5">
              {item.owner && <span className="text-xs text-muted-foreground">@{item.owner}</span>}
              {item.due_date && <span className="text-xs text-muted-foreground">Due: {item.due_date}</span>}
            </div>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            item.priority === 'high' ? 'bg-accent/10 text-accent' : item.priority === 'medium' ? 'bg-warning/10 text-warning' : 'text-muted-foreground'
          }`}>{item.priority}</span>
        </div>
      ))}
    </div>
  );
}

function DecisionsTab({ meeting }: { meeting: MeetingDetail }) {
  if (meeting.decisions.length === 0) {
    return <p className="text-muted-foreground text-sm py-8 text-center">No decisions recorded</p>;
  }
  return (
    <div className="space-y-2">
      {meeting.decisions.map((d, i) => (
        <div key={i} className="bg-card rounded-lg p-5">
          <p className="text-sm font-medium">{d.description}</p>
          {d.context && <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{d.context}</p>}
          {d.decided_by && <p className="text-xs text-muted-foreground mt-1.5">Decided by: {d.decided_by}</p>}
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
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search transcript..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full bg-card rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-shadow duration-150"
      />
      <div className="space-y-0.5 max-h-[600px] overflow-y-auto">
        {filtered.map((seg, i) => (
          <div key={i} className="text-sm py-2 px-3 rounded-md hover:bg-card/50 transition-colors duration-75">
            <span className="text-accent font-medium text-xs">{seg.speaker_label}</span>
            <span className="text-muted-foreground text-xs ml-2 tabular-nums">
              {Math.floor(seg.start_time / 60)}:{Math.floor(seg.start_time % 60).toString().padStart(2, '0')}
            </span>
            <p className="text-foreground mt-0.5 leading-relaxed">{seg.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
