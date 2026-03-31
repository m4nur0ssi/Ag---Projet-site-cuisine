const q = "gâteau au chocolat";
fetch(`https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`)
  .then(r=>r.text())
  .then(html=>{
    const vqdMatch = html.match(/vqd=["'](.*?)["']/);
    if(vqdMatch) {
       const vqd = vqdMatch[1];
       fetch(`https://duckduckgo.com/i.js?l=wt-wt&o=json&q=${encodeURIComponent(q)}&vqd=${vqd}&f=,,,,,&p=1`)
         .then(r=>r.json())
         .then(j=>{ console.log(j.results[0].image); })
    } else { console.log("No VQD found"); }
  })
