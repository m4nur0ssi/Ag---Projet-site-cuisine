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

/*
 * Chaque service a sa couleur, la même que sur les cartes du menu : l'œil
 * retrouve « le dessert » dans la liste sans lire le mot.
 */
const COURSE_CLASS: Record<string, string> = {
    'Apéritif': styles.cApero, 'Apéritifs': styles.cApero,
    'Entrée': styles.cEntree, 'Entrées': styles.cEntree,
    'Plat': styles.cPlat, 'Plats': styles.cPlat,
    'Accompagnement': styles.cAccomp,
    'Dessert': styles.cDessert, 'Desserts': styles.cDessert,
    'Pâtisserie': styles.cPatisserie, 'Patisserie': styles.cPatisserie,
};
const classeService = (label: string) => COURSE_CLASS[label] || styles.cPlat;

/*
 * Les pictogrammes du déroulé : la chaleur pour le four, le flocon pour le
 * frais, le couteau pour ce qu'on fait de ses mains. Dessinés au trait, jamais
 * en émoji — un émoji change de tête d'un téléphone à l'autre.
 */
const IcoPrepa = () => (
    // La toque : ce moment-là demande TES mains.
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M7 15.5h10v3.2a1.3 1.3 0 0 1-1.3 1.3H8.3A1.3 1.3 0 0 1 7 18.7z" />
        <path d="M7.4 15.5A3.9 3.9 0 0 1 6.6 7.8a3.6 3.6 0 0 1 3.5-2.9c.8 0 1.5.25 2.1.7a3.5 3.5 0 0 1 5.3 2.3 3.9 3.9 0 0 1-.9 7.6" />
    </svg>
);
const IcoFour = () => (
    // La flamme, pleine : la chaleur se lit d'un coup d'œil à 15 px.
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
        <path d="M12.8 2c.3 2.4-.6 4-1.8 5.4-1.3 1.5-2.7 2.8-2.7 5.2a5.7 5.7 0 0 0 11.4 0c0-2.6-1.3-4.4-2.8-6 .2 1.4-.2 2.5-1 3.1.3-2.9-1-5.3-3.1-7.7z" />
        <path d="M9.6 14.6c-.7.8-1.1 1.7-1.1 2.8a3.5 3.5 0 0 0 7 0c0-1.5-.9-2.4-1.8-3.3.1 1.2-.4 2-1.2 2.4.2-1.6-1.2-2.6-2.9-1.9z" opacity="0.55" />
    </svg>
);
const IcoFrais = () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 2.8v18.4M4 7.4l16 9.2M20 7.4L4 16.6" />
        <path d="M9.4 4.6L12 7l2.6-2.4M9.4 19.4L12 17l2.6 2.4" />
    </svg>
);
const IcoRepos = () => (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.4V12l3 1.8" />
    </svg>
);
const IcoService = () => (
    // Les couverts, pas une cloche : à 15 px, une cloche se confond avec la toque.
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M7.4 3v5.4a2.3 2.3 0 0 0 2.3 2.3 2.3 2.3 0 0 0 2.3-2.3V3" />
        <path d="M9.7 10.7V21M9.7 3v5" />
        <path d="M17.4 3c-1.5 1.2-2.2 2.8-2.2 4.6 0 1.6.8 2.6 2.2 2.9V21" />
    </svg>
);

/** Le pictogramme d'une attente, deviné sur son intitulé (« Au four », « Au frais »…). */
function IcoPassif({ label }: { label: string }) {
    const l = label.toLowerCase();
    if (/frais|frigo|froid/.test(l)) return <IcoFrais />;
    if (/repos|lever|pousser|marin/.test(l)) return <IcoRepos />;
    return <IcoFour />;
}

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
                        {/* Entre l'heure et la consigne : ce que la minute demande —
                            les mains, le four, le frais, ou le service. */}
                        <span className={`${styles.stepIco} ${e.kind === 'act' ? styles.icoAct : e.kind === 'serve' ? styles.icoServe : styles.icoPass}`}>
                            {e.kind === 'act' && <IcoPrepa />}
                            {e.kind === 'pass' && e.x && <IcoPassif label={e.x.passiveLabel || 'Cuisson'} />}
                            {e.kind === 'serve' && <IcoService />}
                        </span>
                        <span className={styles.stepD}>
                            {e.kind === 'act' && e.x && <>Prépare <b>{e.x.label.toLowerCase()}</b> — <span className={`${styles.stepPlat} ${classeService(e.x.label)}`}>{e.x.title}</span></>}
                            {e.kind === 'pass' && e.x && <>Lance <b>{(e.x.passiveLabel || 'la cuisson').toLowerCase()}</b> de <span className={`${styles.stepPlat} ${classeService(e.x.label)}`}>{e.x.title}</span> — {e.x.passive} min sans toi</>}
                            {e.kind === 'serve' && <b>Service — tout est prêt</b>}
                        </span>
                    </li>
                ))}
            </ol>
        </div>
    );
}
