'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './SplashScreen.module.css';

export default function SplashScreen() {
    const [isVisible, setIsVisible] = useState(false);
    const [smokeVisible, setSmokeVisible] = useState(false);
    const [logoVisible, setLogoVisible] = useState(false);
    const [titleVisible, setTitleVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        // Uniquement si c'est la première fois de la session
        const hasSeenSplash = sessionStorage.getItem('hasSeenMagicSplash-v5');
        
        if (!hasSeenSplash) {
            setShouldRender(true);
            setIsVisible(true);
            
            // 1. Apparition de la fumée magique immédiatement
            const smokeStartTimer = setTimeout(() => {
                setSmokeVisible(true);
            }, 100);

            // 2. Apparition du logo après un court délai (quand la fumée est dense)
            const logoTimer = setTimeout(() => {
                setLogoVisible(true);
            }, 1000);

            // 3. Animation du titre après l'apparition du logo
            const titleTimer = setTimeout(() => {
                setTitleVisible(true);
            }, 2200);

            // 4. On arrête de générer de la fumée, on laisse dissiper
            const smokeEndTimer = setTimeout(() => {
                setSmokeVisible(false);
            }, 3200);

            // Fin du splash après que tout soit bien lisible
            const closeTimer = setTimeout(() => {
                setIsVisible(false);
                sessionStorage.setItem('hasSeenMagicSplash-v5', 'true');
                // Retirer la classe de blocage
                document.documentElement.classList.remove('is-splashing');
                // Nettoyage après l'animation de sortie
                setTimeout(() => setShouldRender(false), 800);
            }, 4500); 

            return () => {
                clearTimeout(smokeStartTimer);
                clearTimeout(logoTimer);
                clearTimeout(titleTimer);
                clearTimeout(smokeEndTimer);
                clearTimeout(closeTimer);
            };
        } else {
            // Déjà vu, on retire la classe si elle a été mise par le script head
            document.documentElement.classList.remove('is-splashing');
        }
    }, []);

    if (!shouldRender) return null;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div 
                    className={styles.splashContainer}
                    initial={{ opacity: 1 }}
                    exit={{ 
                        opacity: 0,
                        backgroundColor: 'rgba(10, 10, 12, 0)',
                        transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
                    }}
                >
                    <div className={styles.content}>
                        {/* EFFET FUMÉE MAGIQUE PREMIUM (Densifié) */}
                        <AnimatePresence>
                            {smokeVisible && (
                                <div className={styles.smokeContainer}>
                                    {[...Array(25)].map((_, i) => (
                                        <motion.div
                                            key={i}
                                            className={styles.smokeParticle}
                                            initial={{ opacity: 0, scale: 0.1, y: 150, x: 0 }}
                                            animate={{ 
                                                opacity: [0, 0.8, 0.3, 0], 
                                                scale: [0.5, 3 + (i % 4), 7 + (i % 2)],
                                                y: [120, -250 - (i * 12), -500],
                                                x: [(i % 5 - 2) * 60, (i % 2 === 0 ? 150 : -150), (i % 2 === 0 ? 200 : -200)],
                                                rotate: [0, i * 45, i * 180]
                                            }}
                                            exit={{ opacity: 0, scale: 8, filter: 'blur(50px)' }}
                                            transition={{ 
                                                duration: 4.5, 
                                                delay: i * 0.04,
                                                ease: "easeOut",
                                                repeat: logoVisible ? 0 : 1
                                            }}
                                            style={{
                                                background: i % 4 === 0 
                                                    ? 'radial-gradient(circle, rgba(255, 255, 255, 0.5) 0%, transparent 75%)'
                                                    : 'radial-gradient(circle, rgba(127, 13, 242, 0.3) 0%, transparent 75%)'
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </AnimatePresence>

                        {/* LOGO CHAUDRON RÉEL - Apparaît du nuage */}
                        {logoVisible && (
                            <motion.div 
                                className={styles.logoWrapper}
                                initial={{ scale: 0.2, opacity: 0, y: 50, filter: 'blur(30px)' }}
                                animate={{ scale: 1.1, opacity: 1, y: 0, filter: 'blur(0px)' }}
                                transition={{ 
                                    type: 'spring', 
                                    stiffness: 40, 
                                    damping: 10,
                                    delay: 0.4
                                }}
                            >
                                <div className={styles.glow} />
                                <div className={styles.logoImageContainer}>
                                    <Image 
                                        src="/icons/icon-512x512.png" 
                                        alt="Logo Chaudron Magique" 
                                        width={280} 
                                        height={280} 
                                        priority
                                        className={styles.actualLogo}
                                    />
                                </div>
                                <motion.span 
                                    className={styles.sparkles}
                                    animate={{ 
                                        opacity: [0, 1, 0],
                                        scale: [0.8, 1.5, 0.8],
                                        rotate: [0, 90, 180]
                                    }}
                                    transition={{ 
                                        duration: 2.5,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                >
                                    ✨
                                </motion.span>
                            </motion.div>
                        )}

                        {/* TITRE BIENVENUE */}
                        <div className={styles.titleContainer}>
                            <AnimatePresence>
                                {titleVisible && (
                                    <motion.h1 
                                        className={styles.title}
                                        initial={{ y: 40, opacity: 0, filter: 'blur(10px)' }}
                                        animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                                        transition={{ 
                                            duration: 1.5, 
                                            ease: [0.16, 1, 0.3, 1] 
                                        }}
                                    >
                                        Bienvenue, <br /> <span className={styles.subtitle}>et si on cuisinait ?</span>
                                    </motion.h1>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Effet flou liquide de fond */}
                    <div className={styles.bgEffects}>
                        <div className={styles.orb1} />
                        <div className={styles.orb2} />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
