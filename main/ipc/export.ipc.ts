import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { exportService } from '../services/export.service';

export function registerExportIPC(): void {
  ipcMain.handle(IPC.EXPORT_MARKDOWN, async (_event, meetingId: string) => {
    return exportService.exportMarkdown(meetingId);
  });

  ipcMain.handle(IPC.EXPORT_PDF, async (_event, meetingId: string) => {
    return exportService.exportPDF(meetingId);
  });

  ipcMain.handle(IPC.EXPORT_CLIPBOARD, async (_event, meetingId: string) => {
    return exportService.exportClipboard(meetingId);
  });
}
