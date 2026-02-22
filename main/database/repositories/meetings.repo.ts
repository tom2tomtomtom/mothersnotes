import { getDatabase } from '../connection';
import type { Meeting, MeetingDetail, MeetingNotes, Attendee, Decision } from '../../../shared/types';

export const meetingsRepo = {
  create(id: string): Meeting {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO meetings (id, started_at, status) VALUES (?, ?, 'recording')
    `).run(id, now);

    return this.getById(id)!;
  },

  getById(id: string): Meeting | null {
    const db = getDatabase();
    return db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as Meeting | null;
  },

  getAll(): Meeting[] {
    const db = getDatabase();
    return db.prepare('SELECT * FROM meetings ORDER BY started_at DESC').all() as Meeting[];
  },

  update(id: string, data: Partial<Meeting>): void {
    const db = getDatabase();
    const fields = Object.keys(data)
      .map((key) => `${key} = @${key}`)
      .join(', ');
    db.prepare(`UPDATE meetings SET ${fields} WHERE id = @id`).run({ ...data, id });
  },

  delete(id: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM meetings WHERE id = ?').run(id);
  },

  getDetail(id: string): MeetingDetail | null {
    const db = getDatabase();
    const meeting = this.getById(id);
    if (!meeting) return null;

    const notesRow = db.prepare('SELECT * FROM meeting_notes WHERE meeting_id = ?').get(id) as any;
    let notes: MeetingNotes | null = null;
    if (notesRow) {
      notes = {
        ...notesRow,
        key_takeaways: JSON.parse(notesRow.key_takeaways),
        discussion_topics: JSON.parse(notesRow.discussion_topics),
        next_steps: JSON.parse(notesRow.next_steps),
      };
    }

    const action_items = db.prepare('SELECT * FROM action_items WHERE meeting_id = ? ORDER BY priority DESC').all(id) as any[];
    const decisions = db.prepare('SELECT * FROM decisions WHERE meeting_id = ?').all(id) as Decision[];
    const attendees = db.prepare('SELECT * FROM attendees WHERE meeting_id = ?').all(id) as Attendee[];
    const transcript = db.prepare('SELECT * FROM transcripts WHERE meeting_id = ? AND is_final = 1 ORDER BY start_time').all(id) as any[];

    return {
      ...meeting,
      notes,
      action_items: action_items.map((a) => ({ ...a, completed: Boolean(a.completed) })),
      decisions,
      attendees,
      transcript,
    };
  },

  search(query: string): Meeting[] {
    const db = getDatabase();
    const rows = db
      .prepare(
        `SELECT m.* FROM meetings_fts fts
       JOIN meetings m ON m.id = fts.meeting_id
       WHERE meetings_fts MATCH ?
       ORDER BY rank`
      )
      .all(query) as Meeting[];
    return rows;
  },

  updateFTS(meetingId: string, title: string, transcriptText: string, summary: string): void {
    const db = getDatabase();
    // Delete old entry
    db.prepare('DELETE FROM meetings_fts WHERE meeting_id = ?').run(meetingId);
    // Insert new
    db.prepare(
      'INSERT INTO meetings_fts (meeting_id, title, transcript_text, summary) VALUES (?, ?, ?, ?)'
    ).run(meetingId, title, transcriptText, summary);
  },
};
