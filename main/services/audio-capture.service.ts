import { app } from 'electron';
import path from 'path';
import { WavWriter } from '../utils/wav-writer';

let wavWriter: WavWriter | null = null;

export const audioCaptureService = {
  startRecording(meetingId: string): string {
    const audioDir = path.join(app.getPath('userData'), 'recordings');
    const filePath = path.join(audioDir, `${meetingId}.wav`);

    wavWriter = new WavWriter(filePath, 16000, 1, 16);
    wavWriter.open();

    return filePath;
  },

  writeChunk(pcmData: Buffer): void {
    if (wavWriter) {
      wavWriter.write(pcmData);
    }
  },

  stopRecording(): string | null {
    if (!wavWriter) return null;
    const filePath = wavWriter.close();
    wavWriter = null;
    return filePath;
  },
};
