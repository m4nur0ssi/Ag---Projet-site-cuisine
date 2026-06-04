'use client';
import { createContext, useContext } from 'react';

// true = mobile (iPhone / petit écran), false = desktop, null = pas encore déterminé
export const DeviceContext = createContext<boolean | null>(null);

export function useIsMobile(): boolean | null {
    return useContext(DeviceContext);
}
