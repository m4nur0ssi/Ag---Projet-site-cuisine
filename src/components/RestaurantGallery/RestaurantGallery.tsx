'use client';
// Carrousel photos restaurant : 1re image mise en avant + flèches + miniatures.
// Alimenté par restaurant.photos (script import-restaurant-photos.js → /public/restaurants/<id>/).
import { useState } from 'react';

interface RestaurantGalleryProps {
    photos: string[];
    alt: string;
}

export default function RestaurantGallery({ photos, alt }: RestaurantGalleryProps) {
    const [i, setI] = useState(0);
    if (!photos || photos.length === 0) return null;
    const n = photos.length;
    const go = (d: number) => setI(p => (p + d + n) % n);

    return (
        <div style={{ margin: '4px 0 16px' }}>
            {/* Photo mise en avant */}
            <div style={{
                position: 'relative', width: '100%', aspectRatio: '16 / 9', maxHeight: 280,
                borderRadius: 18, overflow: 'hidden', background: 'rgba(255,255,255,0.05)',
            }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={photos[i]}
                    alt={`${alt} — photo ${i + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    loading="lazy"
                />

                {n > 1 && (
                    <>
                        <button
                            aria-label="Photo précédente"
                            onClick={() => go(-1)}
                            style={arrowStyle('left')}
                        >‹</button>
                        <button
                            aria-label="Photo suivante"
                            onClick={() => go(1)}
                            style={arrowStyle('right')}
                        >›</button>
                        <div style={{
                            position: 'absolute', bottom: 10, right: 12,
                            padding: '3px 9px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700,
                            color: '#fff', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
                        }}>{i + 1} / {n}</div>
                    </>
                )}
            </div>

            {/* Miniatures */}
            {n > 1 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, overflowX: 'auto', paddingBottom: 2 }}>
                    {photos.map((src, k) => (
                        <button
                            key={k}
                            onClick={() => setI(k)}
                            aria-label={`Voir la photo ${k + 1}`}
                            style={{
                                flexShrink: 0, width: 62, height: 46, borderRadius: 10, overflow: 'hidden',
                                padding: 0, cursor: 'pointer', background: 'none',
                                border: k === i ? '2px solid #3b82f6' : '2px solid transparent',
                                opacity: k === i ? 1 : 0.6, transition: 'opacity 0.2s, border-color 0.2s',
                            }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
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
