import { ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { claudeAnalysisService } from '../services/claude-analysis.service';

export function registerAnalysisIPC(): void {
  ipcMain.handle(IPC.ANALYSIS_START, async (_event, meetingId: string) => {
    // Run analysis asynchronously - progress events sent via webContents
    claudeAnalysisService.analyze(meetingId);
  });
}
