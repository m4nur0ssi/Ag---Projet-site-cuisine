'use client';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/mobile/lib/supabase';

function CallbackHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        if (error) {
            console.error('[AuthCallback] OAuth error:', error, searchParams.get('error_description'));
            router.replace('/');
            return;
        }

        if (code) {
            supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
                if (error) console.error('[AuthCallback] exchange error:', error.message);
                router.replace('/');
            });
        } else {
            router.replace('/');
        }
    }, []);

    return null;
}

export default function AuthCallback() {
    return (
        <Suspense fallback={null}>
            <CallbackHandler />
        </Suspense>
    );
}
