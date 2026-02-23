import './globals.css';
import type { Metadata } from 'next';
import { Sidebar } from '@/components/layout/sidebar';
import { CalendarNavigator } from '@/components/calendar-navigator';
import { MeetingPrompt } from '@/components/meeting-prompt';

export const metadata: Metadata = {
  title: "Mother's Notes",
  description: 'AI-powered meeting notes',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-background antialiased">
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            {/* Draggable title bar area */}
            <div className="app-drag h-10 shrink-0" />
            <main className="flex-1 overflow-y-auto min-h-0">
              <div className="px-10 pb-12">{children}</div>
            </main>
          </div>
        </div>
        <CalendarNavigator />
        <MeetingPrompt />
      </body>
    </html>
  );
}
