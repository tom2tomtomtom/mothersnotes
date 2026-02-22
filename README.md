# Mother's Notes

AI-powered meeting notes app. Record meetings, get real-time transcription with speaker diarization, and receive comprehensive AI-generated meeting notes with action items, decisions, and next steps.

## Features

- **One-button recording** - Start/stop with a single click
- **Real-time transcription** - See words appear as they're spoken (Deepgram Nova-3)
- **Speaker diarization** - Automatically identifies different speakers
- **AI analysis** - Claude generates structured notes from your transcript
- **Action items** - Track tasks with owners, due dates, and priorities
- **Full-text search** - Find anything across all your meetings
- **Export** - Markdown, PDF, or clipboard

## Setup

```bash
npm install
```

### API Keys

You'll need:
1. **Deepgram API key** - [deepgram.com](https://deepgram.com) (for transcription)
2. **Anthropic API key** - [console.anthropic.com](https://console.anthropic.com) (for AI analysis)

Add them in the app's Settings page.

## Development

```bash
npm run dev
```

This starts Next.js on port 3939 and launches Electron.

## Build

```bash
npm run build   # Build Next.js + main process
npm run dist    # Package as desktop app
```

## Architecture

- **Electron** main process: Deepgram WebSocket, Claude API, SQLite, WAV recording
- **Next.js** renderer: React UI with Tailwind CSS
- **IPC bridge**: Typed channels between main and renderer processes
- Audio flows: Mic → AudioWorklet (PCM) → IPC → Deepgram + WAV file
- Analysis: Transcript → Claude API → Structured notes → SQLite
