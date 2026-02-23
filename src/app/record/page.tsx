'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useElectron } from '../../hooks/use-electron';
import { useAudioCapture } from '../../hooks/use-audio-capture';
import { useLiveTranscript } from '../../hooks/use-live-transcript';
import { RecordButton } from '../../components/recording/record-button';
import { RecordingTimer } from '../../components/recording/recording-timer';
import { AudioVisualizer } from '../../components/recording/audio-visualizer';
import { LiveTranscript } from '../../components/recording/live-transcript';
import type { AnalysisProgress, CalendarEvent } from '@shared/types';

export default function RecordPage() {
  const electron = useElectron();
  const router = useRouter();
  const { isCapturing, start: startCapture, stop: stopCapture, analyser } = useAudioCapture();
  const { segments, interimText, reset: resetTranscript } = useLiveTranscript();

  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [calendarEvent, setCalendarEvent] = useState<CalendarEvent | null>(null);
  const [autoRecordTriggered, setAutoRecordTriggered] = useState(false);

  // Listen for recording status updates
  useEffect(() => {
    if (!electron) return;

    const unsub = electron.onRecordingStatus((status) => {
      setDuration(status.duration);
    });

    return unsub;
  }, [electron]);

  // Check for calendar event passed via sessionStorage (from layout navigator)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('calendarEvent');
      if (stored) {
        const event = JSON.parse(stored);
        setCalendarEvent(event);
        sessionStorage.removeItem('calendarEvent');
        // Auto-record if this was a scheduled meeting trigger
        const autoRecord = sessionStorage.getItem('autoRecord');
        if (autoRecord === 'true') {
          sessionStorage.removeItem('autoRecord');
          setAutoRecordTriggered(true);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Listen for calendar meeting starting (scheduled meeting alert)
  useEffect(() => {
    if (!electron) return;
    return electron.onCalendarMeetingStarting((event) => {
      setCalendarEvent(event);
      setAutoRecordTriggered(true);
    });
  }, [electron]);

  // Auto-start recording when triggered by a scheduled meeting
  useEffect(() => {
    if (!autoRecordTriggered || !electron || isRecording || isAnalyzing) return;
    setAutoRecordTriggered(false);

    (async () => {
      try {
        setError(null);
        resetTranscript();
        const result = await electron.startRecording();
        setMeetingId(result.meetingId);
        if (calendarEvent) {
          electron.renameMeeting(result.meetingId, calendarEvent.title).catch(() => {});
        }
        await startCapture();
        setIsRecording(true);
        setDuration(0);
      } catch (err: any) {
        setError(err.message || 'Failed to auto-start recording');
      }
    })();
  }, [autoRecordTriggered, electron, isRecording, isAnalyzing]);

  // Listen for analysis events
  useEffect(() => {
    if (!electron) return;

    const unsubs: (() => void)[] = [];

    unsubs.push(
      electron.onAnalysisProgress((progress: AnalysisProgress) => {
        setAnalysisMessage(progress.message);
      })
    );

    unsubs.push(
      electron.onAnalysisComplete((completedMeetingId: string) => {
        setIsAnalyzing(false);
        router.push(`/meetings/detail?id=${completedMeetingId}`);
      })
    );

    unsubs.push(
      electron.onAnalysisError((err: string) => {
        setIsAnalyzing(false);
        setError(err);
      })
    );

    return () => unsubs.forEach((fn) => fn());
  }, [electron, router]);

  const handleToggleRecording = useCallback(async () => {
    if (!electron) return;
    setError(null);

    try {
      if (isRecording) {
        // Stop recording
        stopCapture();
        const result = await electron.stopRecording();
        setIsRecording(false);
        setIsAnalyzing(true);
        setAnalysisMessage('Starting analysis...');

        // Start Claude analysis
        await electron.startAnalysis(result.meetingId);
      } else {
        // Start recording
        resetTranscript();
        const result = await electron.startRecording();
        setMeetingId(result.meetingId);
        // Auto-rename if triggered from a calendar event
        if (calendarEvent) {
          electron.renameMeeting(result.meetingId, calendarEvent.title).catch(() => {});
        }
        await startCapture();
        setIsRecording(true);
        setDuration(0);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setIsRecording(false);
      setIsAnalyzing(false);
    }
  }, [electron, isRecording, startCapture, stopCapture, resetTranscript]);

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      {/* Calendar event banner */}
      {calendarEvent && !isRecording && !isAnalyzing && (
        <div className="bg-accent/8 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{calendarEvent.title}</p>
            {calendarEvent.attendees.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                with {calendarEvent.attendees.slice(0, 4).join(', ')}
                {calendarEvent.attendees.length > 4 ? '...' : ''}
              </p>
            )}
          </div>
          {calendarEvent.meetingLink && (
            <a
              href={calendarEvent.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 bg-accent/15 text-accent rounded-md hover:bg-accent/25 transition-colors duration-100"
            >
              Open meeting link
            </a>
          )}
        </div>
      )}

      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Record Meeting</h1>
        <p className="text-muted-foreground mt-2">
          {isRecording
            ? 'Recording in progress...'
            : isAnalyzing
            ? analysisMessage
            : 'Press the button to start recording'}
        </p>
      </div>

      {error && (
        <div className="bg-accent/8 rounded-lg p-4 text-center">
          <p className="text-sm text-accent">{error}</p>
        </div>
      )}

      {/* Timer */}
      <div className="flex justify-center">
        <RecordingTimer seconds={duration} isRecording={isRecording} />
      </div>

      {/* Record button */}
      <div className="flex justify-center py-6">
        <RecordButton
          isRecording={isRecording}
          isAnalyzing={isAnalyzing}
          onClick={handleToggleRecording}
          disabled={isAnalyzing}
        />
      </div>

      {/* Audio visualizer */}
      <div className="flex justify-center">
        <AudioVisualizer analyser={analyser} isActive={isRecording} />
      </div>

      {/* Live transcript */}
      <div>
        <h2 className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Live Transcript</h2>
        <LiveTranscript segments={segments} interimText={interimText} />
      </div>
    </div>
  );
}
