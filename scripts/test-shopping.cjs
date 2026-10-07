const fs=require('fs'), vm=require('vm'), assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname, '..');
const ts=require(root+'/node_modules/typescript');
function load(path, deps={}) { const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(root+'/'+path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,require:n=>deps[n]});return module.exports; }
for(const path of ['src/lib/ingredients.ts','src/mobile/lib/ingredients.ts']) {
 const i=load(path); const rec=(...names)=>({ingredients:names.map(name=>({name}))});
 const plan={Lun:{m:rec('1 ail')},Mar:{m:rec('1 ail')},Mer:{m:rec('1 ail')}};
 const items=i.buildConsolidatedItems(plan,new Set(),{});assert.equal(items.length,1);assert.equal(items[0].qty,3);
 const done=new Set(i.doneKeysOf(items[0]));assert(i.isItemDone(items[0],done));for(const d of ['Lun','Mar','Mer'])assert(i.sourceLineDone(d+'|m|0',items,done));
 assert.equal(i.buildConsolidatedItems({Lun:plan.Lun},new Set(),{})[0].qty,1);
 const first=new Set(['Lun|m|0|0']);
 const partial=i.buildConsolidatedItems(plan,new Set(),{},true,true,first);
 assert.equal(partial[0].qty,2);assert.equal(partial[0].keys.length,2);
 assert.equal(i.buildConsolidatedItems(plan,new Set(),{},true,true,done).length,0);
 const extras={manuel:{source:'manuel',ingredients:[{name:'1 ail'},{name:'2 tomates'}]},recipeA:{ingredients:[{name:'1 ail'}]}};
 const full=i.buildConsolidatedItems(plan,new Set(),extras);const garlic=full.find(x=>x.name.toLowerCase()==='ail');assert.equal(garlic.qty,5);
 const extraKey=i.extraLineKey('recipeA','1 ail');const oneExtra=new Set([extraKey+'|0']);
 assert.equal(i.buildConsolidatedItems(plan,new Set(),extras,true,true,oneExtra).find(x=>x.name.toLowerCase()==='ail').qty,4);
 assert(i.sourceLineDone(extraKey,full,oneExtra));assert(!i.sourceLineDone(i.extraLineKey('manuel','1 ail'),full,oneExtra));
 const allGarlic=new Set(i.doneKeysOf(garlic));
 assert(i.sourceLineDone(extraKey,full,allGarlic));assert(i.sourceLineDone(i.extraLineKey('manuel','1 ail'),full,allGarlic));
 assert.equal(i.buildConsolidatedItems({},new Set(),extras,false,false,allGarlic).length,1);
 const special={JourJ:{m:rec('1 ail')}};assert.equal(i.buildConsolidatedItems(special,new Set(),{},true,false)[0].qty,1);
 const weights={Lun:{m:rec('200 g farine')},Mar:{m:rec('500 g farine')}};
 assert.equal(i.buildConsolidatedItems(weights,new Set(),{},true,true,new Set(['Lun|m|0|0']))[0].qty,500);
 const g=i.buildConsolidatedItems({Lun:{m:rec('1 kg farine','200 g farine')}},new Set(),{});assert.equal(g[0].qty,1200);
 const mixed=i.buildConsolidatedItems({Lun:{m:rec('1 tomate','200 g tomate')}},new Set(),{});assert.equal(mixed[0].qty,null);assert.match(mixed[0].display,/200 g/);
 const containers=i.buildConsolidatedItems({Lun:{m:rec('2 gousses ail','1 gousse ail')}},new Set(),{});assert.equal(containers[0].unit,'gousse');assert.equal(containers[0].qty,3);
 assert.equal(i.parseIngredient('2 cuillères à soupe huile').unit,'cas');assert.equal(i.parseIngredient('1/2 tasse lait').qty,.5);
 const side={Lun:{m:{...rec('1 ail'),side:rec('1 tomate')}}};assert.equal(i.buildConsolidatedItems(side,new Set(['Lun|m|0','Lun|m|s0']),{}).length,0);
 const hidden=i.buildConsolidatedItems(plan,new Set(['Lun|m|0|0']),{});assert.equal(hidden[0].qty,2);
 assert.equal(i.buildConsolidatedItems({},new Set(),{manuel:{ingredients:[{name:'1 ail',checked:true}]}}).length,0);
 const r=load('src/lib/rayons.ts',{'./ingredients':i});assert.equal(r.autoRayon('Fécule de maïs'),'epicerie');assert.equal(r.autoRayon('Sucre glace'),'epicerie');
}
// Simulate the real content script, including repeat quantity clicks and the last item.
function extensionTest(last) {
 let now=0,id=0,timers=new Map(),messages=[],click;
 const elements=new Map(); const el=key=>{if(!elements.has(key))elements.set(key,{textContent:'',addEventListener(){},remove(){}});return elements.get(key);};
 const box={querySelector:el,addEventListener(){},remove(){}};
 const loc={hostname:'www.carrefour.fr',hash:'#mlist='+Buffer.from(JSON.stringify(['ail','tomate'])).toString('base64')+'&mi='+(last?1:0)+'&mo=https%3A%2F%2Flesrecettesmagiques.fr',href:'',pathname:'/s',origin:'https://www.carrefour.fr'};
 const storage={getItem:()=>null,setItem(){},removeItem(){}};
 const window={opener:{closed:false,postMessage:m=>messages.push(m)},addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(root+'/chrome-extension-courses/content.js','utf8'),{location:loc,document:{createElement:()=>box,documentElement:{appendChild(){}},querySelector:()=>null,addEventListener:(type,cb)=>click=cb},window,localStorage:storage,sessionStorage:storage,URLSearchParams,atob:s=>Buffer.from(s,'base64').toString('binary'),escape,decodeURIComponent,encodeURIComponent,setInterval(){},clearInterval(){},setTimeout:(cb,ms)=>{timers.set(++id,{cb,at:now+ms});return id;},clearTimeout:x=>timers.delete(x)});
 const add={nodeType:1,id:'',textContent:'Ajouter au panier',className:'',getAttribute:()=>null,matches:()=>true,closest:()=>null};
 click({composedPath:()=>[add]});now=1500;click({composedPath:()=>[add]});assert.equal(timers.size,1);assert.equal(messages.length,0);assert.equal([...timers.values()][0].at,3500);
 now=3500;[...timers.values()][0].cb();assert.equal(messages.length,1);assert.equal(messages[0].index,last?1:0);if(!last)assert.match(loc.href,/mi=1/);else assert.equal(el('.mcw-item').textContent,'✅ Liste terminée !');
}
extensionTest(false);extensionTest(true);console.log('PASS: fusion, units, daily keys, masks, sides, categories, extension delay reset and final item');
