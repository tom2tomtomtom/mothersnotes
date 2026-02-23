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
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background antialiased">
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto min-h-0">
            <div className="pt-10 px-10 pb-12">{children}</div>
          </main>
        </div>
        <CalendarNavigator />
        <MeetingPrompt />
      </body>
    </html>
  );
}
