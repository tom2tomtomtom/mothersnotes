'use client';

interface RecordingTimerProps {
  seconds: number;
  isRecording: boolean;
}

export function RecordingTimer({ seconds, isRecording }: RecordingTimerProps) {
  if (!isRecording && seconds === 0) return null;

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const formatted = hrs > 0
    ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-3">
      {isRecording && (
        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
      )}
      <span className="text-4xl font-mono text-foreground tabular-nums tracking-tight">
        {formatted}
      </span>
    </div>
  );
}
