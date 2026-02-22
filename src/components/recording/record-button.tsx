'use client';

interface RecordButtonProps {
  isRecording: boolean;
  isAnalyzing: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function RecordButton({ isRecording, isAnalyzing, onClick, disabled }: RecordButtonProps) {
  if (isAnalyzing) {
    return (
      <div className="relative flex items-center justify-center">
        <div className="w-32 h-32 rounded-full bg-card flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="absolute -bottom-8 text-sm text-muted-foreground">Analyzing...</p>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="relative flex items-center justify-center group disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {/* Pulse ring when recording */}
      {isRecording && (
        <div className="absolute w-32 h-32 rounded-full bg-accent/15 animate-pulse-ring" />
      )}

      {/* Main button */}
      <div
        className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-200 ${
          isRecording
            ? 'bg-accent glow-accent'
            : 'bg-card hover:bg-muted/50'
        }`}
      >
        {isRecording ? (
          /* Stop icon */
          <div className="w-10 h-10 rounded-sm bg-white" />
        ) : (
          /* Mic icon */
          <svg className="w-12 h-12 text-accent" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path d="M19 10v2a7 7 0 01-14 0v-2H3v2a9 9 0 004 7.46V22H8v2h8v-2h-3v-2.54A9 9 0 0021 12v-2h-2z" />
          </svg>
        )}
      </div>

      <span className="absolute -bottom-10 text-sm font-medium text-muted-foreground">
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </span>
    </button>
  );
}
