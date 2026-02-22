import { ipcMain } from 'electron';
import { v4 as uuid } from 'uuid';
import { IPC } from '../../shared/ipc-channels';
import { audioCaptureService } from '../services/audio-capture.service';
import { deepgramService } from '../services/deepgram.service';
import { meetingsRepo } from '../database/repositories/meetings.repo';
import { settingsService } from '../services/settings.service';
import { getMainWindow } from '../index';

let currentMeetingId: string | null = null;
let recordingStartTime: number | null = null;
let statusInterval: ReturnType<typeof setInterval> | null = null;

export function registerRecordingIPC(): void {
  ipcMain.handle(IPC.RECORDING_START, async () => {
    if (currentMeetingId) {
      throw new Error('Already recording');
    }

    const settings = settingsService.getAll();
    if (!settings.deepgramApiKey) {
      throw new Error('Deepgram API key not configured. Please add it in Settings.');
    }

    const meetingId = uuid();
    currentMeetingId = meetingId;
    recordingStartTime = Date.now();

    // Create meeting record
    meetingsRepo.create(meetingId);

    // Start WAV writer
    const audioPath = audioCaptureService.startRecording(meetingId);
    meetingsRepo.update(meetingId, { audio_path: audioPath } as any);

    // Start Deepgram
    await deepgramService.start(settings.deepgramApiKey, meetingId);

    // Send status updates
    statusInterval = setInterval(() => {
      const win = getMainWindow();
      if (win && currentMeetingId && recordingStartTime) {
        win.webContents.send(IPC.RECORDING_STATUS, {
          isRecording: true,
          meetingId: currentMeetingId,
          duration: Math.floor((Date.now() - recordingStartTime) / 1000),
        });
      }
    }, 1000);

    return { meetingId };
  });

  ipcMain.handle(IPC.RECORDING_STOP, async () => {
    if (!currentMeetingId) {
      throw new Error('Not recording');
    }

    const meetingId = currentMeetingId;
    const duration = recordingStartTime ? Math.floor((Date.now() - recordingStartTime) / 1000) : 0;

    // Stop status updates
    if (statusInterval) {
      clearInterval(statusInterval);
      statusInterval = null;
    }

    // Stop services
    await deepgramService.stop();
    audioCaptureService.stopRecording();

    // Update meeting record
    meetingsRepo.update(meetingId, {
      ended_at: new Date().toISOString(),
      duration_secs: duration,
      status: 'analyzing',
    } as any);

    currentMeetingId = null;
    recordingStartTime = null;

    // Send final status
    const win = getMainWindow();
    if (win) {
      win.webContents.send(IPC.RECORDING_STATUS, {
        isRecording: false,
        meetingId: null,
        duration: 0,
      });
    }

    return { meetingId };
  });

  ipcMain.on(IPC.RECORDING_AUDIO_CHUNK, (_event, chunk: ArrayBuffer) => {
    const buffer = Buffer.from(chunk);
    audioCaptureService.writeChunk(buffer);
    deepgramService.sendAudio(buffer);
  });
}
