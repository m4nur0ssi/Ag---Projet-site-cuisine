'use client';
import React, { useEffect, useState } from 'react';
import styles from './VideoSection.module.css';

interface VideoSectionProps {
    videoHtml: string;
}

const VideoSection: React.FC<VideoSectionProps> = ({ videoHtml }) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className={styles.placeholder}>
                Chargement de la vidéo...
            </div>
        );
    }

    // Extract TikTok ID for stable iframe autoplay
    const videoIdMatch = videoHtml?.match(/data-video-id="(\d+)"/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    if (videoId) {
        // Use player/v1 just like in cards for better autoplay support
        // muted=0 allowed because user just interacted by opening the recipe or clicking the tab
        // controls=1 + progress_bar=1 : barre de contrôle native (lecture/pause, avance/recul)
        const embedUrl = `https://www.tiktok.com/player/v1/${videoId}?autoplay=1&muted=0&loop=1&controls=1&progress_bar=1`;
        return (
            <div className={styles.videoContainer}>
                <iframe 
                    src={embedUrl}
                    title="Recipe Video"
                    className={styles.iframe}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    style={{ background: '#000' }}
                />
            </div>
        );
    }

    // Fallback if no ID is found
    return (
        <div key={videoHtml} className={styles.videoContainer}>
            <div dangerouslySetInnerHTML={{ __html: videoHtml }} />
        </div>
    );
};

export default VideoSection;
