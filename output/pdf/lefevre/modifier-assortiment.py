from pathlib import Path
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from pypdf import PdfReader,PdfWriter
from pypdf.generic import ContentStream
root=Path('/Users/manu/CloudStation/Anti Gravity/Ag - Projet site cuisine/output/pdf/lefevre')
src=Path('/Users/manu/CloudStation/Anti Gravity/RR/Boulangerie Lefevre/lefevre-formules-authentique-100x50cm.pdf')
r=PdfReader(src);w=PdfWriter(clone_from=r);page=w.pages[0]
stream=ContentStream(page.get_contents(),w)
draws=[i for i,(a,o) in enumerate(stream.operations) if o==b'Do']
assert len(draws)==8
idx=draws[-1]
matrix,op=stream.operations[idx-1]
assert op==b'cm' and abs(float(matrix[4])-856)<.01 and abs(float(matrix[0])-71)<.01
# Only delete the original decorative drink/pastry image invocation.
stream.operations.pop(idx);page.replace_contents(stream)
mem=BytesIO();c=canvas.Canvas(mem,pagesize=(1000*mm,500*mm));c.scale(mm,mm)
c.setFillColor(HexColor('#FFF9EE'));c.rect(780,10,199,60,fill=1,stroke=0)
c.saveState();p=c.beginPath();p.rect(780,10,199,60);c.clipPath(p,stroke=0)
c.setBlendMode('Multiply')
c.drawImage(str(root/'assets/formule-marques-assortiment.png'),785,7,192,64,mask='auto')
c.restoreState();c.showPage();c.save();mem.seek(0)
page.merge_page(PdfReader(mem).pages[0])
w.add_metadata({'/Title':'Nos Formules - Lefèvre - Assortiment avec marques','/Author':'Boulangerie Pâtisserie Lefèvre','/Subject':'100 x 50 cm. Visuel de formule avec quatre canettes de marque et quatre pâtisseries/viennoiseries.'})
out=root/'lefevre-formules-authentique-100x50cm-v2.pdf'
with open(out,'wb') as f:w.write(f)
assert PdfReader(out).pages[0].extract_text().split()==r.pages[0].extract_text().split()
print(out)
