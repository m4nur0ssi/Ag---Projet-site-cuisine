#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Relevé des prix en magasin, pour la table de `src/lib/recipe-price.ts`.
=====================================================================

    python3 scripts/releve-prix.py            # relève et affiche la fourchette
    python3 scripts/releve-prix.py --ecrire   # ...et met la table à jour

Deux sources ouvertes, toutes deux gratuites et sans clé :

  • Open Prices (prices.openfoodfacts.org) — des prix photographiés en rayon,
    datés, avec l'enseigne. Pour ce qui se vend au poids, ils sont déjà au kilo.
  • Open Food Facts — pour les produits emballés : les références les plus
    scannées en France et leur contenance, de quoi ramener une étiquette au kilo.

Ce qu'on garde : les relevés français de moins de trente mois, hors magasins
bio (leurs étiquettes ne disent rien d'un hypermarché). Ce qu'on en tire : la
bande du 25ᵉ au 80ᵉ centile, après avoir écarté ce qui s'éloigne d'un facteur
trois de la médiane — un prix à la pièce saisi comme un prix au kilo, un lot
familial.

Ce que le script NE fait pas : les viandes de détail, les poissons frais et les
fromages à la coupe se vendent sans code-barres et n'existent pas dans ces
bases. Ces valeurs-là sont posées à la main dans la table, calées sur les
relevés voisins. Le script les laisse tranquilles.
"""
import json, urllib.request, urllib.parse, time, sys, os, re, statistics, datetime

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TABLE = os.path.join(RACINE, "src/lib/recipe-price.ts")
SORTIE = os.path.join(RACINE, "scripts/.releve-prix.json")

UA = {"User-Agent": "recettes-magiques/1.0 (estimation du cout des recettes ; contact@lesrecettesmagiques.fr)"}
DEPUIS = (datetime.date.today() - datetime.timedelta(days=900)).isoformat()

def j(url, essais=3):
    for k in range(essais):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return json.load(r)
        except Exception:
            if k == essais - 1: return None
            time.sleep(1.5 * (k + 1))
    return None

def fr(it):
    loc = it.get("location") or {}
    return (loc.get("osm_address_country_code") or "").upper() == "FR"

def enseigne(it):
    loc = it.get("location") or {}
    return loc.get("osm_brand") or (loc.get("osm_name") or "?").split(",")[0]

# ── Vendus au poids : Open Prices donne déjà le prix au kilo ────────────────
def au_poids(tag):
    releves = []
    for page in (1, 2, 3):
        d = j("https://prices.openfoodfacts.org/api/v1/prices?" + urllib.parse.urlencode({
            "category_tag": tag, "price_per": "KILOGRAM", "currency": "EUR",
            "size": 100, "page": page, "order_by": "-date"}))
        if not d or not d.get("items"): break
        for it in d["items"]:
            if not fr(it) or it["date"] < DEPUIS: continue
            p = it.get("price")
            if p and 0.1 < p < 200:
                releves.append((round(p, 2), enseigne(it), it["date"]))
        if len(d["items"]) < 100: break
        time.sleep(0.1)
    return releves

# ── Emballés : OFF pour les références, Open Prices pour leurs étiquettes ───
def emballes(categorie, nb_produits=14):
    d = j("https://fr.openfoodfacts.org/api/v2/search?" + urllib.parse.urlencode({
        "categories_tags_en": categorie, "countries_tags_en": "france",
        "fields": "code,product_name,product_quantity", "page_size": nb_produits,
        "sort_by": "unique_scans_n"}))
    if not d: return []
    releves = []
    for p in d.get("products", []):
        q = p.get("product_quantity")
        try: q = float(q)
        except (TypeError, ValueError): continue
        if not (5 < q < 5000): continue          # contenances aberrantes écartées
        pr = j("https://prices.openfoodfacts.org/api/v1/prices?" + urllib.parse.urlencode({
            "product_code": p["code"], "currency": "EUR", "size": 25, "order_by": "-date"}))
        time.sleep(0.08)
        if not pr: continue
        for it in pr.get("items", []):
            if not fr(it) or it["date"] < DEPUIS: continue
            prix = it.get("price")
            if not prix: continue
            kilo = prix / q * 1000
            if 0.1 < kilo < 300:
                releves.append((round(kilo, 2), enseigne(it), it["date"]))
    return releves

def centile(v, c):
    if not v: return None
    v = sorted(v)
    i = (len(v) - 1) * c
    b, h = int(i), min(int(i) + 1, len(v) - 1)
    return round(v[b] + (v[h] - v[b]) * (i - b), 2)

CIBLES = [
    ("pomme", "poids", "en:apples"),
    ("poire", "poids", "en:pears"),
    ("banane", "poids", "en:bananas"),
    ("orange", "poids", "en:oranges"),
    ("citron", "poids", "en:lemons"),
    ("citron vert", "poids", "en:limes"),
    ("fraise", "poids", "en:strawberries"),
    ("framboise", "poids", "en:raspberries"),
    ("myrtille", "poids", "en:blueberries"),
    ("peche", "poids", "en:peaches"),
    ("abricot", "poids", "en:apricots"),
    ("prune", "poids", "en:plums"),
    ("cerise", "poids", "en:cherries"),
    ("raisin", "poids", "en:grapes"),
    ("kiwi", "poids", "en:kiwis"),
    ("mangue", "poids", "en:mangoes"),
    ("ananas", "poids", "en:pineapples"),
    ("melon", "poids", "en:melons"),
    ("pasteque", "poids", "en:watermelons"),
    ("avocat", "poids", "en:avocados"),
    ("figue", "poids", "en:figs"),
    ("tomate", "poids", "en:tomatoes"),
    ("pomme de terre", "poids", "en:potatoes"),
    ("carotte", "poids", "en:carrots"),
    ("oignon", "poids", "en:onions"),
    ("ail", "poids", "en:garlics"),
    ("echalote", "poids", "en:shallots"),
    ("poireau", "poids", "en:leeks"),
    ("courgette", "poids", "en:courgettes"),
    ("aubergine", "poids", "en:aubergines"),
    ("poivron", "poids", "en:peppers"),
    ("concombre", "poids", "en:cucumbers"),
    ("salade", "poids", "en:lettuces"),
    ("champignon", "poids", "en:mushrooms"),
    ("brocoli", "poids", "en:broccoli"),
    ("chou-fleur", "poids", "en:cauliflowers"),
    ("epinard", "poids", "en:spinach"),
    ("haricot vert", "poids", "en:green-beans"),
    ("petit pois", "poids", "en:peas"),
    ("celeri", "poids", "en:celery"),
    ("fenouil", "poids", "en:fennels"),
    ("navet", "poids", "en:turnips"),
    ("betterave", "poids", "en:beets"),
    ("courge", "poids", "en:squashes"),
    ("radis", "poids", "en:radishes"),
    ("endive", "poids", "en:endives"),
    ("asperge", "poids", "en:asparagus"),
    ("patate douce", "poids", "en:sweet-potatoes"),
    ("chou", "poids", "en:cabbages"),
    ("gingembre", "poids", "en:gingers"),
    ("beurre", "emballe", "butters"),
    ("lait", "emballe", "milks"),
    ("creme liquide", "emballe", "creams"),
    ("oeuf", "emballe", "chicken-eggs"),
    ("yaourt", "emballe", "yogurts"),
    ("fromage blanc", "emballe", "fromage-blanc"),
    ("fromage rape", "emballe", "grated-cheeses"),
    ("mozzarella", "emballe", "mozzarella"),
    ("parmesan", "emballe", "parmigiano-reggiano"),
    ("feta", "emballe", "feta"),
    ("comte", "emballe", "comte"),
    ("camembert", "emballe", "camemberts"),
    ("chevre", "emballe", "goat-cheeses"),
    ("emmental", "emballe", "emmentals"),
    ("mascarpone", "emballe", "mascarpone"),
    ("creme fraiche", "emballe", "sour-creams"),
    ("ricotta", "emballe", "ricotta"),
    ("farine", "emballe", "flours"),
    ("sucre", "emballe", "sugars"),
    ("riz", "emballe", "rices"),
    ("pate", "emballe", "pastas"),
    ("lentille", "emballe", "lentils"),
    ("pois chiche", "emballe", "chickpeas"),
    ("semoule", "emballe", "semolina"),
    ("quinoa", "emballe", "quinoa"),
    ("flocon d avoine", "emballe", "rolled-oats"),
    ("chapelure", "emballe", "breadcrumbs"),
    ("pain de mie", "emballe", "sandwich-breads"),
    ("biscuit", "emballe", "biscuits"),
    ("pate feuilletee", "emballe", "puff-pastries"),
    ("chocolat noir", "emballe", "dark-chocolates"),
    ("chocolat au lait", "emballe", "milk-chocolates"),
    ("cacao", "emballe", "cocoa-powders"),
    ("miel", "emballe", "honeys"),
    ("confiture", "emballe", "jams"),
    ("nutella", "emballe", "chocolate-spreads"),
    ("huile d olive", "emballe", "olive-oils"),
    ("huile de tournesol", "emballe", "sunflower-oils"),
    ("vinaigre", "emballe", "vinegars"),
    ("sauce soja", "emballe", "soy-sauces"),
    ("moutarde", "emballe", "mustards"),
    ("ketchup", "emballe", "ketchup"),
    ("mayonnaise", "emballe", "mayonnaises"),
    ("sauce tomate", "emballe", "tomato-sauces"),
    ("tomate concassee", "emballe", "canned-tomatoes"),
    ("concentre de tomate", "emballe", "tomato-pastes"),
    ("lait de coco", "emballe", "coconut-milks"),
    ("beurre de cacahuete", "emballe", "peanut-butters"),
    ("olive", "emballe", "olives"),
    ("cornichon", "emballe", "pickles"),
    ("mais", "emballe", "canned-sweet-corn"),
    ("haricot rouge", "emballe", "kidney-beans"),
    ("thon", "emballe", "canned-tuna"),
    ("sardine", "emballe", "canned-sardines"),
    ("amande", "emballe", "almonds"),
    ("noix", "emballe", "walnuts"),
    ("noisette", "emballe", "hazelnuts"),
    ("noix de cajou", "emballe", "cashew-nuts"),
    ("pistache", "emballe", "pistachios"),
    ("cacahuete", "emballe", "peanuts"),
    ("graine de sesame", "emballe", "sesame-seeds"),
    ("raisin sec", "emballe", "raisins"),
    ("datte", "emballe", "dates"),
    ("jambon", "emballe", "hams"),
    ("lardon", "emballe", "lardons"),
    ("chorizo", "emballe", "chorizo"),
    ("saucisse", "emballe", "sausages"),
    ("saumon fume", "emballe", "smoked-salmons"),
    ("surimi", "emballe", "surimi"),
    ("poulet", "emballe", "chicken-meats"),
    ("boeuf", "emballe", "beef-meats"),
    ("porc", "emballe", "pork-meats"),
    ("viande hachee", "emballe", "minced-meats"),
    ("saumon", "emballe", "salmons"),
    ("crevette", "emballe", "shrimps"),
    ("cafe", "emballe", "coffees"),
    ("the", "emballe", "teas"),
    ("jus d orange", "emballe", "orange-juices"),
    ("biere", "emballe", "beers"),
    ("vin blanc", "emballe", "white-wines"),
    ("vin rouge", "emballe", "red-wines"),
    ("tofu", "emballe", "tofu"),
    ("compote", "emballe", "apple-compotes"),
    ("chantilly", "emballe", "whipped-creams"),
    ("glace", "emballe", "ice-creams"),
    ("sirop", "emballe", "syrups"),
    ("levure", "emballe", "baking-powders"),
    ("sel", "emballe", "salts"),
    ("poivre", "emballe", "peppers-spices"),
    ("pesto", "emballe", "pestos"),
    ("tahini", "emballe", "tahini"),
    ("harissa", "emballe", "harissa"),
    ("sirop d erable", "emballe", "maple-syrups"),
]

MAIN = {}   # rempli plus bas par le bloc « écartés »

sortie = {}
for n, (cle, genre, ref) in enumerate(CIBLES, 1):
    releves = au_poids(ref) if genre == "poids" else emballes(ref)
    prix = [r[0] for r in releves]
    # On garde CHAQUE relevé avec son enseigne et sa date : le tri (magasins bio,
    # saisies à la pièce prises pour des kilos) se fait après, sur ces données-là.
    sortie[cle] = {
        "n": len(prix), "source": genre, "ref": ref,
        "p25": centile(prix, .25), "p50": centile(prix, .50), "p80": centile(prix, .80),
        "releves": [{"p": r[0], "e": r[1], "d": r[2]} for r in releves],
    }
    print(f"[{n:3d}/{len(CIBLES)}] {cle:26s} n={len(prix):4d}  "
          f"{sortie[cle]['p25']} / {sortie[cle]['p50']} / {sortie[cle]['p80']}", flush=True)
    json.dump(sortie, open(SORTIE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("relevé brut écrit dans", SORTIE)

# ── Du relevé brut à la fourchette ─────────────────────────────────────────
BIO = ('biocoop', 'naturalia', 'bio c', 'la vie claire', 'satoriz', 'les comptoirs de la bio',
       'l\'eau vive', 'so.bio', 'day by day', 'elefan', 'éléfàn', 'grand marche', 'marche')

def bio(e):
    e = (e or '').lower()
    return any(b in e for b in BIO)

def centile(v, c):
    if not v: return None
    v = sorted(v)
    i = (len(v) - 1) * c
    b, h = int(i), min(int(i) + 1, len(v) - 1)
    return v[b] + (v[h] - v[b]) * (i - b)

def bande(releves):
    prix = [r['p'] for r in releves if not bio(r['e'])]
    if len(prix) < 4: return None
    med = statistics.median(prix)
    # Une saisie à la pièce prise pour un kilo, ou un lot familial : on écarte
    # ce qui s'écarte d'un facteur trois de la médiane, dans les deux sens.
    gardes = [p for p in prix if med / 3 <= p <= med * 3]
    if len(gardes) < 4: return None
    return centile(gardes, .25), centile(gardes, .80), len(gardes), sorted({r['e'] for r in releves if not bio(r['e'])})

def arrondi(v):
    if v < 1: return round(v, 2)
    if v < 10: return round(v * 10) / 10
    return round(v)


bandes = {}
for cle, o in sortie.items():
    b = bande(o.get("releves", []))
    if not b:
        print(f"{cle:26s} — trop peu de relevés ({o['n']})")
        continue
    bas, haut, n, enseignes = b
    bandes[cle] = {"bas": arrondi(bas), "haut": arrondi(haut), "n": n}
    print(f"{cle:26s} {arrondi(bas):>7} – {arrondi(haut):<7} (n={n:4d})  {', '.join(enseignes[:4])}")
print("\nfourchettes exploitables :", len(bandes), "sur", len(sortie))

# Relevés ÉCARTÉS : la catégorie ne mesure pas le produit qu'on cuisine.
ECARTES = {
    # Saisies « à la pièce » entrées comme des prix au kilo par les contributeurs.
    'kiwi': 'relevés à la pièce', 'avocat': 'relevés à la pièce',
    'concombre': 'relevés à la pièce', 'mangue': 'relevés à la pièce',
    'salade': 'relevés à la pièce', 'ananas': 'un seul relevé',
    # La catégorie est dominée par un autre produit que celui de la recette.
    'saumon': 'catégorie dominée par le saumon fumé en tranches',
    'crevette': 'catégorie dominée par les crevettes cuites décortiquées',
    'vinaigre': 'catégorie dominée par le balsamique',
    'lentille': 'catégorie dominée par les lentilles cuites en bocal',
    'chocolat noir': 'catégorie dominée par les tablettes de marque',
    'chocolat au lait': 'catégorie dominée par les tablettes de marque',
    'porc': 'catégorie mêlée de charcuterie',
    'sel': 'catégorie mêlée de fleurs de sel et sels aromatisés',
    'glace': 'litre contre kilo : la crème glacée pèse la moitié de son volume',
}

# Certains produits se comptent à la PIÈCE dans la table alors que les relevés
# sont au kilo. Poids d'une pièce, en kilos, pour faire la conversion — sans quoi
# un yaourt se retrouvait facturé quatre euros.
POIDS_PIECE_KG = {
    'oeuf': 0.060, 'yaourt': 0.125, 'yaourt grec': 0.150, 'baguette': 0.250,
    'pate feuilletee': 0.230, 'pate brisee': 0.230, 'pate sablee': 0.230,
    'pate a pizza': 0.260, 'feuille de brick': 0.012,
}


if "--ecrire" not in sys.argv:
    print("\n(lecture seule — relancer avec --ecrire pour mettre la table à jour)")
    raise SystemExit

src = open(TABLE, encoding="utf-8").read()
modifiees, gardees = [], []

def remplacer(m):
    cle, reste = m.group(1), m.group(4)
    if cle not in bandes or cle in ECARTES:
        return m.group(0)
    b, h = bandes[cle]["bas"], bandes[cle]["haut"]
    if "'piece'" in reste:
        k = POIDS_PIECE_KG.get(cle)
        if not k:
            gardees.append(cle)
            return m.group(0)
        b, h = round(b * k, 2), round(h * k, 2)
    modifiees.append(cle)
    return f"'{cle}': [{b}, {h}{reste}"

nouveau = re.sub(r"'([^']+)': \[([\d.]+), ([\d.]+)(, '(?:kg|l|piece)'(?:, [\d.]+)?\])", remplacer, src)
open(TABLE, "w", encoding="utf-8").write(nouveau)
print(f"\n{len(modifiees)} produits mis à jour dans la table")
