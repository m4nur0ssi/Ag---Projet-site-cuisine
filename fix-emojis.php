<?php
// Script to fix emojis directly inside WordPress (bypass REST auth issues)
require_once('wp-load.php');

$emojiMapJson = file_get_contents(__DIR__ . '/ingredient-icons.json');
$emojiMap = json_decode($emojiMapJson, true);

function getEmojiForIngredient($name)
{
    if (!$name)
        return '🥣';
    $name = mb_strtolower($name, 'UTF-8');

    if (strpos($name, 'carotte') !== false)
        return '🥕';
    if (strpos($name, 'oignon') !== false || strpos($name, 'echalote') !== false || strpos($name, 'échalote') !== false)
        return '🧅';
    if (strpos($name, 'ail') !== false)
        return '🧄';
    if (strpos($name, 'pomme de terre') !== false || strpos($name, 'grenaille') !== false || strpos($name, 'patate') !== false)
        return '🥔';
    if (strpos($name, 'tomate') !== false)
        return '🍅';
    if (strpos($name, 'poivron') !== false || strpos($name, 'piment') !== false)
        return '🌶️';
    if (strpos($name, 'champignon') !== false || strpos($name, 'portobello') !== false)
        return '🍄';
    if (strpos($name, 'brocoli') !== false)
        return '🥦';
    if (strpos($name, 'chou') !== false && strpos($name, 'choux') === false)
        return '🥬';
    if (strpos($name, 'choux') !== false)
        return '🥬';
    if (strpos($name, 'concombre') !== false)
        return '🥒';
    if (strpos($name, 'avocat') !== false)
        return '🥑';
    if (strpos($name, 'aubergine') !== false)
        return '🍆';
    if (strpos($name, 'salade') !== false || strpos($name, 'batavia') !== false || strpos($name, 'laitue') !== false || strpos($name, 'mâche') !== false || strpos($name, 'roquette') !== false || strpos($name, 'épinard') !== false || strpos($name, 'epinard') !== false)
        return '🥗';
    if (strpos($name, 'maïs') !== false || strpos($name, 'mais') !== false)
        return '🌽';
    if (strpos($name, 'haricot') !== false || strpos($name, 'pois') !== false)
        return '🫘';

    if (strpos($name, 'citron') !== false)
        return '🍋';
    if (strpos($name, 'pomme') !== false && strpos($name, 'terre') === false)
        return '🍎';
    if (strpos($name, 'banane') !== false)
        return '🍌';
    if (strpos($name, 'fraise') !== false)
        return '🍓';
    if (strpos($name, 'framboise') !== false)
        return '🍇';
    if (strpos($name, 'poire') !== false)
        return '🍐';
    if (strpos($name, 'orange') !== false)
        return '🍊';
    if (strpos($name, 'myrtille') !== false)
        return '🫐';
    if (strpos($name, 'cerise') !== false)
        return '🍒';
    if (strpos($name, 'raisin') !== false)
        return '🍇';
    if (strpos($name, 'mangue') !== false)
        return '🥭';

    if (strpos($name, 'poulet') !== false || strpos($name, 'volaille') !== false || strpos($name, 'dinde') !== false || strpos($name, 'canard') !== false)
        return '🍗';
    if (strpos($name, 'boeuf') !== false || strpos($name, 'bœuf') !== false || strpos($name, 'haché') !== false || strpos($name, 'steak') !== false || strpos($name, 'viande') !== false)
        return '🥩';
    if (strpos($name, 'porc') !== false || strpos($name, 'lardon') !== false || strpos($name, 'jambon') !== false || strpos($name, 'chorizo') !== false || strpos($name, 'saucisse') !== false || strpos($name, 'lard') !== false)
        return '🥓';
    if (strpos($name, 'saumon') !== false || strpos($name, 'poisson') !== false || strpos($name, 'thon') !== false || strpos($name, 'lieu') !== false || strpos($name, 'cabillaud') !== false || strpos($name, 'truite') !== false)
        return '🐟';
    if (strpos($name, 'crevette') !== false || strpos($name, 'scampi') !== false)
        return '🦐';
    if (strpos($name, 'calamar') !== false || strpos($name, 'encornet') !== false)
        return '🦑';

    if (strpos($name, 'oeuf') !== false || strpos($name, 'œuf') !== false)
        return '🥚';
    if (strpos($name, 'lait') !== false || strpos($name, 'crème') !== false || strpos($name, 'creme') !== false)
        return '🥛';
    if (strpos($name, 'beurre') !== false)
        return '🧈';
    if (strpos($name, 'fromage') !== false || strpos($name, 'gruyère') !== false || strpos($name, 'parmesan') !== false || strpos($name, 'mozzarella') !== false || strpos($name, 'cheddar') !== false || strpos($name, 'mascarpone') !== false || strpos($name, 'gouda') !== false || strpos($name, 'comté') !== false || strpos($name, 'chèvre') !== false)
        return '🧀';

    if (strpos($name, 'farine') !== false || strpos($name, 'pâte feuilletée') !== false || strpos($name, 'pâte brisée') !== false || strpos($name, 'pâte sablée') !== false)
        return '🌾';
    if (strpos($name, 'pain') !== false || strpos($name, 'chapelure') !== false || strpos($name, 'baguette') !== false)
        return '🥖';
    if (strpos($name, 'pâte') !== false || strpos($name, 'penne') !== false || strpos($name, 'spaghetti') !== false || strpos($name, 'macaroni') !== false || strpos($name, 'rigatoni') !== false || strpos($name, 'farfalle') !== false || strpos($name, 'casarecce') !== false || strpos($name, 'nouille') !== false)
        return '🍝';
    if (strpos($name, 'riz') !== false)
        return '🍚';
    if (strpos($name, 'sucre') !== false || strpos($name, 'miel') !== false || strpos($name, 'sirop') !== false)
        return '🍯';
    if (strpos($name, 'chocolat') !== false || strpos($name, 'cacao') !== false)
        return '🍫';
    if (strpos($name, 'vanille') !== false)
        return '🍦';

    if (strpos($name, 'huile') !== false || strpos($name, 'vinaigre') !== false)
        return '🍾';
    if (strpos($name, 'sel') !== false)
        return '🧂';
    if (strpos($name, 'poivre') !== false)
        return '🌶️';
    if (strpos($name, 'moutarde') !== false || strpos($name, 'mayonnaise') !== false || strpos($name, 'ketchup') !== false || strpos($name, 'sauce') !== false || strpos($name, 'bouillon') !== false || strpos($name, 'concentré de tomate') !== false)
        return '🥫';
    if (strpos($name, 'thym') !== false || strpos($name, 'persil') !== false || strpos($name, 'basilic') !== false || strpos($name, 'coriandre') !== false || strpos($name, 'ciboulette') !== false || strpos($name, 'herbe') !== false || strpos($name, 'romarin') !== false || strpos($name, 'menthe') !== false || strpos($name, 'estragon') !== false || strpos($name, 'aneth') !== false)
        return '🌿';
    if (strpos($name, 'curry') !== false || strpos($name, 'paprika') !== false || strpos($name, 'cumin') !== false || strpos($name, 'curcuma') !== false || strpos($name, 'cannelle') !== false || strpos($name, 'gingembre') !== false || strpos($name, 'muscade') !== false || strpos($name, 'épice') !== false)
        return '🧂';

    if (strpos($name, 'noix') !== false || strpos($name, 'noisette') !== false || strpos($name, 'amande') !== false || strpos($name, 'cajou') !== false || strpos($name, 'pécan') !== false || strpos($name, 'pistache') !== false)
        return '🥜';
    if (strpos($name, 'eau') !== false || strpos($name, 'vin') !== false || strpos($name, 'rhum') !== false || strpos($name, 'bière') !== false)
        return '💧';

    return '🥣'; // Fallback
}

