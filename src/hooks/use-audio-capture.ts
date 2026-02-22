'use client';

import { useRef, useCallback, useState } from 'react';
import { useElectron } from './use-electron';

export function useAudioCapture() {
  const electron = useElectron();
  const [isCapturing, setIsCapturing] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const start = useCallback(async (deviceId?: string) => {
    if (!electron) return;

    const constraints: MediaStreamConstraints = {
      audio: deviceId
        ? { deviceId: { exact: deviceId }, sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
        : { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    streamRef.current = stream;

    const context = new AudioContext({ sampleRate: 16000 });
    contextRef.current = context;

    // Load audio worklet for PCM encoding
    const workletCode = `
      class PCMEncoder extends AudioWorkletProcessor {
        process(inputs) {
          const input = inputs[0];
          if (input.length > 0) {
            const samples = input[0];
            const pcm = new Int16Array(samples.length);
            for (let i = 0; i < samples.length; i++) {
              const s = Math.max(-1, Math.min(1, samples[i]));
              pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            this.port.postMessage(pcm.buffer, [pcm.buffer]);
          }
          return true;
        }
      }
      registerProcessor('pcm-encoder', PCMEncoder);
    `;

    const blob = new Blob([workletCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await context.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    const source = context.createMediaStreamSource(stream);

    // Analyser for visualization
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    // Worklet for PCM encoding
    const worklet = new AudioWorkletNode(context, 'pcm-encoder');
    worklet.port.onmessage = (event: MessageEvent) => {
      electron.sendAudioChunk(event.data);
    };
    source.connect(worklet);
    workletRef.current = worklet;

    setIsCapturing(true);
  }, [electron]);

  const stop = useCallback(() => {
    if (workletRef.current) {
      workletRef.current.disconnect();
      workletRef.current = null;
    }
    if (contextRef.current) {
      contextRef.current.close();
      contextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
    setIsCapturing(false);
  }, []);

  return {
    isCapturing,
    start,
    stop,
    analyser: analyserRef,
  };
}
