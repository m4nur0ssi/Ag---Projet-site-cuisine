from pathlib import Path
import json
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / 'assets'
F = Path('/System/Library/Fonts/Supplemental')
for name, filename in [('Sans', 'Arial.ttf'), ('Bold', 'Arial Bold.ttf'), ('Black', 'Arial Black.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(F / filename)))
WHITE = '#F8F5EF'
COPPER = '#EDAA73'
MUTED = '#BAB5AE'
LINE = '#393531'
DATA = json.loads((ROOT.parent / 'cafe-viennoiseries/tarifs-proposes.json').read_text())
SANDWICHES = json.loads((ROOT.parent / 'contenu.json').read_text())

class Page:
    def __init__(self, filename, title, width=210, height=297):
        self.path = ROOT / filename
        self.w, self.h = width, height
        self.c = canvas.Canvas(str(self.path), pagesize=(width*mm, height*mm), pageCompression=1)
        self.c.setTitle(title + ' | Lefèvre | Édition noire')
        self.c.setAuthor('Boulangerie Pâtisserie Lefèvre')
        self.c.setSubject('Édition moderne noire. Contenu et prix conservés. Visuels d’illustration.')
        self.c.scale(mm, mm)
        self.rect(0, 0, width, height, '#000000')

    def text(self, s, x, y, size=4, font='Sans', color=WHITE, align='left', maxw=None):
        tw = pdfmetrics.stringWidth(s, font, size)
        if maxw is not None:
            assert tw <= maxw + 0.1, (s, tw, maxw)
        self.c.setFont(font, size)
        self.c.setFillColor(HexColor(color))
        {'left':self.c.drawString, 'right':self.c.drawRightString, 'center':self.c.drawCentredString}[align](x, self.h-y, s)

    def rect(self, x, y, w, h, color, stroke=None):
        self.c.setFillColor(HexColor(color))
        self.c.setStrokeColor(HexColor(stroke or color))
        self.c.setLineWidth(.35)
        self.c.rect(x, self.h-y-h, w, h, stroke=bool(stroke), fill=1)

    def rule(self, x, y, w, color=LINE, weight=.25):
        self.c.setStrokeColor(HexColor(color))
        self.c.setLineWidth(weight)
        self.c.line(x, self.h-y, x+w, self.h-y)

    def pic(self, name, x, y, w, clip=None):
        path = ASSETS / (name+'.png')
        iw, ih = Image.open(path).size
        h = w*ih/iw
        self.c.saveState()
        if clip:
            xx, yy, ww, hh = clip
            p = self.c.beginPath()
            p.rect(xx, self.h-yy-hh, ww, hh)
            self.c.clipPath(p, stroke=0)
        self.c.drawImage(str(path), x, self.h-y-h, w, h, mask='auto')
        self.c.restoreState()

    def header(self, title, subtitle, size=13):
        self.rect(14, 13, 12, 1.2, COPPER)
        self.text('L E F È V R E', 14, 24, 5.8, 'Bold')
        self.text('BOULANGERIE PÂTISSERIE', 196, 23, 2.7, 'Bold', MUTED, 'right')
        self.rule(14, 31, 182)
        self.text('NOS', 14, 42, 3.3, 'Bold', COPPER)
        self.text(title, 13, 59, size, 'Black', maxw=184)
        self.text(subtitle, 14, 69, 3.4, color=MUTED)

    def footer(self, text):
        self.rule(14, 282, 182)
        self.text(text, 14, 289, 2.55, color=MUTED)
        self.text('Visuels d’illustration', 196, 289, 2.35, color=MUTED, align='right')

    def save(self):
        self.c.showPage()
        self.c.save()
        print(self.path)

def cafes():
    p = Page('lefevre-cafes-noir-A4.pdf', 'Nos cafés')
    p.header('CAFÉS', 'Du café serré aux grands lactés', 16)
    p.pic('cafes', 9, 76, 192)
    for col, (title, key) in enumerate([('LES CAFÉS NOIRS', 'cafes_noirs'), ('LES CAFÉS LACTÉS', 'cafes_lactes')]):
        x = 14+96*col
        p.text(title, x, 148, 4.1, 'Bold', COPPER)
        p.rule(x, 153, 86)
        for i, (name, desc, price) in enumerate(DATA[key]):
            y = 162+12.2*i
            p.text(name, x, y, 4, 'Bold', maxw=63)
            p.text(price, x+86, y, 4.45, 'Bold', COPPER, 'right')
            p.text(desc, x, y+4.8, 2.85, color=MUTED, maxw=86)
            if i < 5: p.rule(x, y+8.1, 86, weight=.15)
    p.rect(14, 237, 182, 41, '#11100F', COPPER)
    p.rect(14, 237, 1.4, 41, COPPER)
    p.text('LA PAUSE GOURMANDE', 20, 246, 3.3, 'Bold', COPPER)
    p.text('1 café au choix', 20, 255, 5.2, 'Bold')
    p.text('+ 1 pâtisserie individuelle', 20, 263, 3.65)
    p.text('ou 1 part de gâteau au choix', 20, 270, 3.65)
    p.text('5,00 €', 190, 264, 13.5, 'Bold', COPPER, 'right')
    p.footer('Prix en euros')
    p.save()

def viennoiseries():
    p = Page('lefevre-viennoiseries-noir-A4.pdf', 'Nos viennoiseries')
    p.header('VIENNOISERIES', 'Les grands classiques de la boulangerie', 11.7)
    p.pic('viennoiseries', 8, 77, 194)
    p.rule(14, 147, 182, COPPER, .45)
    for i, (title, desc, price) in enumerate(DATA['viennoiseries']):
        col, row = i//5, i%5
        x = 14+96*col
        y = 160+23*row
        for j, line in enumerate(title):
            p.text(line, x, y+4.8*j, 3.85, 'Bold', maxw=64)
        p.text(price, x+86, y, 4.6, 'Bold', COPPER, 'right')
        p.text(desc, x, y+6.4+4.8*(len(title)-1), 2.75, color=MUTED, maxw=86)
        if row < 4: p.rule(x, y+17.5, 86, weight=.15)
    p.footer('Prix à la pièce, sauf chouquettes : les 6')
    p.save()

def boissons():
    p = Page('lefevre-boissons-noir-A4.pdf', 'Nos boissons')
    p.header('BOISSONS', 'Au choix dans votre vitrine', 14.6)
    p.rule(14, 79, 182, COPPER, .45)
    p.text('CANETTES', 14, 93, 6.4, 'Bold')
    p.text('Au choix', 14, 102, 4.1)
    p.text('Hors Red Bull', 47, 102, 3.2, color=MUTED)
    p.text('1,50 €', 196, 102, 16, 'Bold', COPPER, 'right')
    p.pic('canettes', 8, 111, 194)
    labels = [('Coca-Cola', 'Original'), ('Coca-Cola', 'Zéro sucres'), ('Fanta', 'Orange'), ('Lipton', 'Pêche'), ('Oasis', 'Fraise-framboise'), ('Sprite', 'Citron-citron vert'), ('Minute Maid', 'Multivitamines')]
    for i, (name, detail) in enumerate(labels):
        x=24+i*27
        p.text(name, x, 180, 2.95, 'Bold', align='center')
        p.text(detail, x, 185, 2.3, color=MUTED, align='center')
    p.rule(14, 194, 182)
    p.text('AUSSI EN VITRINE', 14, 205, 3.8, 'Bold', COPPER)
    p.pic('red-bull', 9, 212, 34, clip=(9, 212, 37, 56))
    p.text('Red Bull', 42, 222, 3.9, 'Bold')
    p.text('2,30 €', 42, 232, 5.5, 'Bold', COPPER)
    p.text('Boisson', 42, 242, 2.8, color=MUTED)
    p.text('énergisante', 42, 246.5, 2.8, color=MUTED)
    p.text('Tarif spécifique', 42, 257, 2.5, color=MUTED)
    others=[('Bouteilles au choix','3,00 €'),('Petites bouteilles','2,00 €'),('Lait','1,70 €'),('Eau grande','1,20 €'),('Eau petite','0,80 €'),('Capri-Sun','0,80 €')]
    for i,(name,price) in enumerate(others):
        y=218+10.65*i
        p.text(name, 86, y, 3.8, maxw=81)
        p.text(price, 196, y, 4.5, 'Bold', COPPER, 'right')
        if i<5:p.rule(86, y+4, 110, weight=.15)
    p.footer('Prix à l’unité')
    p.save()

def formules():
    p = Page('lefevre-formules-noir-100x50cm.pdf', 'Nos formules', 1000, 500)
    p.rect(22, 14, 38, 2, COPPER)
    p.text('NOS FORMULES', 20, 44, 29, 'Black')
    p.text('Sandwichs en baguette tradition française', 22, 61, 10, color=MUTED)
    p.text('L E F È V R E', 978, 36, 18, 'Bold', align='right')
    p.text('BOULANGERIE PÂTISSERIE', 977, 53, 7.5, 'Bold', MUTED, 'right')
    p.rule(22, 71, 956, COPPER, .65)
    for i,d in enumerate(SANDWICHES):
        col,row=i%3,i//3
        x,y=22+324*col,81+178*row
        if col>0:
            p.c.setStrokeColor(HexColor(LINE));p.c.setLineWidth(.3)
            p.c.line(x-8, 500-y, x-8, 500-y-164)
        if row==1:p.rule(x,y-8,308,weight=.35)
        for j,t in enumerate(d['title']):p.text(t,x,y+10+11*j,10.2,'Bold',maxw=205)
        p.text('FORMULE',x+308,y+6,5.5,'Bold',MUTED,'right')
        p.text(d['prix'],x+308,y+22,15,'Bold',COPPER,'right')
        p.text('Seul '+d['seul'],x+308,y+34,8.5,'Bold',align='right')
        p.pic(d['id'],x+62,y+20,184,clip=(x,y+34,308,96))
        for j,t in enumerate(d['desc']):p.text(t,x,y+139+10*j,8.8,maxw=308)
        p.text('Allergènes* :',x,y+162,7.3,'Bold',MUTED)
        p.text(d['allergens'][0],x+48,y+162,7.3,color=MUTED,maxw=260)
    p.rule(22,437,956,COPPER,.7)
    p.text('LA FORMULE',22,455,10.5,'Bold',COPPER)
    p.text('1 sandwich + 1 pâtisserie au choix',147,455,10.2,'Bold')
    p.text('+ 1 boisson en canette 33 cl au choix',147,473,10.2,'Bold')
    p.pic('assortiment',790,439,188)
    p.text('* Allergènes indicatifs à confirmer. Pâtisseries et boissons : selon le choix. Visuels d’illustration.',22,490,5.7,color=MUTED,maxw=734)
    p.save()

if __name__ == '__main__':
    cafes()
    viennoiseries()
    boissons()
    formules()
