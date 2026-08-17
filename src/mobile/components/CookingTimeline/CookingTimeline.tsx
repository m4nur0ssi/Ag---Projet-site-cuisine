'use client';
/**
 * Déroulé de préparation « Apple TV+ » : diagramme de Gantt (une ligne par plat,
 * plus la ligne « Toi ») + déroulé chronologique. Le cuisinier ne fait qu'une
 * chose active à la fois ; le passif (four/frigo) tourne en fond. Utilisé par le
 * planificateur (Jour J : menu complet ; Semaine : un repas).
 */
import { useMemo, useState } from 'react';
import { buildCookingTimeline, fmtClock, type TimelineInput } from '@/lib/cooking-timeline';
import styles from './CookingTimeline.module.css';

const COLORS = ['#30D158', '#FF6B4A', '#BF5AF2', '#0A84FF', '#FFC24B', '#FF3B6B'];

export default function CookingTimeline({ items, defaultServe = 20 * 60 }: { items: TimelineInput[]; defaultServe?: number }) {
    const [serve, setServe] = useState(defaultServe);
    const res = useMemo(() => buildCookingTimeline(items, serve), [items, serve]);

    if (!items.length) {
        return <p className={styles.empty}>Ajoute au moins un plat au menu pour voir le déroulé.</p>;
    }

    const { tasks, start, span, activeTotal, naiveTotal } = res;
    const pct = (t: number) => ((t - start) / Math.max(1, span)) * 100;
    const color = (k: string) => COLORS[items.findIndex((i) => i.key === k) % COLORS.length];

    // Ticks toutes les 15 min.
    const ticks: number[] = [];
    for (let t = Math.ceil(start / 15) * 15; t <= serve; t += 15) ticks.push(t);

    // Déroulé chronologique : chaque geste actif + chaque mise en passif + service.
    type Ev = { t: number; kind: 'act' | 'pass' | 'serve'; x: typeof tasks[number] | null };
    const events: Ev[] = [];
    tasks.forEach((x) => {
        events.push({ t: x.activeStart, kind: 'act', x });
        if (x.passive > 0) events.push({ t: x.passiveStart, kind: 'pass', x });
    });
    events.push({ t: serve, kind: 'serve', x: null });
    events.sort((a, b) => a.t - b.t);

    return (
        <div className={styles.wrap}>
            <div className={styles.controls}>
                <div className={styles.serveBlock}>
                    <span className={styles.serveLbl}>Service</span>
                    <span className={styles.serveVal}>{fmtClock(serve)}</span>
                </div>
                <input
                    className={styles.range}
                    type="range" min={11 * 60} max={23 * 60} step={5}
                    value={serve} onChange={(e) => setServe(+e.target.value)}
                    aria-label="Heure de service"
                />
                <div className={styles.startPill}>
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M12 3c1.4 2.8.6 4.6-.9 6.1C9.4 10.8 8.5 12 8.5 14a3.5 3.5 0 0 0 7 0c0-1.2-.5-2.1-1-2.9 1.6.4 2.3 2 2.3 3.5A4.8 4.8 0 0 1 12 19.5 4.8 4.8 0 0 1 7 14.6c0-2.9 2-4.4 3.4-6.1C11.5 7 12 5.6 12 3z" fill="currentColor" /></svg>
                    Départ {fmtClock(start)}
                </div>
            </div>

            <div className={styles.legend}>
                <span><i className={styles.swActive} /> Toi, actif</span>
                <span><i className={styles.swPassive} /> Four · frigo · repos</span>
            </div>

            <div className={styles.chart}>
                <div className={styles.axis}>
                    {ticks.map((t) => (
                        <span key={t} className={styles.tick} style={{ left: `${pct(t)}%` }}>{fmtClock(t)}</span>
                    ))}
                </div>

                {/* Ligne « Toi » : les phases actives, jamais superposées. */}
                <div className={styles.lane}>
                    <div className={styles.name}>Toi</div>
                    <div className={styles.track}>
                        {tasks.map((x) => (
                            <div key={x.key} className={styles.youBlk}
                                style={{ left: `${pct(x.activeStart)}%`, width: `${(x.active / span) * 100}%` }}>
                                {x.label}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Une ligne par plat : actif plein + passif hachuré. */}
                {tasks.map((x) => {
                    const c = color(x.key);
                    return (
                        <div className={styles.lane} key={x.key}>
                            <div className={styles.name}><i className={styles.dot} style={{ background: c }} />{x.label}</div>
                            <div className={styles.track}>
                                <div className={styles.blk}
                                    style={{ left: `${pct(x.activeStart)}%`, width: `${(x.active / span) * 100}%`, background: c, color: '#0d0b10' }}>
                                    {x.activeLabel || 'Prépa'} <small>{x.active}′</small>
                                </div>
                                {x.passive > 0 && (
                                    <div className={styles.blkPassive}
                                        style={{ left: `${pct(x.passiveStart)}%`, width: `${(x.passive / span) * 100}%`, background: `repeating-linear-gradient(45deg, ${c}88 0 6px, ${c}22 6px 12px)` }}>
                                        {x.passiveLabel || 'Cuisson'} <small>{x.passive}′</small>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className={styles.gain}>
                <b>{span} min</b> de la 1re prépa au service — dont <b>{activeTotal} min</b> de travail réel.
                Le reste ({naiveTotal - activeTotal} min de four/frigo) sert à préparer les autres plats.
            </div>

            <ol className={styles.steps}>
                {events.map((e, i) => (
                    <li key={i} className={styles.step}>
                        <span className={styles.stepT}>{fmtClock(e.t)}</span>
                        <span className={styles.stepD}>
                            {e.kind === 'act' && e.x && <>Prépare <b>{e.x.label.toLowerCase()}</b> — {e.x.title}</>}
                            {e.kind === 'pass' && e.x && <>Lance <b>{(e.x.passiveLabel || 'la cuisson').toLowerCase()}</b> de {e.x.label.toLowerCase()} — {e.x.passive} min sans toi</>}
                            {e.kind === 'serve' && <b>Service — tout est prêt</b>}
                        </span>
                    </li>
                ))}
            </ol>
        </div>
    );
}
