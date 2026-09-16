import Link from 'next/link';

export default function NotFound() {
    return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
            <h2>Page Introuvable</h2>
            <p>Désolé, cette potion n&apos;existe pas encore.</p>
            {/* L'ancien lien visait /recettes/, qui n'existe pas : le bouton de
                secours menait à une autre page introuvable. */}
            <Link href="/">Retour à l&apos;accueil</Link>
        </div>
    );
}
