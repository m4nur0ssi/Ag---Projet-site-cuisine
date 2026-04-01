<?php
/**
 * Plugin Name: Les Recettes Magiques — GitHub Sync
 * Description: Synchronise WordPress avec GitHub Actions à chaque recette publiée/modifiée/supprimée.
 * Version: 1.3
 * Author: Rossi Manuel / Anti Gravity
 */

if (!defined('ABSPATH')) exit;

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
define('LRM_GITHUB_OWNER', 'm4nur0ssi');
define('LRM_GITHUB_REPO',  'Ag---Projet-site-cuisine');

function lrm_get_token(): string {
    return (string) get_option('lrm_github_token', '');
}

// ─── ENVOI WEBHOOK GITHUB ────────────────────────────────────────────────────
function lrm_send_github_dispatch(string $event_type, array $payload = []): void {
    $token = lrm_get_token();
    if (empty($token)) {
        error_log('[LRM-Sync] ⚠️ Token GitHub non configuré. Allez dans Réglages → LRM GitHub Sync.');
        return;
    }

    $url  = "https://api.github.com/repos/" . LRM_GITHUB_OWNER . "/" . LRM_GITHUB_REPO . "/dispatches";
    $body = wp_json_encode(['event_type' => $event_type, 'client_payload' => $payload]);

    $response = wp_remote_post($url, [
        'timeout' => 10,
        'headers' => [
            'Authorization'        => 'Bearer ' . $token,
            'Accept'               => 'application/vnd.github+json',
            'Content-Type'         => 'application/json',
            'X-GitHub-Api-Version' => '2022-11-28',
        ],
        'body' => $body,
    ]);

    if (is_wp_error($response)) {
        error_log('[LRM-Sync] ❌ ' . $response->get_error_message());
    } else {
        $code = wp_remote_retrieve_response_code($response);
        error_log("[LRM-Sync] ✅ Dispatch '$event_type' → HTTP $code");
    }
}

// ─── HOOKS WORDPRESS ─────────────────────────────────────────────────────────
function lrm_on_post_save(int $post_id, WP_Post $post, bool $update): void {
    if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) return;
    if ($post->post_status !== 'publish' || $post->post_type !== 'post') return;

    $cache_key = 'lrm_sync_' . $post_id;
    if (get_transient($cache_key)) return;
    set_transient($cache_key, true, 30);

    lrm_send_github_dispatch($update ? 'wp_recipe_updated' : 'wp_recipe_published', [
        'post_id'    => $post_id,
        'post_title' => get_the_title($post_id),
        'timestamp'  => current_time('c'),
    ]);
}
add_action('save_post', 'lrm_on_post_save', 10, 3);

function lrm_on_post_trash(int $post_id): void {
    $post = get_post($post_id);
    if (!$post || $post->post_type !== 'post') return;
    lrm_send_github_dispatch('wp_recipe_deleted', [
        'delete_id'  => $post_id,
        'post_title' => get_the_title($post_id),
        'timestamp'  => current_time('c'),
    ]);
}
add_action('trashed_post',       'lrm_on_post_trash', 10, 1);
add_action('before_delete_post', 'lrm_on_post_trash', 10, 1);

// ─── PAGE DE RÉGLAGES ────────────────────────────────────────────────────────
add_action('admin_menu', function () {
    add_options_page('LRM GitHub Sync', 'LRM GitHub Sync', 'manage_options', 'lrm-github-sync', 'lrm_settings_page');
});

add_action('admin_init', function () {
    register_setting('lrm_settings', 'lrm_github_token', ['sanitize_callback' => 'sanitize_text_field']);
});

function lrm_settings_page(): void {
    $token   = lrm_get_token();
    $masked  = $token ? substr($token, 0, 8) . '...' . substr($token, -4) : '';
    $status  = $token ? '✅ Token configuré' : '⚠️ Token manquant';
    ?>
    <div class="wrap">
        <h1>🔄 LRM GitHub Sync</h1>
        <p><strong><?= esc_html($status) ?></strong><?= $token ? " ($masked)" : '' ?></p>
        <form method="post" action="options.php">
            <?php settings_fields('lrm_settings'); ?>
            <table class="form-table">
                <tr>
                    <th>GitHub Personal Access Token</th>
                    <td>
                        <input type="password" name="lrm_github_token" value="<?= esc_attr($token) ?>"
                               class="regular-text" placeholder="ghp_xxxxxxxxxxxx" autocomplete="off"/>
                        <p class="description">Token avec scope <code>repo</code> — généré sur <a href="https://github.com/settings/tokens/new" target="_blank">github.com/settings/tokens/new</a></p>
                    </td>
                </tr>
            </table>
            <?php submit_button('Enregistrer'); ?>
        </form>

        <hr>
        <h2>🚀 Test & Sync manuelle</h2>
        <form method="post" action="<?= esc_url(admin_url('admin-post.php')) ?>">
            <input type="hidden" name="action" value="lrm_force_sync">
            <?php wp_nonce_field('lrm_force_sync'); ?>
            <?php submit_button('🔄 Forcer une Sync Complète → GitHub → Netlify', 'secondary'); ?>
        </form>
    </div>
    <?php
}

// ─── FORCE SYNC ──────────────────────────────────────────────────────────────
add_action('admin_post_lrm_force_sync', function () {
    check_admin_referer('lrm_force_sync');
    if (!current_user_can('manage_options')) wp_die('Accès refusé');
    lrm_send_github_dispatch('wp_full_sync', ['triggered_by' => wp_get_current_user()->user_login, 'timestamp' => current_time('c')]);
    wp_redirect(add_query_arg('lrm_synced', '1', admin_url('options-general.php?page=lrm-github-sync')));
    exit;
});

add_action('admin_notices', function () {
    if (!isset($_GET['lrm_synced'])) return;
    echo '<div class="notice notice-success is-dismissible"><p>✅ <strong>Sync GitHub déclenchée !</strong> Netlify va redéployer dans ~2 minutes.</p></div>';
});

// ─── BARRE D'ADMIN ───────────────────────────────────────────────────────────
add_action('admin_bar_menu', function (WP_Admin_Bar $bar) {
    if (!current_user_can('manage_options')) return;
    $bar->add_node([
        'id'    => 'lrm-sync',
        'title' => '🔄 Sync Netlify',
        'href'  => wp_nonce_url(admin_url('admin-post.php?action=lrm_force_sync'), 'lrm_force_sync'),
        'meta'  => ['title' => 'Forcer WordPress → GitHub → Netlify'],
    ]);
}, 999);
