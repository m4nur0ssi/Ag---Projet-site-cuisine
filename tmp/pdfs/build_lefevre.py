from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from PIL import Image
import json

ROOT=Path('/Users/manu/CloudStation/Anti Gravity/Ag - Projet site cuisine/output/pdf/lefevre')
F=Path('/System/Library/Fonts/Supplemental')
for name,file in [('Sans','Arial.ttf'),('Bold','Arial Bold.ttf'),('Black','Arial Black.ttf'),('Serif','Georgia.ttf'),('SerifBold','Georgia Bold.ttf'),('Italic','Georgia Italic.ttf')]:
 pdfmetrics.registerFont(TTFont(name,str(F/file)))
DATA=[
 dict(id='thon',title=['THON'],desc=['Baguette tradition, salade, thon,','mayonnaise.'],allergens=['Blé (gluten), œuf, moutarde, poisson.'],seul='5,00 €',prix='8,00 €'),
 dict(id='dinde-beurre',title=['JAMBON DE DINDE','BEURRE'],desc=['Baguette tradition, jambon de dinde,','beurre, salade, mayonnaise.'],allergens=['Blé (gluten), œuf, moutarde, lait.'],seul='5,00 €',prix='8,00 €'),
 dict(id='dinde-fromage',title=['JAMBON DE DINDE','FROMAGE'],desc=['Baguette tradition, jambon de dinde,','fromage, salade, mayonnaise.'],allergens=['Blé (gluten), œuf, moutarde, lait.'],seul='5,00 €',prix='8,00 €'),
 dict(id='poulet',title=['POULET'],desc=['Baguette tradition, charcuterie de poulet,','salade, mayonnaise.'],allergens=['Blé (gluten), œuf, moutarde.'],seul='5,00 €',prix='8,00 €'),
 dict(id='saumon',title=['SAUMON FUMÉ'],desc=['Baguette tradition, saumon fumé,','salade, mayonnaise.'],allergens=['Blé (gluten), œuf, moutarde, poisson.'],seul='5,00 €',prix='9,00 €'),
 dict(id='fricasse',title=['FRICASSÉ'],desc=['Baguette tradition huilée, thon,','œuf, olive, salade.'],allergens=['Blé (gluten), œuf, poisson.'],seul='5,50 €',prix='8,00 €'),
]

