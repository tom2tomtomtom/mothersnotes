import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { meetingsRepo } from '../database/repositories/meetings.repo';
import { actionItemsRepo } from '../database/repositories/action-items.repo';

export function registerMeetingsIPC(): void {
  ipcMain.handle(IPC.MEETINGS_LIST, async () => {
    return meetingsRepo.getAll();
  });

  ipcMain.handle(IPC.MEETINGS_GET, async (_event, id: string) => {
    return meetingsRepo.getDetail(id);
  });

  ipcMain.handle(IPC.MEETINGS_DELETE, async (_event, id: string) => {
    meetingsRepo.delete(id);
  });

  ipcMain.handle(IPC.MEETINGS_SEARCH, async (_event, query: string) => {
    return meetingsRepo.search(query);
  });

  ipcMain.handle(IPC.ACTION_ITEMS_LIST, async (_event, meetingId?: string) => {
    if (meetingId) {
      return actionItemsRepo.getByMeeting(meetingId);
    }
    return actionItemsRepo.getAll();
  });

  ipcMain.handle(IPC.ACTION_ITEMS_TOGGLE, async (_event, id: number) => {
    actionItemsRepo.toggle(id);
  });

  ipcMain.handle(IPC.ACTION_ITEMS_UPDATE, async (_event, id: number, updates: any) => {
    actionItemsRepo.update(id, updates);
  });
}
