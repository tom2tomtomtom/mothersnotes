'use client';

import { useEffect, useState, useRef } from 'react';
import { useElectron } from './use-electron';
import type { TranscriptSegment } from '@shared/types';

export function useLiveTranscript() {
  const electron = useElectron();
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!electron) return;

    const unsubs: (() => void)[] = [];

    unsubs.push(
      electron.onTranscriptFinal((segment) => {
        setSegments((prev) => [...prev, segment]);
        setInterimText('');
      })
    );

    unsubs.push(
      electron.onTranscriptInterim((segment) => {
        setInterimText(segment.content);
      })
    );

    unsubs.push(
      electron.onTranscriptError((err) => {
        setError(err);
      })
    );

    return () => unsubs.forEach((fn) => fn());
  }, [electron]);

  const reset = () => {
    setSegments([]);
    setInterimText('');
    setError(null);
  };

  return { segments, interimText, error, reset };
}
