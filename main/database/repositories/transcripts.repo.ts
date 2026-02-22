import { getDatabase } from '../connection';
import type { TranscriptSegment } from '../../../shared/types';

export const transcriptsRepo = {
  insert(segment: Omit<TranscriptSegment, 'id'>): number {
    const db = getDatabase();
    const result = db.prepare(`
      INSERT INTO transcripts (meeting_id, speaker_label, content, start_time, end_time, confidence, is_final)
      VALUES (@meeting_id, @speaker_label, @content, @start_time, @end_time, @confidence, @is_final)
    `).run({
      ...segment,
      is_final: segment.is_final ? 1 : 0,
    });
    return result.lastInsertRowid as number;
  },

  getByMeeting(meetingId: string): TranscriptSegment[] {
    const db = getDatabase();
    return db.prepare(
      'SELECT * FROM transcripts WHERE meeting_id = ? AND is_final = 1 ORDER BY start_time'
    ).all(meetingId) as TranscriptSegment[];
  },

  getFullText(meetingId: string): string {
    const segments = this.getByMeeting(meetingId);
    return segments
      .map((s) => `[${formatTime(s.start_time)}] ${s.speaker_label}: ${s.content}`)
      .join('\n');
  },

  deleteInterim(meetingId: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM transcripts WHERE meeting_id = ? AND is_final = 0').run(meetingId);
  },
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
