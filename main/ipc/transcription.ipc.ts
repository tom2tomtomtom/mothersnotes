// Transcription IPC events are sent directly from deepgram.service.ts
// This file is a placeholder for any future transcription-specific handlers

export function registerTranscriptionIPC(): void {
  // Transcript events (interim, final, error) are pushed from deepgramService
  // No invoke handlers needed - all events are push-based via webContents.send
}
