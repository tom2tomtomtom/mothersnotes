// All IPC channel names - single source of truth
export const IPC = {
  // Recording
  RECORDING_START: 'recording:start',
  RECORDING_STOP: 'recording:stop',
  RECORDING_AUDIO_CHUNK: 'recording:audio-chunk',
  RECORDING_STATUS: 'recording:status',

  // Transcription
  TRANSCRIPT_INTERIM: 'transcript:interim',
  TRANSCRIPT_FINAL: 'transcript:final',
  TRANSCRIPT_ERROR: 'transcript:error',

  // Analysis
  ANALYSIS_START: 'analysis:start',
  ANALYSIS_PROGRESS: 'analysis:progress',
  ANALYSIS_COMPLETE: 'analysis:complete',
  ANALYSIS_ERROR: 'analysis:error',

  // Meetings
  MEETINGS_LIST: 'meetings:list',
  MEETINGS_GET: 'meetings:get',
  MEETINGS_DELETE: 'meetings:delete',
  MEETINGS_SEARCH: 'meetings:search',
  MEETINGS_RENAME: 'meetings:rename',

  // Action Items
  ACTION_ITEMS_LIST: 'action-items:list',
  ACTION_ITEMS_TOGGLE: 'action-items:toggle',
  ACTION_ITEMS_UPDATE: 'action-items:update',

  // Export
  EXPORT_MARKDOWN: 'export:markdown',
  EXPORT_PDF: 'export:pdf',
  EXPORT_CLIPBOARD: 'export:clipboard',
  EXPORT_GOOGLE_DOCS: 'export:google-docs',
  EXPORT_GOOGLE_DOCS_STATUS: 'export:google-docs-status',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_VALIDATE_KEYS: 'settings:validate-keys',
  SETTINGS_LIST_AUDIO_DEVICES: 'settings:list-audio-devices',
} as const;

export type IPCChannel = (typeof IPC)[keyof typeof IPC];
