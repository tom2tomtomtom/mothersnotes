import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { exportService } from '../services/export.service';
import { googleDocsService } from '../services/google-docs.service';
import { meetingsRepo } from '../database/repositories/meetings.repo';

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

  ipcMain.handle(IPC.EXPORT_GOOGLE_DOCS, async (_event, meetingId: string) => {
    const meeting = meetingsRepo.getDetail(meetingId);
    if (!meeting) throw new Error('Meeting not found');
    const markdown = exportService.generateMarkdown(meeting);
    return googleDocsService.exportToGoogleDocs(markdown, meeting.title);
  });

  ipcMain.handle(IPC.EXPORT_GOOGLE_DOCS_STATUS, async () => {
    return googleDocsService.getStatus();
  });
}
