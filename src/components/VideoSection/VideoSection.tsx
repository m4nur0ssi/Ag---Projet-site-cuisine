'use client';
import React, { useEffect, useState } from 'react';
import styles from './VideoSection.module.css';

interface VideoSectionProps {
    videoHtml: string;
    muted?: boolean;
}

const VideoSection: React.FC<VideoSectionProps> = ({ videoHtml, muted = true }) => {
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
        const embedUrl = `https://www.tiktok.com/embed/v2/${videoId}?autoplay=1&muted=${muted ? 1 : 0}&loop=1`;
        return (
            <div className={styles.videoContainer}>
                <iframe 
                    src={embedUrl}
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
