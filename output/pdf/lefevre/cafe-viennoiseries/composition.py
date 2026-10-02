from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import mm
from PIL import Image
import json
ROOT=Path(__file__).resolve().parent
F=Path('/System/Library/Fonts/Supplemental')
for n,f in [('Sans','Arial.ttf'),('Bold','Arial Bold.ttf'),('Serif','Georgia.ttf'),('SerifBold','Georgia Bold.ttf'),('Italic','Georgia Italic.ttf')]:pdfmetrics.registerFont(TTFont(n,str(F/f)))
INK='#38271D';ORANGE='#B24D26';BG='#FFF9EE';LINE='#D8BBA0';MUTED='#725744'
noirs=[('Expresso','Court et intense','1,80 €'),('Ristretto','Très court et concentré','1,80 €'),('Café allongé','Un café plus long','2,00 €'),('Double expresso','Deux doses d’expresso','3,20 €'),('Americano','Expresso et eau chaude','2,50 €'),('Décaféiné','L’arôme du café, décaféiné','1,80 €')]
lactes=[('Noisette','Expresso et touche de lait','2,00 €'),('Café crème','Expresso et lait chaud','2,80 €'),('Cappuccino','Expresso, lait et mousse onctueuse','3,50 €'),('Café latte','Expresso, lait chaud et fine mousse','3,50 €'),('Latte macchiato','Lait chaud, expresso et mousse','3,80 €'),('Moka','Expresso, chocolat et lait','4,00 €')]
vienn=[(['Croissant au beurre'],'Feuilleté doré et croustillant','1,30 €'),(['Pain au chocolat'],'Feuilleté et barres de chocolat','1,50 €'),(['Pain aux raisins'],'Crème pâtissière et raisins','1,90 €'),(['Chausson aux pommes'],'Feuilleté et compote de pommes','2,00 €'),(['Croissant aux amandes'],'Crème d’amande, amandes effilées','2,60 €'),(['Pain au chocolat','aux amandes'],'Chocolat et crème d’amande','2,80 €'),(['Pain suisse'],'Crème pâtissière et pépites de chocolat','2,30 €'),(['Briochette'],'Petite brioche moelleuse','1,50 €'),(['Pain au lait'],'Doux et moelleux','1,20 €'),(['Chouquettes'],'Les 6 - Pâte à choux et sucre perlé','1,80 €')]
class Page:
 def __init__(self,name,title):
  self.file=ROOT/name;self.c=canvas.Canvas(str(self.file),pagesize=(210*mm,297*mm),pageCompression=1);c=self.c
  c.setTitle(title+' - Boulangerie Pâtisserie Lefèvre');c.setAuthor('Boulangerie Pâtisserie Lefèvre');c.setSubject('Carte A4 authentique. Proposition de tarifs basée sur des cartes publiques consultées en septembre 2026.');c.scale(mm,mm)
  self.rect(0,0,210,297,BG)
  c.setStrokeColor(HexColor(ORANGE));c.setLineWidth(.45);c.rect(5,5,200,287,stroke=1,fill=0)
  c.setLineWidth(.15);c.rect(6.3,6.3,197.4,284.4,stroke=1,fill=0)
  self.text('Lefèvre',14,27,11.5,'SerifBold')
  self.text('BOULANGERIE PÂTISSERIE',15,35,2.8,'Bold')
  self.pic(ROOT.parent/'assets/boutique.png',151,10,44)
  self.rule(14,43,182,ORANGE,.5);self.rule(14,44.5,182,ORANGE,.15)
 def text(self,s,x,y,size=4,font='Sans',color=INK,align='left',maxw=None):
  if maxw: assert pdfmetrics.stringWidth(s,font,size)<=maxw,(s,pdfmetrics.stringWidth(s,font,size),maxw)
  c=self.c;c.setFillColor(HexColor(color));c.setFont(font,size)
  {'left':c.drawString,'right':c.drawRightString,'center':c.drawCentredString}[align](x,297-y,s)
 def rect(self,x,y,w,h,color):
  self.c.setFillColor(HexColor(color));self.c.rect(x,297-y-h,w,h,fill=1,stroke=0)
 def rule(self,x,y,w,color=LINE,weight=.2):
  c=self.c;c.setStrokeColor(HexColor(color));c.setLineWidth(weight);c.line(x,297-y,x+w,297-y)
 def pic(self,path,x,y,w):
  c=self.c;iw,ih=Image.open(path).size;c.saveState();c.setBlendMode('Multiply');c.drawImage(str(path),x,297-y-w*ih/iw,w,w*ih/iw,mask='auto');c.restoreState()
 def footer(self,left):
  self.rule(14,282,182,ORANGE,.35);self.text(left,14,288,2.7)
  self.text('Visuels d’illustration',196,288,2.4,align='right')
 def save(self):self.c.showPage();self.c.save();print(self.file)

p=Page('lefevre-carte-cafes-A4.pdf','Nos cafés')
p.text('Nos cafés',105,62,9.2,'SerifBold',ORANGE,align='center')
p.text('Du café serré aux grands lactés',105,71,3.4,'Italic',align='center')
p.pic(ROOT/'cafes.png',14,77,182)
for col,(title,items) in enumerate([('Les cafés noirs',noirs),('Les cafés lactés',lactes)]):
 x=14+96*col;right=x+86
 p.text(title,x,150,4.9,'SerifBold',ORANGE);p.rule(x,153,86,ORANGE,.4)
 for i,(name,desc,price) in enumerate(items):
  y=162+i*12.25
  p.text(name,x,y,4,'Bold',maxw=63);p.text(price,right,y,4.45,'Bold',ORANGE,align='right')
  p.text(desc,x,y+4.7,2.85,color=MUTED,maxw=86)
  if i<5:p.rule(x,y+8,86)
p.rect(12,236,186,43,ORANGE)
p.text('LA PAUSE GOURMANDE',18,245,3.4,'Bold','#FFFFFF')
p.text('1 café au choix',18,255,4.9,'SerifBold','#FFFFFF')
p.text('+ 1 pâtisserie individuelle',18,263,3.75,'Sans','#FFFFFF')
p.text('ou 1 part de gâteau au choix',18,271,3.75,'Sans','#FFFFFF')
p.text('5,00 €',191,266,14.8,'SerifBold','#FFFFFF',align='right')
p.footer('Prix en euros');p.save()

p=Page('lefevre-carte-viennoiseries-A4.pdf','Nos viennoiseries')
p.text('Nos viennoiseries',105,62,8.5,'SerifBold',ORANGE,align='center')
p.text('Les grands classiques de la boulangerie',105,71,3.35,'Italic',align='center')
p.pic(ROOT/'viennoiseries.png',14,80,182)
p.rule(14,150,182,ORANGE,.4)
for i,(title,desc,price) in enumerate(vienn):
 col=i//5;row=i%5;x=14+96*col;right=x+86;y=163+22*row
 for j,line in enumerate(title):p.text(line,x,y+4.8*j,3.85,'Bold',maxw=64)
 p.text(price,right,y,4.55,'Bold',ORANGE,align='right')
 p.text(desc,x,y+6.3+(4.8 if len(title)>1 else 0),2.75,color=MUTED,maxw=86)
 if row<4:p.rule(x,y+16.5,86)
p.footer('Prix à la pièce, sauf chouquettes : les 6');p.save()
(ROOT/'tarifs-proposes.json').write_text(json.dumps({'cafes_noirs':noirs,'cafes_lactes':lactes,'formule_cafe_et_patisserie':'5,00 €','viennoiseries':vienn},indent=2,ensure_ascii=False))
