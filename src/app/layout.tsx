import './globals.css';
import type { Metadata } from 'next';
import { Sidebar } from '@/components/layout/sidebar';

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
          <main className="flex-1 overflow-auto">
            <div className="pt-8 px-8 pb-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