def draw(style):
 old=style=='authentique'
 file=ROOT/f'lefevre-formules-{style}-100x50cm.pdf'
 c=canvas.Canvas(str(file),pagesize=(1000*mm,500*mm),pageCompression=1)
 c.setTitle('Nos Formules | Boulangerie Pâtisserie Lefèvre | '+style.title())
 c.setAuthor('Boulangerie Pâtisserie Lefèvre')
 c.setSubject('Affiche 100 x 50 cm. Allergènes indicatifs à confirmer avant impression. Visuels générés.')
 c.scale(mm,mm)
 ink='#30251E' if old else '#143D3B'
 accent='#A54424' if old else '#B44923'
 bg='#FFF9EE' if old else '#FFFFFF'
 line='#C6AD90' if old else '#D8E1DC'
 titlefont='SerifBold' if old else 'Black'
 def rect(x,y,w,h,fill,stroke=None,r=0):
  c.setFillColor(HexColor(fill));c.setStrokeColor(HexColor(stroke or fill));c.setLineWidth(.35)
  if r:c.roundRect(x,500-y-h,w,h,r,stroke=bool(stroke),fill=1)
  else:c.rect(x,500-y-h,w,h,stroke=bool(stroke),fill=1)
 def text(s,x,y,size=9,font='Sans',color=ink,align='left',maxwidth=None):
  if maxwidth:
   assert pdfmetrics.stringWidth(s,font,size)<=maxwidth,(s,pdfmetrics.stringWidth(s,font,size),maxwidth)
  c.setFont(font,size);c.setFillColor(HexColor(color))
  fn={'left':c.drawString,'right':c.drawRightString,'center':c.drawCentredString}[align]
  fn(x,500-y,s)
 def rule(x,y,x2,y2,color=line,width=.4):
  c.setStrokeColor(HexColor(color));c.setLineWidth(width);c.line(x,500-y,x2,500-y2)
 def pic(id,x,y,w,h=None,multiply=False,clip=None):
  path=ROOT/'assets'/f'{id}.png';iw,ih=Image.open(path).size
  if h is None:h=w*ih/iw
  c.saveState()
  if clip:
   xx,yy,ww,hh=clip;p=c.beginPath();p.rect(xx,500-yy-hh,ww,hh);c.clipPath(p,stroke=0)
  if multiply:c.setBlendMode('Multiply')
  c.drawImage(str(path),x,500-y-h,w,h,mask='auto')
  c.restoreState()
 rect(0,0,1000,500,bg)
 if old:
  c.setStrokeColor(HexColor(ink));c.setLineWidth(.6);c.rect(7,7,986,486,stroke=1,fill=0)
  c.setLineWidth(.2);c.rect(9,9,982,482,stroke=1,fill=0)
  text('Lefèvre',23,31,21,'SerifBold')
  text('BOULANGERIE PÂTISSERIE',24,44,6.5,'Bold')
  text('Nos Formules',500,37,30,'SerifBold',align='center')
  text('Sandwichs en baguette tradition française',500,56,9,'Serif',align='center')
  pic('boutique',875,11,83,multiply=True)
  rule(22,64,978,64,accent,.7)
  rule(22,67,978,67,accent,.2)
 else:
  rect(0,0,1000,5,ink)
  text('Nos Formules',20,39,32,'Black')
  text('Sandwichs en baguette tradition française',22,59,10,'Sans')
  text('L E F È V R E',978,30,17,'Bold',align='right')
  text('BOULANGERIE PÂTISSERIE',977,44,7.5,'Bold',align='right')
  text('FAIT MAISON',977,59,7.2,'Bold',color=accent,align='right')
  rule(20,66,980,66,ink,.65)
 for i,d in enumerate(DATA):
  col=i%3;row=i//3;x=22+324*col;y=74+186*row;w=308
  if col>0:rule(x-8,y,x-8,y+176,line,.3)
  if row==1:rule(x,y-5,x+w,y-5,line,.35)
  # Headings and both prices share a fixed top band.
  for k,t in enumerate(d['title']):text(t,x,y+11+11*k,10.5,titlefont,maxwidth=208)
  if old:
   rect(x+216,y,92,22,accent)
   text('FORMULE',x+220,y+8,5.3,'Bold',color='#FFFFFF')
   text(d['prix'],x+304,y+17,13,'SerifBold',color='#FFFFFF',align='right')
  else:
   rect(x+214,y,94,23,ink,r=5)
   text('FORMULE',x+220,y+8,5.3,'Bold',color='#FFFFFF')
   text(d['prix'],x+302,y+18,14,'Bold',color='#FFFFFF',align='right')
  text('Seul '+d['seul'],x+306,y+33,8.5,'Bold',color=accent,align='right')
  # Original pixels are embedded unchanged. Clip only the empty studio margin.
  # At 205 mm wide, the food remains fully inside this 111 mm image window.
  pic(d['id'],x+51,y+16,205,multiply=old,clip=(x,y+29,w,106))
  for k,t in enumerate(d['desc']):text(t,x,y+143+k*10,8.8,'Sans',maxwidth=w)
  text('Allergènes* :',x,y+166,7.4,'Bold')
  for k,t in enumerate(d['allergens']):text(t,x+48,y+166+k*8,7.4,'Sans',maxwidth=w-48)
 # Formula explainer, visually separate from the product grid.
 if old:
  rule(22,441,978,441,accent,.8)
  text('La formule',25,461,15,'SerifBold',color=accent)
  pic('formule',856,440,71,multiply=True)
  text('1 sandwich + 1 pâtisserie au choix',183,457,12.5,'SerifBold')
  text('+ 1 boisson en canette 33 cl au choix',183,475,12.5,'SerifBold')
 else:
  rect(17,439,966,43,ink,r=5)
  text('EN FORMULE',29,457,10.5,'Bold',color='#FFFFFF')
  text('1 sandwich + 1 pâtisserie au choix',209,456,12.5,'Bold',color='#FFFFFF')
  text('+ 1 boisson en canette 33 cl au choix',209,474,12.5,'Bold',color='#FFFFFF')
  rect(842,441,123,39,'#FFFFFF',r=4)
  pic('formule',873,441,58)
 text('* Allergènes indicatifs à confirmer. Pâtisseries et boissons : selon le choix. Visuels d’illustration.',500,489,6.3,'Sans',align='center')
 c.showPage();c.save();print(file)
for style in ['moderne','authentique']:draw(style)
(ROOT/'contenu.json').write_text(json.dumps(DATA,ensure_ascii=False,indent=2))
