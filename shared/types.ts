// Shared types between main and renderer

export interface Meeting {
  id: string;
  title: string;
  started_at: string;
  ended_at: string | null;
  duration_secs: number | null;
  audio_path: string | null;
  status: 'recording' | 'analyzing' | 'completed' | 'error';
  created_at: string;
}

export interface TranscriptSegment {
  id: number;
  meeting_id: string;
  speaker_label: string;
  content: string;
  start_time: number;
  end_time: number;
  confidence: number;
  is_final: boolean;
}

export interface MeetingNotes {
  id: number;
  meeting_id: string;
  executive_summary: string;
  key_takeaways: string[];
  discussion_topics: DiscussionTopic[];
  next_steps: string[];
  meeting_type: string;
  sentiment: string;
}

export interface DiscussionTopic {
  title: string;
  summary: string;
  details: string[];
}

export interface ActionItem {
  id: number;
  meeting_id: string;
  description: string;
  owner: string | null;
  due_date: string | null;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
}

export interface Decision {
  id: number;
  meeting_id: string;
  description: string;
  context: string | null;
  decided_by: string | null;
}

export interface Attendee {
  id: number;
  meeting_id: string;
  name: string;
  role: string | null;
  speaker_label: string | null;
}

export interface MeetingDetail extends Meeting {
  notes: MeetingNotes | null;
  action_items: ActionItem[];
  decisions: Decision[];
  attendees: Attendee[];
  transcript: TranscriptSegment[];
}

export interface AppSettings {
  deepgramApiKey: string;
  anthropicApiKey: string;
  claudeModel: string;
  audioDeviceId: string | null;
  storagePath: string;
}

export interface RecordingStatus {
  isRecording: boolean;
  meetingId: string | null;
  duration: number;
}

export interface AnalysisProgress {
  meetingId: string;
  stage: 'preparing' | 'analyzing' | 'saving' | 'complete';
  message: string;
}

// Electron API exposed via preload
export interface ElectronAPI {
  // Recording
  startRecording: () => Promise<{ meetingId: string }>;
  stopRecording: () => Promise<{ meetingId: string }>;
  sendAudioChunk: (chunk: ArrayBuffer) => void;
  onRecordingStatus: (callback: (status: RecordingStatus) => void) => () => void;

  // Transcription
  onTranscriptInterim: (callback: (segment: TranscriptSegment) => void) => () => void;
  onTranscriptFinal: (callback: (segment: TranscriptSegment) => void) => () => void;
  onTranscriptError: (callback: (error: string) => void) => () => void;

  // Analysis
  startAnalysis: (meetingId: string) => Promise<void>;
  onAnalysisProgress: (callback: (progress: AnalysisProgress) => void) => () => void;
  onAnalysisComplete: (callback: (meetingId: string) => void) => () => void;
  onAnalysisError: (callback: (error: string) => void) => () => void;

  // Meetings
  listMeetings: () => Promise<Meeting[]>;
  getMeeting: (id: string) => Promise<MeetingDetail>;
  deleteMeeting: (id: string) => Promise<void>;
  searchMeetings: (query: string) => Promise<Meeting[]>;
  renameMeeting: (id: string, title: string) => Promise<void>;

  // Action Items
  listActionItems: (meetingId?: string) => Promise<ActionItem[]>;
  toggleActionItem: (id: number) => Promise<void>;
  updateActionItem: (id: number, updates: Partial<ActionItem>) => Promise<void>;

  // Export
  exportMarkdown: (meetingId: string) => Promise<string>;
  exportPDF: (meetingId: string) => Promise<string>;
  exportClipboard: (meetingId: string) => Promise<void>;
  exportGoogleDocs: (meetingId: string) => Promise<string>;
  getGoogleDocsStatus: () => Promise<{ configured: boolean; authenticated: boolean }>;

  // Settings
  getSettings: () => Promise<AppSettings>;
  setSettings: (settings: Partial<AppSettings>) => Promise<void>;
  validateApiKeys: (keys: { deepgram?: string; anthropic?: string }) => Promise<{ deepgram: boolean; anthropic: boolean }>;
  listAudioDevices: () => Promise<{ deviceId: string; label: string }[]>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
