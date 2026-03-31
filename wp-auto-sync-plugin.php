<?php
/**
 * Plugin Name: Recettes Magiques - Auto Sync
 * Description: Déclenche automatiquement la synchronisation Vercel quand une recette est modifiée, publiée ou supprimée.
 * Version: 1.0
 * Author: Les Recettes Magiques
 * 
 * INSTALLATION :
 * 1. Copier ce fichier dans /wordpress/wp-content/plugins/
 * 2. Activer le plugin dans WordPress → Extensions
 * 3. C'est tout ! Chaque modification de recette déclenchera automatiquement un sync.
 * 
 * Ou plus simple : coller le contenu (sans les balises <?php et ?>) 
 * dans Code Snippets → Add New sur WordPress.
 */

// === CONFIGURATION ===
// URL du webhook Vercel (votre app déployée)
define('RECETTES_SYNC_URL', 'https://lesrecettesmagiques.vercel.app/api/wordpress-sync');
define('RECETTES_SYNC_SECRET', '2TlsVemp');

// Anti-spam : délai très court pour ne pas rater les updates immédiats après publication
define('RECETTES_SYNC_COOLDOWN', 60);

/**
 * Fonction principale de déclenchement du webhook
 */
function recettes_magiques_trigger_sync($post_id, $action = 'updated') {
    // Ne pas déclencher pendant les auto-saves ou révisions
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (wp_is_post_revision($post_id)) return;
    
    // Vérifier le cooldown anti-spam
    $last_sync = get_transient('recettes_last_sync');
    if ($last_sync && (time() - $last_sync) < RECETTES_SYNC_COOLDOWN) {
        error_log('[Recettes Sync] Cooldown actif, sync ignoré pour post #' . $post_id);
        return;
    }
    
    // Construire la requête webhook
    $url = RECETTES_SYNC_URL . '?secret=' . RECETTES_SYNC_SECRET;
    
    $body = json_encode(array(
        'action' => $action,
        'post_id' => $post_id,
        'post' => array(
            'ID' => $post_id,
            'post_title' => get_the_title($post_id),
        ),
        'timestamp' => time(),
        'source' => 'wp-auto-sync-plugin',
    ));
    
    // Appel non-bloquant au webhook (ne ralentit pas WordPress)
    $args = array(
        'body'        => $body,
        'headers'     => array(
            'Content-Type' => 'application/json',
            'X-WP-Secret'  => RECETTES_SYNC_SECRET,
        ),
        'timeout'     => 5,
        'blocking'    => false, // Non-bloquant = WordPress n'attend pas la réponse
        'sslverify'   => false,
    );
    
    $response = wp_remote_post($url, $args);
    
    // Enregistrer le cooldown
    set_transient('recettes_last_sync', time(), RECETTES_SYNC_COOLDOWN * 2);
    
    error_log('[Recettes Sync] ✅ Webhook déclenché pour post #' . $post_id . ' (action: ' . $action . ')');
}

// === HOOKS WORDPRESS ===

// 1. Quand un article change d'état (publié, brouillon, corbeille)
add_action('transition_post_status', function($new_status, $old_status, $post) {
    if ($post->post_type !== 'post') return;

    // CAS 1 : Passage de PUBLIC à NON-PUBLIC (ex: Corbeille ou Brouillon)
    // On doit le SUPPRIMER de Vercel car il n'est plus visible publiquement.
    if ($old_status === 'publish' && $new_status !== 'publish') {
        recettes_magiques_trigger_sync($post->ID, 'deleted');
        return;
    }

    // CAS 2 : ÉTAT PUBLIC (ou devient public)
    // On met à jour Vercel.
    if ($new_status === 'publish') {
        $action = ($old_status === 'publish') ? 'updated' : 'published';
        recettes_magiques_trigger_sync($post->ID, $action);
    }
}, 10, 3);

// 2. Quand un article est mis à la corbeille
add_action('trashed_post', function($post_id) {
    recettes_magiques_trigger_sync($post_id, 'deleted');
});

// 3. Quand un média est modifié (changement de photo)
add_action('edit_attachment', function($attachment_id) {
    // Chercher le post parent ou les posts qui utilisent cette image comme featured media
    $parent_id = wp_get_post_parent_id($attachment_id);
    
    if ($parent_id) {
        recettes_magiques_trigger_sync($parent_id, 'media_updated');
        return;
    }
    
    // Chercher les posts qui ont cette image comme featured image
    global $wpdb;
    $post_ids = $wpdb->get_col($wpdb->prepare(
        "SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_thumbnail_id' AND meta_value = %s",
        $attachment_id
    ));
    
    if (!empty($post_ids)) {
        recettes_magiques_trigger_sync($post_ids[0], 'featured_image_updated');
    }
});

// 4. Quand le featured image (image mise en avant) est modifié
add_action('updated_post_meta', function($meta_id, $post_id, $meta_key, $meta_value) {
    if ($meta_key !== '_thumbnail_id') return;
    
    $post = get_post($post_id);
    if (!$post || $post->post_status !== 'publish' || $post->post_type !== 'post') return;
    
    recettes_magiques_trigger_sync($post_id, 'featured_image_changed');
}, 10, 4);

// 5. Quand un fichier média est remplacé (plugins "Enable Media Replace" etc.)
add_action('wp_handle_replace', function($file_path) {
    // On déclenche un sync général car on ne sait pas quel post est concerné
    recettes_magiques_trigger_sync(0, 'media_replaced');
});

// Bonus : Log dans la page admin pour debug
add_action('admin_notices', function() {
    $last_sync = get_transient('recettes_last_sync');
    if ($last_sync && (time() - $last_sync) < 10) {
        echo '<div class="notice notice-success is-dismissible">';
        echo '<p>🔄 <strong>Recettes Magiques :</strong> Synchronisation Vercel déclenchée ! Les changements seront visibles dans 2-3 minutes.</p>';
        echo '</div>';
    }
});
