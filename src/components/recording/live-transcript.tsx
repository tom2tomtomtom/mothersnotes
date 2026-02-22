'use client';

import { useEffect, useRef } from 'react';
import type { TranscriptSegment } from '@shared/types';

interface LiveTranscriptProps {
  segments: TranscriptSegment[];
  interimText: string;
}

export function LiveTranscript({ segments, interimText }: LiveTranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [segments, interimText]);

  if (segments.length === 0 && !interimText) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Transcript will appear here as you speak...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-64 overflow-y-auto space-y-2 p-4 bg-card rounded-lg border border-border"
    >
      {segments.map((seg, i) => (
        <div key={i} className="text-sm">
          <span className="text-accent font-medium text-xs">{seg.speaker_label}</span>
          <span className="text-muted-foreground text-xs ml-2">
            {formatTime(seg.start_time)}
          </span>
          <p className="text-foreground mt-0.5">{seg.content}</p>
        </div>
      ))}
      {interimText && (
        <div className="text-sm">
          <p className="text-muted-foreground/50 italic">{interimText}</p>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
