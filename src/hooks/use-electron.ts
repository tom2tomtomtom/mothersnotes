'use client';

import type { ElectronAPI } from '@shared/types';

export function useElectron(): ElectronAPI | null {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI;
  }
  return null;
}
