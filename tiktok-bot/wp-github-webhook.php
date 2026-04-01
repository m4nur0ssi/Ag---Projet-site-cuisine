<?php
/**
 * Plugin Name: Les Recettes Magiques — GitHub Sync Webhook
 * Description: Envoie un webhook à GitHub Actions à chaque publication/modification/suppression de recette.
 * Version: 1.2
 * Author: Rossi Manuel / Anti Gravity
 *
 * INSTALLATION :
 * 1. Copier ce fichier dans : /wordpress/wp-content/plugins/lrm-github-sync/lrm-github-sync.php
 * 2. Activer le plugin depuis Tableau de bord → Extensions
 * 3. Ajouter dans wp-config.php :
 *    define('GITHUB_DISPATCH_TOKEN', 'ghp_votre_personal_access_token');
 *    define('GITHUB_REPO_OWNER', 'm4nur0ssi');
 *    define('GITHUB_REPO_NAME', 'Ag---Projet-site-cuisine');
 */

if (!defined('ABSPATH')) exit;

// ─────────────────────────────────────────────────────────────────────────────
// Configuration (depuis wp-config.php)
// ─────────────────────────────────────────────────────────────────────────────
define('LRM_GITHUB_TOKEN',  defined('GITHUB_DISPATCH_TOKEN') ? GITHUB_DISPATCH_TOKEN : '');
define('LRM_GITHUB_OWNER',  defined('GITHUB_REPO_OWNER')     ? GITHUB_REPO_OWNER     : 'm4nur0ssi');
define('LRM_GITHUB_REPO',   defined('GITHUB_REPO_NAME')      ? GITHUB_REPO_NAME      : 'Ag---Projet-site-cuisine');

// ─────────────────────────────────────────────────────────────────────────────
// Envoi du webhook GitHub
// ─────────────────────────────────────────────────────────────────────────────
function lrm_send_github_dispatch(string $event_type, array $payload = []): void {
    if (empty(LRM_GITHUB_TOKEN)) {
        error_log('[LRM-Sync] ⚠️  GITHUB_DISPATCH_TOKEN manquant dans wp-config.php');
        return;
    }

    $url = sprintf(
        'https://api.github.com/repos/%s/%s/dispatches',
        LRM_GITHUB_OWNER,
        LRM_GITHUB_REPO
    );

    $body = wp_json_encode([
        'event_type'     => $event_type,
        'client_payload' => $payload,
    ]);

    $response = wp_remote_post($url, [
        'timeout' => 10,
        'headers' => [
            'Authorization' => 'Bearer ' . LRM_GITHUB_TOKEN,
            'Accept'        => 'application/vnd.github+json',
            'Content-Type'  => 'application/json',
            'X-GitHub-Api-Version' => '2022-11-28',
        ],
        'body' => $body,
    ]);

    if (is_wp_error($response)) {
        error_log('[LRM-Sync] ❌ Erreur webhook : ' . $response->get_error_message());
    } else {
        $code = wp_remote_retrieve_response_code($response);
        error_log("[LRM-Sync] ✅ Dispatch '$event_type' envoyé → HTTP $code");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK : Publication / Mise à jour d'une recette
// ─────────────────────────────────────────────────────────────────────────────
function lrm_on_post_save(int $post_id, WP_Post $post, bool $update): void {
    // Filtres de sécurité
    if (wp_is_post_revision($post_id))  return;
    if (wp_is_post_autosave($post_id))  return;
    if ($post->post_status !== 'publish') return;
    if ($post->post_type !== 'post')    return;

    // Anti-flood : on n'envoie qu'une fois toutes les 30 secondes par post
    $cache_key = 'lrm_sync_' . $post_id;
    if (get_transient($cache_key)) return;
    set_transient($cache_key, true, 30);

    $event_type = $update ? 'wp_recipe_updated' : 'wp_recipe_published';

    lrm_send_github_dispatch($event_type, [
        'post_id'    => $post_id,
        'post_title' => get_the_title($post_id),
        'post_url'   => get_permalink($post_id),
        'timestamp'  => current_time('c'),
    ]);
}
add_action('save_post', 'lrm_on_post_save', 10, 3);

// ─────────────────────────────────────────────────────────────────────────────
// HOOK : Suppression d'une recette
// ─────────────────────────────────────────────────────────────────────────────
function lrm_on_post_trash(int $post_id): void {
    $post = get_post($post_id);
    if (!$post || $post->post_type !== 'post') return;

    lrm_send_github_dispatch('wp_recipe_deleted', [
        'delete_id'  => $post_id,
        'post_title' => get_the_title($post_id),
        'timestamp'  => current_time('c'),
    ]);
}
add_action('trashed_post',    'lrm_on_post_trash', 10, 1);
add_action('before_delete_post', 'lrm_on_post_trash', 10, 1);

// ─────────────────────────────────────────────────────────────────────────────
// Admin : Bouton "Forcer Sync Complète" dans la barre d'admin WP
// ─────────────────────────────────────────────────────────────────────────────
function lrm_admin_bar_sync(WP_Admin_Bar $wp_admin_bar): void {
    if (!current_user_can('manage_options')) return;

    $nonce_url = wp_nonce_url(admin_url('admin-post.php?action=lrm_force_sync'), 'lrm_force_sync');

    $wp_admin_bar->add_node([
        'id'    => 'lrm-sync',
        'title' => '🔄 Sync GitHub',
        'href'  => $nonce_url,
        'meta'  => ['title' => 'Forcer une synchronisation complète WordPress → GitHub'],
    ]);
}
add_action('admin_bar_menu', 'lrm_admin_bar_sync', 999);

// ─────────────────────────────────────────────────────────────────────────────
// Handler du bouton Force Sync
// ─────────────────────────────────────────────────────────────────────────────
function lrm_handle_force_sync(): void {
    check_admin_referer('lrm_force_sync');
    if (!current_user_can('manage_options')) wp_die('Accès refusé');

    lrm_send_github_dispatch('wp_full_sync', [
        'triggered_by' => wp_get_current_user()->user_login,
        'timestamp'    => current_time('c'),
    ]);

    wp_redirect(add_query_arg('lrm_synced', '1', wp_get_referer()));
    exit;
}
add_action('admin_post_lrm_force_sync', 'lrm_handle_force_sync');

// Notice de confirmation après sync
function lrm_admin_notice_synced(): void {
    if (!isset($_GET['lrm_synced'])) return;
    echo '<div class="notice notice-success is-dismissible"><p>✅ <strong>Sync GitHub déclenchée !</strong> GitHub Actions va mettre à jour les recettes dans quelques secondes.</p></div>';
}
add_action('admin_notices', 'lrm_admin_notice_synced');
