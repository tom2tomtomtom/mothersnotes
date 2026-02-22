import { getDatabase } from '../connection';
import type { ActionItem } from '../../../shared/types';

export const actionItemsRepo = {
  insert(item: Omit<ActionItem, 'id' | 'completed'>): number {
    const db = getDatabase();
    const result = db.prepare(`
      INSERT INTO action_items (meeting_id, description, owner, due_date, priority)
      VALUES (@meeting_id, @description, @owner, @due_date, @priority)
    `).run(item);
    return result.lastInsertRowid as number;
  },

  getByMeeting(meetingId: string): ActionItem[] {
    const db = getDatabase();
    const rows = db.prepare(
      'SELECT * FROM action_items WHERE meeting_id = ? ORDER BY priority DESC, id'
    ).all(meetingId) as any[];
    return rows.map((r) => ({ ...r, completed: Boolean(r.completed) }));
  },

  getAll(): ActionItem[] {
    const db = getDatabase();
    const rows = db.prepare(
      'SELECT * FROM action_items ORDER BY completed ASC, priority DESC, id DESC'
    ).all() as any[];
    return rows.map((r) => ({ ...r, completed: Boolean(r.completed) }));
  },

  getPending(): ActionItem[] {
    const db = getDatabase();
    const rows = db.prepare(
      'SELECT * FROM action_items WHERE completed = 0 ORDER BY priority DESC, id DESC'
    ).all() as any[];
    return rows.map((r) => ({ ...r, completed: Boolean(r.completed) }));
  },

  toggle(id: number): void {
    const db = getDatabase();
    db.prepare('UPDATE action_items SET completed = NOT completed WHERE id = ?').run(id);
  },

  update(id: number, data: Partial<ActionItem>): void {
    const db = getDatabase();
    const fields = Object.keys(data)
      .filter((k) => k !== 'id')
      .map((key) => `${key} = @${key}`)
      .join(', ');
    if (!fields) return;
    db.prepare(`UPDATE action_items SET ${fields} WHERE id = @id`).run({ ...data, id });
  },
};
