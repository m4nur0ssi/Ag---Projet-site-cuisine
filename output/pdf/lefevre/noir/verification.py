from pathlib import Path
from collections import Counter
import re, json, unicodedata
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent
SOURCE = Path('/Users/manu/CloudStation/Anti Gravity/RR/Boulangerie Lefevre')
PAIRS = [
    ('boissons-A4.pdf', 'lefevre-boissons-noir-A4.pdf', [210, 297]),
    ('carte-cafes-A4.pdf', 'lefevre-cafes-noir-A4.pdf', [210, 297]),
    ('viennoiseries-A4.pdf', 'lefevre-viennoiseries-noir-A4.pdf', [210, 297]),
    ('formules-authentique-100x50cm-v2.pdf', 'lefevre-formules-noir-100x50cm.pdf', [1000, 500]),
]

def normal(s):
    return ' '.join(unicodedata.normalize('NFC', s).lower().split())

report=[]
for src, filename, expected_size in PAIRS:
    source=PdfReader(SOURCE/src)
    reader=PdfReader(ROOT/filename)
    assert len(reader.pages)==1
    page=reader.pages[0]
    size=[round(float(x)*25.4/72, 2) for x in (page.mediabox.width,page.mediabox.height)]
    assert size==expected_size, (filename, size)
    old=source.pages[0].extract_text()
    text=page.extract_text()
    prices=lambda t:Counter(re.sub(r'\s+', '', v) for v in re.findall(r'\d+,\d{2}\s*€',t))
    assert prices(old)==prices(text), (filename, prices(old),prices(text))
    # Product names, descriptions, allergens and formula explanations are checked
    # independently of layout, line breaks and title capitalization.
    required=[]
    data=json.loads((ROOT.parent/'cafe-viennoiseries/tarifs-proposes.json').read_text())
    if 'cafes-' in filename:
        for key in ('cafes_noirs','cafes_lactes'):
            for name,desc,price in data[key]:required.extend([name,desc])
        required.extend(['1 café au choix','+ 1 pâtisserie individuelle','ou 1 part de gâteau au choix'])
    elif 'viennoiseries-' in filename:
        for title,desc,price in data['viennoiseries']:required.extend(title+[desc])
    elif 'formules-' in filename:
        for item in json.loads((ROOT.parent/'contenu.json').read_text()):
            required.extend(item['title']+item['desc']+item['allergens'])
        required.extend(['1 sandwich + 1 pâtisserie au choix','+ 1 boisson en canette 33 cl au choix','Allergènes indicatifs à confirmer'])
    else:
        required=['Coca-Cola','Original','Zéro sucres','Fanta','Orange','Lipton','Pêche','Oasis','Fraise-framboise','Sprite','Citron-citron vert','Minute Maid','Multivitamines','Red Bull','Hors Red Bull','Bouteilles au choix','Petites bouteilles','Lait','Eau grande','Eau petite','Capri-Sun']
    for phrase in required:assert normal(phrase) in normal(text),(filename,phrase)
    report.append({'file':filename,'pages':1,'size_mm':size,'prices_match_source':True,'content_verified':True,'size_bytes':(ROOT/filename).stat().st_size})
    print(filename,': format, contenu et prix vérifiés')
(ROOT/'verification.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
