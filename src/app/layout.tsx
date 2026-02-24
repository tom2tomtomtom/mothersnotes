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
