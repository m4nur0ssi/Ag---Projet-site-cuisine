import Header from '@/components/Header/Header';
import BottomNav from '@/components/BottomNav/BottomNav';
import styles from './profile.module.css';

export default function ProfilePage() {
    return (
        <div className={styles.page}>
            <Header title="Mon Profil" />
            <main className={styles.main}>
                <div className={styles.profileInfo}>
                    <div className={styles.avatar}>👤</div>
                    <h2>Apprenti Magicien</h2>
                </div>
                <div className={styles.stats}>
                    <div className={styles.statItem}>
                        <span className={styles.statValue}>0</span>
                        <span className={styles.statLabel}>Recettes</span>
                    </div>
                </div>
            </main>
        </div>
    );
}
