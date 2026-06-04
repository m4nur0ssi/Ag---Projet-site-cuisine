'use client';

import { useAuth } from '@/mobile/hooks/useAuth';

// Monté globalement : déclenche useAuth → pull favoris/courses + démarre la sync montante.
// Ne rend rien.
export default function AccountSync() {
    useAuth();
    return null;
}
