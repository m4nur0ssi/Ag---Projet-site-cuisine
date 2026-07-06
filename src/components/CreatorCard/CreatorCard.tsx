'use client';
import React, { useEffect, useState } from 'react';
import styles from './CreatorCard.module.css';
import { getCreatorForRecipe, getCreatorByHandle, resolveHandle, extractVideoId } from '@/lib/influencers';

interface CreatorCardProps {
    videoHtml?: string;
    tiktokHandle?: string;
    tiktokAuthorUrl?: string;
}

interface RemoteCreator {
    authorName?: string;
    authorUrl?: string;
    handle?: string;
    thumbnail?: string;
    videoUrl?: string;
    website?: string;
}

const CACHE_PREFIX = 'tiktok-creator-v1-';

/**
 * Attribution + fiche créateur sous la vidéo TikTok.
 * - Auteur réel (nom + chaîne TikTok + lien vidéo qui ne 404 pas) récupéré via
 *   /api/tiktok-creator (oEmbed) à partir du seul id vidéo, mis en cache localStorage.
 * - Contenu éditorial (bio, style, site web, livre, badge partenaire) depuis
 *   influencers.json — prioritaire sur les données auto quand présent.
 */
const CreatorCard: React.FC<CreatorCardProps> = ({ videoHtml, tiktokHandle, tiktokAuthorUrl }) => {
    const videoId = extractVideoId(videoHtml);
    const [remote, setRemote] = useState<RemoteCreator | null>(null);
    // Éditorial : d'abord via la recette (tiktokHandle/videoMap), sinon via le
    // pseudo résolu par l'oEmbed → un créateur listé dans influencers.json est
    // reconnu sans avoir à mapper chaque vidéo à la main.
    const creator = getCreatorForRecipe({ tiktokHandle, videoHtml }) || getCreatorByHandle(remote?.handle);

    useEffect(() => {
        if (!videoId) return;
        const cacheKey = CACHE_PREFIX + videoId;
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) { setRemote(JSON.parse(cached)); return; }
        } catch { /* ignore */ }

        let cancelled = false;
        fetch(`/api/tiktok-creator?id=${videoId}`)
            .then(r => (r.ok ? r.json() : null))
            .then((data: RemoteCreator | null) => {
                if (cancelled || !data || (!data.authorName && !data.authorUrl)) return;
                setRemote(data);
                try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch { /* ignore */ }
            })
            .catch(() => { /* dégradation douce : on garde l'attribution minimale */ });
        return () => { cancelled = true; };
    }, [videoId]);

    if (!videoId) return null;

    // Fusion : éditorial (influencers.json) prioritaire, sinon données auto (oEmbed).
    const handle = (
        resolveHandle({ tiktokHandle, videoHtml }) ||
        creator?.handle ||
        remote?.handle ||
        ''
    ).replace(/^@/, '');

    const name = creator?.name || remote?.authorName || (handle ? `@${handle}` : 'Vidéo TikTok');
    const profileUrl =
        creator?.tiktokUrl ||
        tiktokAuthorUrl ||
        remote?.authorUrl ||
        (handle ? `https://www.tiktok.com/@${handle}` : null);
    const videoUrl =
        remote?.videoUrl ||
        (profileUrl && handle ? `${profileUrl.replace(/\/$/, '')}/video/${videoId}` : `https://www.tiktok.com/embed/v2/${videoId}`);

    const hasIdentity = Boolean(creator?.name || remote?.authorName);

    // Liens auto/manuels : site web (lien bio TikTok ou override manuel), livre (manuel).
    const website = creator?.website || remote?.website || '';
    const cookbookTitle = creator?.cookbookTitle || '';
    const cookbookUrl = creator?.cookbookUrl || '';

    return (
        <div className={styles.card}>
            <div className={styles.head}>
                <div className={styles.avatar} aria-hidden>
                    {creator?.avatar
                        ? <img src={creator.avatar} alt="" />
                        : <span>{(name || handle || 'TT')[0]?.toUpperCase()}</span>}
                </div>
                <div className={styles.identity}>
                    <div className={styles.nameRow}>
                        <span className={styles.name}>{name}</span>
                        {creator?.partner && (
                            <span className={styles.badge} title="Créateur partenaire">✓ Partenaire</span>
                        )}
                    </div>
                    {handle && (name !== `@${handle}`) && (
                        <span className={styles.handle}>@{handle}</span>
                    )}
                </div>
                {profileUrl && (
                    <a className={styles.follow} href={profileUrl} target="_blank" rel="noopener noreferrer">
                        Voir la chaîne
                    </a>
                )}
            </div>

            {!hasIdentity && (
                <p className={styles.attribution}>
                    Vidéo publiée sur TikTok par son créateur. Toute la lecture se fait via le lecteur
                    officiel TikTok — les vues et l’attribution reviennent à l’auteur.
                </p>
            )}

            {(website || cookbookTitle) && (
                <div className={styles.meta}>
                    {website && (
                        <a className={styles.metaLink} href={website} target="_blank" rel="noopener noreferrer">
                            🌐 Son site
                        </a>
                    )}
                    {cookbookTitle && (
                        cookbookUrl ? (
                            <a className={styles.metaLink} href={cookbookUrl} target="_blank" rel="noopener noreferrer">
                                📕 {cookbookTitle}
                            </a>
                        ) : (
                            <span>📕 {cookbookTitle}</span>
                        )
                    )}
                </div>
            )}

            <div className={styles.footer}>
                <a href={videoUrl} target="_blank" rel="noopener noreferrer">Regarder la vidéo originale ↗</a>
                <a className={styles.claim} href="mailto:m4nu.r0ssi@gmail.com?subject=Vid%C3%A9o%20TikTok%20sur%20le%20site">
                    Vous êtes l’auteur ?
                </a>
            </div>
        </div>
    );
};

export default CreatorCard;
