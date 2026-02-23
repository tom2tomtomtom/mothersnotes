'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useElectron } from '../hooks/use-electron';

export function CalendarNavigator() {
  const electron = useElectron();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!electron) return;

    return electron.onCalendarMeetingStarting((event) => {
      // Store the event + auto-record flag for the record page to pick up
      try {
        sessionStorage.setItem('calendarEvent', JSON.stringify(event));
        sessionStorage.setItem('autoRecord', 'true');
      } catch {
        // Ignore storage errors
      }

      // Navigate to record page if not already there
      if (pathname !== '/record') {
        router.push('/record');
      }
    });
  }, [electron, router, pathname]);

  return null;
}
