import fs from 'fs';
import path from 'path';

export class WavWriter {
  private fd: number | null = null;
  private dataSize = 0;
  private filePath: string;
  private sampleRate: number;
  private channels: number;
  private bitsPerSample: number;

  constructor(filePath: string, sampleRate = 16000, channels = 1, bitsPerSample = 16) {
    this.filePath = filePath;
    this.sampleRate = sampleRate;
    this.channels = channels;
    this.bitsPerSample = bitsPerSample;
  }

  open(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.fd = fs.openSync(this.filePath, 'w');
    this.dataSize = 0;
    // Write placeholder header (44 bytes)
    const header = Buffer.alloc(44);
    fs.writeSync(this.fd, header);
  }

  write(pcmData: Buffer): void {
    if (this.fd === null) return;
    fs.writeSync(this.fd, pcmData);
    this.dataSize += pcmData.length;
  }

  close(): string {
    if (this.fd === null) return this.filePath;

    // Write WAV header at beginning of file
    const header = this.buildHeader();
    const currentPos = fs.fstatSync(this.fd).size;
    fs.writeSync(this.fd, header, 0, 44, 0);
    fs.closeSync(this.fd);
    this.fd = null;

    return this.filePath;
  }

  private buildHeader(): Buffer {
    const byteRate = this.sampleRate * this.channels * (this.bitsPerSample / 8);
    const blockAlign = this.channels * (this.bitsPerSample / 8);
    const header = Buffer.alloc(44);

    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + this.dataSize, 4);
    header.write('WAVE', 8);

    // fmt chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // chunk size
    header.writeUInt16LE(1, 20); // PCM format
    header.writeUInt16LE(this.channels, 22);
    header.writeUInt32LE(this.sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(this.bitsPerSample, 34);

    // data chunk
    header.write('data', 36);
    header.writeUInt32LE(this.dataSize, 40);

    return header;
  }
}
