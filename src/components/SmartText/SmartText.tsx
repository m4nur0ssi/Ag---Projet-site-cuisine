'use client';

import React from 'react';
import { useTimer } from '../Timer/TimerContext';

interface SmartTextProps {
    text: string;
}

export default function SmartText({ text }: SmartTextProps) {
    // Regex to find durations
    const parts = text.split(/(\d+(?:\s?h|heures?|min|minutes?))/gi);

    return (
        <span>
            {parts.map((part, i) => {
                const isDuration = part.match(/(\d+)\s?(h|heures?|min|minutes?)/i);
                if (isDuration) {
                    return (
                        <span
                            key={i}
                            style={{
                                color: 'var(--color-accent-purple)',
                                fontWeight: '800',
                                borderBottom: '2px solid rgba(127, 13, 242, 0.3)',
                                padding: '0 2px'
                            }}
                        >
                            ⏱️ {part}
                        </span>
                    );
                }
                return part;
            })}
        </span>
    );
}
