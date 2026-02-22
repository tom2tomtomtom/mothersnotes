import { getDatabase } from '../connection';
import type { MeetingNotes, Decision, Attendee } from '../../../shared/types';

export const notesRepo = {
  saveNotes(meetingId: string, notes: Omit<MeetingNotes, 'id' | 'meeting_id'>): void {
    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO meeting_notes (meeting_id, executive_summary, key_takeaways, discussion_topics, next_steps, meeting_type, sentiment)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      meetingId,
      notes.executive_summary,
      JSON.stringify(notes.key_takeaways),
      JSON.stringify(notes.discussion_topics),
      JSON.stringify(notes.next_steps),
      notes.meeting_type,
      notes.sentiment,
    );
  },

  saveDecisions(meetingId: string, decisions: Omit<Decision, 'id' | 'meeting_id'>[]): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO decisions (meeting_id, description, context, decided_by)
      VALUES (?, ?, ?, ?)
    `);
    for (const d of decisions) {
      stmt.run(meetingId, d.description, d.context, d.decided_by);
    }
  },

  saveAttendees(meetingId: string, attendees: Omit<Attendee, 'id' | 'meeting_id'>[]): void {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO attendees (meeting_id, name, role, speaker_label)
      VALUES (?, ?, ?, ?)
    `);
    for (const a of attendees) {
      stmt.run(meetingId, a.name, a.role, a.speaker_label);
    }
  },
};
