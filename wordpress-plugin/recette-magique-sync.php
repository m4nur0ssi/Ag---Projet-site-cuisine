<?php
/**
 * Plugin Name: Recette Magique - GitHub Sync
 * Description: Déclenche une synchronisation GitHub/Vercel automatique dès qu'une recette est publiée sur WordPress.
 * Version: 1.0
 * Author: Antigravity
 *
 * INSTALLATION :
 * 1. Copiez ce fichier dans /wp-content/plugins/recette-magique-sync/recette-magique-sync.php
 * 2. Activez le plugin depuis Extensions > Extensions installées
 * 3. Ajoutez votre token GitHub dans wp-config.php :
 *    define('GITHUB_PAT', 'ghp_votre_token_ici');
 */

if (!defined('ABSPATH')) exit;

/**
 * Se déclenche quand un post change de statut.
 * On surveille : brouillon → publié (ou directement publié).
 */
add_action('transition_post_status', 'recette_magique_on_publish', 10, 3);

function recette_magique_on_publish($new_status, $old_status, $post) {
    // On ne traite que les recettes (post type 'post' ou 'recette')
    if (!in_array($post->post_type, ['post', 'recette'])) return;

    // Déclenchement uniquement quand on passe à "publish"
    if ($new_status === 'publish' && $old_status !== 'publish') {
        recette_magique_trigger_github('wp_recipe_published', [
            'post_id'    => $post->ID,
            'post_title' => $post->post_title,
            'post_url'   => get_permalink($post->ID),
        ]);
    }

    // Si la recette est modifiée (déjà publiée)
    if ($new_status === 'publish' && $old_status === 'publish') {
        recette_magique_trigger_github('wp_recipe_updated', [
            'post_id'    => $post->ID,
            'post_title' => $post->post_title,
        ]);
    }

    // Si la recette est mise à la corbeille
    if ($new_status === 'trash' && $old_status === 'publish') {
        recette_magique_trigger_github('wp_recipe_deleted', [
            'post_id' => $post->ID,
        ]);
    }
}

/**
 * Envoie l'événement à GitHub Actions via repository_dispatch.
 */
function recette_magique_trigger_github($event_type, $payload = []) {
    $github_pat  = defined('GITHUB_PAT') ? GITHUB_PAT : getenv('GITHUB_PAT');
    $github_repo = defined('GITHUB_REPO') ? GITHUB_REPO : 'm4nur0ssi/Ag---Projet-site-cuisine';

    if (empty($github_pat)) {
        error_log('[Recette Magique] ❌ GITHUB_PAT non défini dans wp-config.php !');
        return;
    }

    $url  = "https://api.github.com/repos/{$github_repo}/dispatches";
    $body = json_encode([
        'event_type'     => $event_type,
        'client_payload' => array_merge($payload, [
            'trigger'    => 'wordpress',
            'timestamp'  => current_time('c'),
        ]),
    ]);

    $response = wp_remote_post($url, [
        'timeout' => 15,
        'headers' => [
            'Authorization' => "Bearer {$github_pat}",
            'Accept'        => 'application/vnd.github.v3+json',
            'Content-Type'  => 'application/json',
            'User-Agent'    => 'RecetteMagique-WP',
        ],
        'body' => $body,
    ]);

    if (is_wp_error($response)) {
        error_log('[Recette Magique] ❌ Erreur GitHub : ' . $response->get_error_message());
    } else {
        $code = wp_remote_retrieve_response_code($response);
        if ($code === 204) {
            error_log("[Recette Magique] ✅ GitHub notifié ({$event_type}) pour le post {$payload['post_id']}");
        } else {
            error_log("[Recette Magique] ⚠️ GitHub a répondu {$code} pour {$event_type}");
        }
    }
}
