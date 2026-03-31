// =============================================
// TikTok → WordPress : Content Script v2
// =============================================

const SERVER_URL = 'http://localhost:3456/tiktok-recipe';

console.log('[TikTok→WP] ✅ Extension injectée sur TikTok !');

let lastSentVideoId = '';

// =============================================
// Extraction des données de la vidéo
// =============================================
function extractVideoData() {
    try {
        const videoUrl = window.location.href.split('?')[0];

        // Extraire l'ID depuis l'URL
        const videoIdMatch = videoUrl.match(/video\/(\d+)/);
        const videoId = videoIdMatch ? videoIdMatch[1] : '';

        // Auteur depuis l'URL (@username)
        const authorMatch = videoUrl.match(/@([^/]+)/);
        const author = authorMatch ? authorMatch[1] : '';

        // Description — TikTok 2024/2025 sélecteurs
        const descSelectors = [
            '[data-e2e="browse-video-desc"]',
            '[data-e2e="video-desc"]',
            '[data-e2e="search-card-desc"]',
            'div[class*="DivDescription"]',
            'span[class*="SpanText"]',
            'h1[data-e2e="video-title"]',
            '.tt-video-meta-caption',
            '[class*="video-meta-caption"]',
            '[class*="VideoText"]'
        ];

        let description = '';
        for (const sel of descSelectors) {
            const el = document.querySelector(sel);
            if (el && el.innerText && el.innerText.length > 10) {
                description = el.innerText;
                break;
            }
        }

        // Fallback: chercher dans toute la page le texte qui ressemble à une recette
        if (!description || description.length < 20) {
            const allSpans = document.querySelectorAll('span, p, div');
            for (const el of allSpans) {
                const txt = el.innerText || '';
                if (txt.length > 100 && (
                    txt.includes('ingrédient') || txt.includes('Ingrédient') ||
                    txt.includes('g de ') || txt.includes('ml de ') ||
                    txt.includes('Préparation') || txt.includes('recette') ||
                    txt.includes('cuillère') || txt.includes('étape')
                )) {
                    description = txt;
                    break;
                }
            }
        }

        const title = description.split('\n')[0].substring(0, 100) || 'Recette TikTok';

        return { videoUrl, videoId, author, title, description };
    } catch (err) {
        console.error('[TikTok→WP] Erreur extraction:', err);
        return null;
    }
}

// =============================================
// Envoi au serveur local
// =============================================
async function sendToServer(data) {
    try {
        const response = await fetch(SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            console.log('[TikTok→WP] ✅ Données envoyées !');
            return true;
        }
        console.error('[TikTok→WP] ❌ Erreur serveur:', response.status);
        return false;
    } catch (err) {
        console.error('[TikTok→WP] ❌ Serveur inaccessible:', err.message);
        showNotification('⚠️ Serveur local inaccessible. Lance DEMARRER-BOT.bat !', 'error');
        return false;
    }
}

// =============================================
// Notification visuelle sur TikTok
// =============================================
function showNotification(message, type = 'success') {
    document.querySelector('#tiktok-wp-notif')?.remove();
    const colors = { success: '#22c55e', info: '#3b82f6', error: '#ef4444' };
    const notif = document.createElement('div');
    notif.id = 'tiktok-wp-notif';
    notif.style.cssText = `
        position:fixed; top:20px; right:20px; z-index:99999;
        background:${colors[type] || colors.success}; color:white;
        padding:14px 20px; border-radius:12px; font-size:14px; font-weight:600;
        box-shadow:0 4px 20px rgba(0,0,0,0.4); max-width:320px;
        animation:tikwp-slide 0.3s ease; font-family:Arial,sans-serif;
    `;
    if (!document.querySelector('#tiktok-wp-style')) {
        const s = document.createElement('style');
        s.id = 'tiktok-wp-style';
        s.textContent = `@keyframes tikwp-slide{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}`;
        document.head.appendChild(s);
    }
    notif.innerText = message;
    document.body.appendChild(notif);
    setTimeout(() => { notif.style.transition = 'opacity 0.5s'; notif.style.opacity = '0'; setTimeout(() => notif.remove(), 500); }, 5000);
}

// =============================================
// Détection du clic sur LIKE ou FAVORIS
// =============================================
function handleFavoriteClick(buttonType, btn) {
    setTimeout(async () => {
        const data = extractVideoData();
        if (!data || !data.videoId) {
            console.log('[TikTok→WP] Pas d\'ID vidéo trouvé');
            return;
        }

        // Éviter les doublons
        if (data.videoId === lastSentVideoId) return;
        lastSentVideoId = data.videoId;

        console.log(`[TikTok→WP] ⭐ ${buttonType} détecté sur la vidéo ${data.videoId}`);
        showNotification(`⭐ Favori détecté ! Analyse Gemini en cours...`, 'info');

        const sent = await sendToServer(data);
        if (sent) showNotification('🍽️ Recette envoyée à WordPress !', 'success');

        // Reset après 3 secondes pour permettre une nouvelle détection
        setTimeout(() => { lastSentVideoId = ''; }, 3000);
    }, 600);
}

// =============================================
// Attacher les listeners sur les boutons
// =============================================
const attachedSet = new WeakSet();

function attachListeners() {
    // Sélecteurs pour le bouton LIKE (❤️) ET FAVORIS (🔖)
    const selectors = [
        // Like button
        '[data-e2e="like-icon"]',
        '[data-e2e="browse-like-icon"]',
        '[data-e2e="video-like-icon"]',
        // Bookmark / Favoris button  
        'div[aria-label="Ajouter aux favoris"]',
        'div[aria-label="Add to Favorites"]',
        '[data-e2e="bookmark-icon"]',
        '[data-e2e="collection-icon"]',
        '[data-e2e="video-bookmark"]',
        'button[class*="ButtonActionItem"] svg[class*="SvgIconBookmark"]',
        // Classe générique
        'button[class*="ButtonActionItem"]',
        'div[class*="DivLikeWrapper"]',
        // Tous les boutons dans la zone action sidebar
        'div[class*="DivActionBar"] button',
        'div[class*="action-bar"] button',
    ];

    let count = 0;
    for (const sel of selectors) {
        document.querySelectorAll(sel).forEach(btn => {
            if (attachedSet.has(btn)) return;
            attachedSet.add(btn);
            count++;
            btn.addEventListener('click', () => handleFavoriteClick('Bouton action', btn));
        });
    }
    if (count > 0) console.log(`[TikTok→WP] ${count} bouton(s) surveillé(s)`);
}

// =============================================
// Démarrage + Observer les changements de page
// =============================================
attachListeners();

// Re-scan régulier (TikTok est une SPA)
setInterval(attachListeners, 1500);

// Observer les changements d'URL (navigation entre vidéos)
let currentUrl = location.href;
new MutationObserver(() => {
    if (location.href !== currentUrl) {
        currentUrl = location.href;
        lastSentVideoId = '';
        setTimeout(attachListeners, 800);
    }
}).observe(document.body, { childList: true, subtree: true });
