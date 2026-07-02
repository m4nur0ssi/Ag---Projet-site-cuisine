'use client';
import { useAuth } from '@/mobile/hooks/useAuth';
import styles from './RequestRecipeButton.module.css';

const OWNER_EMAIL = 'm4nu.r0ssi@gmail.com';

function firstNameFrom(user: any): string {
    const meta = user?.user_metadata || {};
    const raw = meta.full_name || meta.name || meta.given_name
        || (user?.email ? String(user.email).split('@')[0].split(/[._\-+]/)[0] : '');
    if (!raw) return 'toi';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Bouton (connectés) : ouvre un mail pré-rempli pour proposer une recette. */
export default function RequestRecipeButton() {
    const { user } = useAuth();
    if (!user) return null;

    const prenom = firstNameFrom(user);
    const subject = '🍳 Demande de nouvelle recette';
    const body =
`Coucou ${prenom} !

Comment vas-tu ? J'espère que tout roule 😊
Je suis super content(e) que le site te plaise — j'ai beaucoup travaillé dessus !

Tu veux proposer une nouvelle recette ? Aucun problème 🙌
Colle simplement ton lien juste en dessous :

▶️ Lien YouTube :
🎵 Lien TikTok :

Merci beaucoup pour ta participation à l'élaboration du site 🧡
À très vite !`;

    const href = `mailto:${OWNER_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    return (
        <a className={styles.btn} href={href} aria-label="Proposer une nouvelle recette">
            <span className={styles.icon}>✨</span>
            <span className={styles.label}>Proposer une recette</span>
        </a>
    );
}
