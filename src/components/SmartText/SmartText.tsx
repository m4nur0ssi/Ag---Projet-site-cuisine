'use client';

import React from 'react';
import { useTimer } from '../Timer/TimerContext';

interface SmartTextProps {
    text: string;
}

export default function SmartText({ text }: SmartTextProps) {
    // Une durée = un nombre, une unité, et rien d'autre : « 7 minutes », « 1 h », « 5 heures ».
    // Le groupe capturant ne couvre QUE la durée, pour que seule elle soit mise en avant
    // (avant, une phrase contenant « 7 minutes » était coloriée en entier).
    const parts = text.split(/(\d+\s?(?:heures?|h|minutes?|min)\b)/gi);

    return (
        <span>
            {parts.map((part, i) => {
                // split() avec un groupe capturant : les durées sont aux rangs impairs.
                if (i % 2 === 1) {
                    return (
                        <span
                            key={i}
                            style={{
                                color: 'var(--color-accent-purple)',
                                fontWeight: '800',
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
