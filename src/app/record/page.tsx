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
import type { AnalysisProgress } from '@shared/types';

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

  // Listen for recording status updates
  useEffect(() => {
    if (!electron) return;

    const unsub = electron.onRecordingStatus((status) => {
      setDuration(status.duration);
    });

    return unsub;
  }, [electron]);

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
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Record Meeting</h1>
        <p className="text-muted-foreground mt-1">
          {isRecording
            ? 'Recording in progress...'
            : isAnalyzing
            ? analysisMessage
            : 'Press the button to start recording'}
        </p>
      </div>

      {error && (
        <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 text-center">
          <p className="text-sm text-accent">{error}</p>
        </div>
      )}

      {/* Timer */}
      <div className="flex justify-center">
        <RecordingTimer seconds={duration} isRecording={isRecording} />
      </div>

      {/* Record button */}
      <div className="flex justify-center py-4">
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
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Live Transcript</h2>
        <LiveTranscript segments={segments} interimText={interimText} />
      </div>
    </div>
  );
}
