import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import type { LiveClient } from '@deepgram/sdk';
import { getMainWindow } from '../index';
import { IPC } from '../../shared/ipc-channels';
import { transcriptsRepo } from '../database/repositories/transcripts.repo';

let dgConnection: LiveClient | null = null;
let currentMeetingId: string | null = null;

export const deepgramService = {
  async start(apiKey: string, meetingId: string): Promise<void> {
    currentMeetingId = meetingId;
    const deepgram = createClient(apiKey);

    const connection = deepgram.listen.live({
      model: 'nova-3',
      smart_format: true,
      diarize: true,
      interim_results: true,
      utterance_end_ms: 1000,
      vad_events: true,
      language: 'en',
      sample_rate: 16000,
      channels: 1,
      encoding: 'linear16',
    });

    dgConnection = connection;

    connection.on(LiveTranscriptionEvents.Open, () => {
      console.log('[Deepgram] Connection opened');
    });

    connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
      const win = getMainWindow();
      if (!win || !currentMeetingId) return;

      const alt = data.channel?.alternatives?.[0];
      if (!alt || !alt.transcript) return;

      const isFinal = data.is_final;
      const words = alt.words || [];
      const speakerLabel = words.length > 0 ? `Speaker ${words[0].speaker ?? 0}` : 'Speaker';

      const segment = {
        meeting_id: currentMeetingId,
        speaker_label: speakerLabel,
        content: alt.transcript,
        start_time: data.start || 0,
        end_time: (data.start || 0) + (data.duration || 0),
        confidence: alt.confidence || 0,
        is_final: isFinal,
      };

      if (isFinal && alt.transcript.trim()) {
        // Save final transcript to database
        transcriptsRepo.insert(segment);
        win.webContents.send(IPC.TRANSCRIPT_FINAL, segment);
      } else if (alt.transcript.trim()) {
        win.webContents.send(IPC.TRANSCRIPT_INTERIM, segment);
      }
    });

    connection.on(LiveTranscriptionEvents.Error, (error: any) => {
      console.error('[Deepgram] Error:', error);
      const win = getMainWindow();
      if (win) {
        win.webContents.send(IPC.TRANSCRIPT_ERROR, error.message || 'Transcription error');
      }
    });

    connection.on(LiveTranscriptionEvents.Close, () => {
      console.log('[Deepgram] Connection closed');
      dgConnection = null;
    });
  },

  sendAudio(pcmData: Buffer): void {
    if (dgConnection) {
      // Convert Buffer to ArrayBuffer for Deepgram SDK
      const ab = pcmData.buffer.slice(pcmData.byteOffset, pcmData.byteOffset + pcmData.byteLength);
      dgConnection.send(ab as any);
    }
  },

  async stop(): Promise<void> {
    if (dgConnection) {
      dgConnection.requestClose();
      dgConnection = null;
    }
    if (currentMeetingId) {
      transcriptsRepo.deleteInterim(currentMeetingId);
    }
    currentMeetingId = null;
  },
};
