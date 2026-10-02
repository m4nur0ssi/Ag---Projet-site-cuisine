from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import mm
from PIL import Image

ROOT=Path(__file__).resolve().parent
F=Path('/System/Library/Fonts/Supplemental')
for name,file in [('Sans','Arial.ttf'),('Bold','Arial Bold.ttf'),('Black','Arial Black.ttf')]:pdfmetrics.registerFont(TTFont(name,str(F/file)))
PDF=ROOT/'lefevre-prix-boissons-A4.pdf'
c=canvas.Canvas(str(PDF),pagesize=(210*mm,297*mm),pageCompression=1)
c.setTitle('Nos boissons - Boulangerie Pâtisserie Lefèvre')
c.setAuthor('Boulangerie Pâtisserie Lefèvre')
c.setSubject('Prix des boissons repris de la photographie de la vitrine. A4 portrait.')
c.scale(mm,mm)
INK='#143D3B';ORANGE='#B44923';LIGHT='#E1E8E3'
def rect(x,y,w,h,color,r=0):
 c.setFillColor(HexColor(color))
 if r:c.roundRect(x,297-y-h,w,h,r,stroke=0,fill=1)
 else:c.rect(x,297-y-h,w,h,stroke=0,fill=1)
def text(s,x,y,size=4,font='Sans',color=INK,align='left',maxwidth=None):
 if maxwidth:assert pdfmetrics.stringWidth(s,font,size)<=maxwidth,(s,maxwidth)
 c.setFillColor(HexColor(color));c.setFont(font,size)
 {'left':c.drawString,'right':c.drawRightString,'center':c.drawCentredString}[align](x,297-y,s)
def rule(x,y,w,color=LIGHT):
 c.setStrokeColor(HexColor(color));c.setLineWidth(.25);c.line(x,297-y,x+w,297-y)
def pic(path,x,y,w):
 iw,ih=Image.open(path).size;c.drawImage(str(path),x,297-y-w*ih/iw,w,w*ih/iw,mask='auto')
rect(0,0,210,297,'#FFFFFF')
rect(0,0,210,3,INK)
text('L E F È V R E',11,22,7.5,'Bold')
text('BOULANGERIE PÂTISSERIE',11,30,3.1,'Bold')
pic(ROOT.parent/'assets'/'boutique.png',154,8,45)
rule(11,41,188)
text('Nos boissons',10,57,10,'Black')
rect(10,65,190,41,INK,r=3)
text('CANETTES',17,81,7,'Bold',color='#FFFFFF')
text('Au choix',17,91,4.8,'Bold',color='#FFFFFF')
text('Hors Red Bull',17,100,3.4,color='#FFFFFF')
text('1,50 €',193,97,23,'Bold',color='#FFFFFF',align='right')
pic(ROOT/'canettes-marques.png',9,111,192)
labels=[('Coca-Cola','Original'),('Coca-Cola','Zéro sucres'),('Fanta','Orange'),('Lipton','Pêche'),('Oasis','Fraise-framboise'),('Sprite','Citron-citron vert'),('Minute Maid','Multivitamines')]
for i,(a,b) in enumerate(labels):
 x=9+(i+.5)*192/7
 text(a,x,181,3.1,'Bold',align='center',maxwidth=27)
 text(b,x,187,2.65,align='center',maxwidth=27)
rule(11,194,188)
text('AUSSI EN VITRINE',11,204,3.3,'Bold',color=ORANGE)
rect(10,210,58,65,'#F5F7F4',r=3)
# White background packshot preserved as supplied by ImageGen.
pic(ROOT/'red-bull.png',13,215,25)
text('Red Bull',39,222,4,'Bold')
text('2,30 €',39,233,5.6,'Bold',color=ORANGE)
text('Boisson',39,242,3.1)
text('énergisante',39,247,3.1)
text('Tarif spécifique',39,266,3.0,'Bold',align='center')
prices=[('Bouteilles au choix','3,00 €'),('Petites bouteilles','2,00 €'),('Lait','1,70 €'),('Eau grande','1,20 €'),('Eau petite','0,80 €'),('Capri-Sun','0,80 €')]
for i,(a,b) in enumerate(prices):
 y=219+i*10.6
 text(a,77,y,4.4,maxwidth=89)
 text(b,199,y,5.2,'Bold',color=ORANGE,align='right')
 if i<5:rule(77,y+3.5,122)
rule(11,282,188,INK)
text('Prix à l’unité',11,290,3.1,'Bold')
text('Visuels d’illustration',199,290,2.7,align='right')
c.showPage();c.save();print(PDF)
