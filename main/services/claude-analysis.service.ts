import Anthropic from '@anthropic-ai/sdk';
import { getMainWindow } from '../index';
import { IPC } from '../../shared/ipc-channels';
import { transcriptsRepo } from '../database/repositories/transcripts.repo';
import { meetingsRepo } from '../database/repositories/meetings.repo';
import { notesRepo } from '../database/repositories/notes.repo';
import { actionItemsRepo } from '../database/repositories/action-items.repo';
import { settingsService } from './settings.service';

const SYSTEM_PROMPT = `You are an expert meeting analyst. You receive meeting transcripts with timestamps and speaker labels. Your job is to produce comprehensive, professional meeting notes.

Analyze the transcript and extract:
1. A concise executive summary (2-3 sentences)
2. Key takeaways (bullet points of the most important points)
3. Discussion topics with summaries and details
4. Action items with owners, due dates if mentioned, and priority levels
5. Decisions that were made with context
6. Attendees identified from speaker labels and names mentioned
7. Recommended next steps
8. Meeting type classification (standup, planning, retrospective, client, brainstorm, 1on1, general)
9. Overall sentiment (positive, neutral, negative, mixed)

Be thorough but concise. Use professional language suitable for sharing with stakeholders.

IMPORTANT: Respond with valid JSON matching this exact schema:
{
  "title": "string - descriptive meeting title based on content",
  "executive_summary": "string",
  "key_takeaways": ["string"],
  "discussion_topics": [{"title": "string", "summary": "string", "details": ["string"]}],
  "action_items": [{"description": "string", "owner": "string or null", "due_date": "string or null", "priority": "high|medium|low"}],
  "decisions": [{"description": "string", "context": "string or null", "decided_by": "string or null"}],
  "attendees": [{"name": "string", "role": "string or null", "speaker_label": "string or null"}],
  "next_steps": ["string"],
  "meeting_type": "string",
  "sentiment": "string"
}`;

export const claudeAnalysisService = {
  async analyze(meetingId: string): Promise<void> {
    const win = getMainWindow();
    const sendProgress = (stage: string, message: string) => {
      if (win) {
        win.webContents.send(IPC.ANALYSIS_PROGRESS, { meetingId, stage, message });
      }
    };

    try {
      const settings = settingsService.getAll();
      if (!settings.anthropicApiKey) {
        throw new Error('Anthropic API key not configured');
      }

      sendProgress('preparing', 'Assembling transcript...');

      const transcript = transcriptsRepo.getFullText(meetingId);
      if (!transcript.trim()) {
        throw new Error('No transcript available for analysis');
      }

      sendProgress('analyzing', 'Claude is analyzing your meeting...');

      const client = new Anthropic({ apiKey: settings.anthropicApiKey });
      const model = settings.claudeModel || 'claude-sonnet-4-5-20250514';

      const response = await client.messages.create({
        model,
        max_tokens: 8192,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: `Here is the meeting transcript:\n\n${transcript}`,
          },
        ],
      });

      const textContent = response.content.find((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from Claude');
      }

      // Parse JSON from response (handle markdown code blocks)
      let jsonText = textContent.text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const analysis = JSON.parse(jsonText);

      sendProgress('saving', 'Saving meeting notes...');

      // Save notes
      notesRepo.saveNotes(meetingId, {
        executive_summary: analysis.executive_summary,
        key_takeaways: analysis.key_takeaways || [],
        discussion_topics: analysis.discussion_topics || [],
        next_steps: analysis.next_steps || [],
        meeting_type: analysis.meeting_type || 'general',
        sentiment: analysis.sentiment || 'neutral',
      });

      // Save action items
      for (const item of analysis.action_items || []) {
        actionItemsRepo.insert({
          meeting_id: meetingId,
          description: item.description,
          owner: item.owner || null,
          due_date: item.due_date || null,
          priority: item.priority || 'medium',
        });
      }

      // Save decisions
      notesRepo.saveDecisions(
        meetingId,
        (analysis.decisions || []).map((d: any) => ({
          description: d.description,
          context: d.context || null,
          decided_by: d.decided_by || null,
        }))
      );

      // Save attendees
      notesRepo.saveAttendees(
        meetingId,
        (analysis.attendees || []).map((a: any) => ({
          name: a.name,
          role: a.role || null,
          speaker_label: a.speaker_label || null,
        }))
      );

      // Update meeting title and status
      const title = analysis.title || 'Meeting Notes';
      meetingsRepo.update(meetingId, {
        title,
        status: 'completed',
      } as any);

      // Update FTS index
      meetingsRepo.updateFTS(
        meetingId,
        title,
        transcript,
        analysis.executive_summary || ''
      );

      sendProgress('complete', 'Analysis complete!');

      if (win) {
        win.webContents.send(IPC.ANALYSIS_COMPLETE, meetingId);
      }
    } catch (error: any) {
      console.error('[Claude Analysis] Error:', error);
      meetingsRepo.update(meetingId, { status: 'error' } as any);
      if (win) {
        win.webContents.send(IPC.ANALYSIS_ERROR, error.message || 'Analysis failed');
      }
    }
  },
};
