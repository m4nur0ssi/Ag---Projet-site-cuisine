'use client';
// Carrousel photos restaurant : photo principale mise en avant (cadre stylé) +
// miniatures dessous. Swipe tactile (mobile) : glisser = photo suivante/précédente ;
// swipe au-delà de la dernière/première photo = restaurant suivant/précédent.
import { useState, useRef } from 'react';

interface RestaurantGalleryProps {
    photos: string[];
    alt: string;
    initialIndex?: number; // photo affichée en 1er (mise en avant) — défaut 0
    onNextRestaurant?: () => void;
    onPrevRestaurant?: () => void;
}

export default function RestaurantGallery({ photos, alt, initialIndex = 0, onNextRestaurant, onPrevRestaurant }: RestaurantGalleryProps) {
    const startIndex = Math.min(Math.max(0, initialIndex), Math.max(0, (photos?.length || 1) - 1));
    const [i, setI] = useState(startIndex);
    const start = useRef<{ x: number; y: number } | null>(null);
    if (!photos || photos.length === 0) return null;
    const n = photos.length;
    const go = (d: number) => setI(p => (p + d + n) % n);

    const onTouchStart = (e: React.TouchEvent) => {
        start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onTouchEnd = (e: React.TouchEvent) => {
        if (!start.current) return;
        const dx = e.changedTouches[0].clientX - start.current.x;
        const dy = e.changedTouches[0].clientY - start.current.y;
        start.current = null;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return; // pas un swipe horizontal
        if (dx < 0) {
            // swipe gauche → photo suivante ; si déjà la dernière → restaurant suivant
            if (i < n - 1) setI(i + 1);
            else if (onNextRestaurant) onNextRestaurant();
        } else {
            if (i > 0) setI(i - 1);
            else if (onPrevRestaurant) onPrevRestaurant();
        }
    };

    return (
        <div style={{ width: '100%', minWidth: 0 }}>
            {/* Photo principale — cadre stylé */}
            <div
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                style={{
                    position: 'relative', width: '100%', aspectRatio: '16 / 10', maxHeight: 340,
                    borderRadius: 20, overflow: 'hidden', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    boxShadow: '0 18px 40px -18px rgba(0,0,0,0.6)',
                    touchAction: 'pan-y',
                }}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={photos[i]}
                    alt={`${alt} — photo ${i + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', userSelect: 'none' }}
                    loading="lazy"
                    draggable={false}
                />

                {n > 1 && (
                    <>
                        <button aria-label="Photo précédente" onClick={() => go(-1)} style={arrowStyle('left')}>‹</button>
                        <button aria-label="Photo suivante" onClick={() => go(1)} style={arrowStyle('right')}>›</button>
                        <div style={{
                            position: 'absolute', bottom: 10, right: 12,
                            padding: '3px 9px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700,
                            color: '#fff', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
                        }}>{i + 1} / {n}</div>
                    </>
                )}
            </div>

            {/* Miniatures — plus petites que la photo principale */}
            {n > 1 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
                    {photos.map((src, k) => (
                        <button
                            key={k}
                            onClick={() => setI(k)}
                            aria-label={`Voir la photo ${k + 1}`}
                            style={{
                                flexShrink: 0, width: 64, height: 48, borderRadius: 11, overflow: 'hidden',
                                padding: 0, cursor: 'pointer', background: 'none',
                                border: k === i ? '2px solid #3b82f6' : '2px solid rgba(255,255,255,0.15)',
                                opacity: k === i ? 1 : 0.65, transition: 'opacity 0.2s, border-color 0.2s',
                            }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" draggable={false} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function arrowStyle(side: 'left' | 'right'): React.CSSProperties {
    return {
        position: 'absolute', top: '50%', transform: 'translateY(-50%)',
        [side]: 10, width: 38, height: 38, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.6rem', lineHeight: 1, color: '#fff', cursor: 'pointer',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
        border: '1px solid rgba(255,255,255,0.2)', paddingBottom: 3,
    } as React.CSSProperties;
}