function getEmoji($name, $emojiMap)
{
    // Nettoyer le nom
    $cleanName = trim(explode(' (', mb_strtolower($name, 'UTF-8'))[0]);
    $cleanName = preg_replace('/^[0-9\s,\.\/]+(?:g|kg|ml|cl|l|c\.à\.s|c\.à\.c|verre|cuillère|cuillere|pincée)?(?: de | d\'| de)?/i', '', $cleanName);
    $cleanName = trim($cleanName);

    if ($emojiMap && isset($emojiMap[$cleanName])) {
        return $emojiMap[$cleanName];
    }
    return getEmojiForIngredient($cleanName);
}

// 1. Get all posts
$args = array(
    'post_type' => 'post',
    'post_status' => 'publish',
    'posts_per_page' => -1 // all
);
$query = new WP_Query($args);

$total = 0;

if ($query->have_posts()) {
    while ($query->have_posts()) {
        $query->the_post();
        $post_id = get_the_ID();
        $content = get_post_field('post_content', $post_id);

        $modified = false;

        // Remove previous injected technical blocks - SUPER AGGRESSIVE
        // These are items that might have been injected as plain text by mistake
        $patterns = array(
            '/\.mpprecipe-ingredient-item\s*\{.*?\}/s',
            '/\.mpprecipe-ingredient-img\s*\{.*?\}/s',
            '/\.mpprecipe-ingredient-text\s*\{.*?\}/s',
            '/#mpprecipe-ingredients-list\s*\{.*?\}/s',
            '/\{"@context":\s*"http:\/\/schema\.org\/".*?\}/s',
            '/,\s*\{"@type":\s*"HowToStep".*?\}/s',
            '/\[\{"@type":\s*"HowToStep".*?\}\]/s',
            '/\{"@type":\s*"HowToStep".*?\}/s'
        );

        $new_content = preg_replace($patterns, '', $content);
        if ($new_content !== $content) {
            $content = $new_content;
            $modified = true;
        }

        // Remove previous injected divs
        $content = preg_replace('/<div class="mpprecipe-ingredient-img".*?<\/div>/s', '', $content);
        $content = preg_replace('/<img[^>]*class="mpprecipe-ingredient-img"[^>]*>/i', '', $content);

        // Extract ingredients
        preg_match_all('/<span class="mpprecipe-ingredient-text">(.*?)<\/span>/i', $content, $matches);

        if (!empty($matches[1])) {
            foreach ($matches[1] as $ing) {
                $emoji = getEmoji($ing, $emojiMap);

                // Construct replacement
                $searchStr = '<span class="mpprecipe-ingredient-text">' . $ing . '</span>';

                // Custom CSS to make the div look like a circle emoji
                $style = 'display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background-color:#f8f9fa;border:1px solid #dee2e6;font-size:14px;margin-right:8px;vertical-align:middle;box-shadow:0 1px 3px rgba(0,0,0,0.1);flex-shrink:0;';

                $replacement = '<div class="mpprecipe-ingredient-img" style="' . $style . '">' . $emoji . '</div>' . $searchStr;

                if (strpos($content, $replacement) === false) {
                    $content = str_replace($searchStr, $replacement, $content);
                    $modified = true;
                }
            }
        }

        if ($modified) {
            wp_update_post(array(
                'ID' => $post_id,
                'post_content' => trim($content)
            ));
            $total++;
            echo "Updated post {$post_id}\n";
        }
    }
    wp_reset_postdata();
}

echo "Finished updating {$total} posts.\n";
?>
