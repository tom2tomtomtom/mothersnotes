import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';
import type { ElectronAPI } from '../shared/types';

function onEvent(channel: string, callback: (...args: any[]) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, ...args: any[]) => callback(...args);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const electronAPI: ElectronAPI = {
  // Recording
  startRecording: () => ipcRenderer.invoke(IPC.RECORDING_START),
  stopRecording: () => ipcRenderer.invoke(IPC.RECORDING_STOP),
  sendAudioChunk: (chunk: ArrayBuffer) => ipcRenderer.send(IPC.RECORDING_AUDIO_CHUNK, chunk),
  onRecordingStatus: (cb) => onEvent(IPC.RECORDING_STATUS, cb),

  // Transcription
  onTranscriptInterim: (cb) => onEvent(IPC.TRANSCRIPT_INTERIM, cb),
  onTranscriptFinal: (cb) => onEvent(IPC.TRANSCRIPT_FINAL, cb),
  onTranscriptError: (cb) => onEvent(IPC.TRANSCRIPT_ERROR, cb),

  // Analysis
  startAnalysis: (meetingId) => ipcRenderer.invoke(IPC.ANALYSIS_START, meetingId),
  onAnalysisProgress: (cb) => onEvent(IPC.ANALYSIS_PROGRESS, cb),
  onAnalysisComplete: (cb) => onEvent(IPC.ANALYSIS_COMPLETE, cb),
  onAnalysisError: (cb) => onEvent(IPC.ANALYSIS_ERROR, cb),

  // Meetings
  listMeetings: () => ipcRenderer.invoke(IPC.MEETINGS_LIST),
  getMeeting: (id) => ipcRenderer.invoke(IPC.MEETINGS_GET, id),
  deleteMeeting: (id) => ipcRenderer.invoke(IPC.MEETINGS_DELETE, id),
  searchMeetings: (query) => ipcRenderer.invoke(IPC.MEETINGS_SEARCH, query),
  renameMeeting: (id, title) => ipcRenderer.invoke(IPC.MEETINGS_RENAME, id, title),

  // Action Items
  listActionItems: (meetingId) => ipcRenderer.invoke(IPC.ACTION_ITEMS_LIST, meetingId),
  toggleActionItem: (id) => ipcRenderer.invoke(IPC.ACTION_ITEMS_TOGGLE, id),
  updateActionItem: (id, updates) => ipcRenderer.invoke(IPC.ACTION_ITEMS_UPDATE, id, updates),

  // Export
  exportMarkdown: (meetingId) => ipcRenderer.invoke(IPC.EXPORT_MARKDOWN, meetingId),
  exportPDF: (meetingId) => ipcRenderer.invoke(IPC.EXPORT_PDF, meetingId),
  exportClipboard: (meetingId) => ipcRenderer.invoke(IPC.EXPORT_CLIPBOARD, meetingId),
  exportGoogleDocs: (meetingId) => ipcRenderer.invoke(IPC.EXPORT_GOOGLE_DOCS, meetingId),
  getGoogleDocsStatus: () => ipcRenderer.invoke(IPC.EXPORT_GOOGLE_DOCS_STATUS),

  // Settings
  getSettings: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
  setSettings: (settings) => ipcRenderer.invoke(IPC.SETTINGS_SET, settings),
  validateApiKeys: (keys) => ipcRenderer.invoke(IPC.SETTINGS_VALIDATE_KEYS, keys),
  listAudioDevices: () => ipcRenderer.invoke(IPC.SETTINGS_LIST_AUDIO_DEVICES),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
