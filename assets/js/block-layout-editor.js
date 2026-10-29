const $ = (id) => document.getElementById(id);
const board = $('board');
let layout;
try { const res = await fetch('assets/ui/furnace.json'); layout = await res.json(); } catch { layout = {version:1,id:'new_block',title:'NEW BLOCK',grid:{cols:12,rows:8,cell:64},theme:{background:'#101416',panel:'#1a2021',line:'#56605b',accent:'#f07b35',text:'#e9e3d7'},elements:[]}; }
let selected = null, dragging = null;
function render() {
  const {cols,rows}=layout.grid;
  board.style.aspectRatio=`${cols}/${rows}`;
  board.style.gridTemplateColumns=`repeat(${cols},1fr)`; board.style.gridTemplateRows=`repeat(${rows},1fr)`;
  board.style.backgroundColor=layout.theme.background;
  board.style.backgroundSize=`${100/cols}% ${100/rows}%`;
  board.innerHTML='';
  layout.elements.forEach(el=>{
    const node=document.createElement('div'); node.className=`component ${el.type}${selected===el?' selected':''}`;
    node.style.left=`${el.x/cols*100}%`;node.style.top=`${el.y/rows*100}%`;node.style.width=`${el.w/cols*100}%`;node.style.height=`${el.h/rows*100}%`;
    node.style.color=layout.theme.text; if(el.type==='label')node.textContent=el.text; else if(el.type==='slot')node.textContent=`${el.label||el.role||'SLOT'}\n▧`; else if(el.type==='arrow'){const cell=board.clientWidth/cols,w=el.w*cell,h=el.h*cell,pad=Math.min(h*.12,8),head=Math.min(h*.72,w*.3),thick=Math.min(h*.22,16),mid=h/2,left=pad,right=w-pad,neck=right-head;node.innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-label="arrow"><path fill="${el.color||layout.theme.accent}" d="M ${left} ${mid-thick/2} H ${neck} V ${mid-head*.48} L ${right} ${mid} L ${neck} ${mid+head*.48} V ${mid+thick/2} H ${left} Z"/></svg>`;} else {node.textContent=el.label||'PROCESS';node.style.setProperty('--accent',el.color||layout.theme.accent)}
    node.addEventListener('pointerdown',e=>{e.stopPropagation();selected=el;dragging={el,x:e.clientX,y:e.clientY,ox:el.x,oy:el.y};render();});
    board.appendChild(node);
  });
  const setValue=(id,value)=>{const input=$(id);if(document.activeElement!==input)input.value=value;};
  setValue('title',layout.title);setValue('cols',cols);setValue('rows',rows);setValue('background',layout.theme.background);setValue('accent',layout.theme.accent);
  $('empty').hidden=!!selected;$('props').hidden=!selected;
  if(selected){for(const [id,value] of [['pType',selected.type],['pId',selected.id],['pText',selected.text||selected.label||''],['pRole',selected.role||''],['pX',selected.x],['pY',selected.y],['pW',selected.w],['pH',selected.h]])setValue(id,value);}
}
window.addEventListener('pointermove',e=>{if(!dragging)return;const {cols,rows}=layout.grid,r=board.getBoundingClientRect(),el=dragging.el;el.x=Math.max(0,Math.min(cols-el.w,dragging.ox+Math.round((e.clientX-dragging.x)/(r.width/cols))));el.y=Math.max(0,Math.min(rows-el.h,dragging.oy+Math.round((e.clientY-dragging.y)/(r.height/rows))));render();});
window.addEventListener('pointerup',()=>{dragging=null;});
document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{const type=b.dataset.add,n=layout.elements.length+1;const el={id:`${type}_${n}`,type,x:1,y:1,w:type==='label'?5:type==='arrow'?4:2,h:type==='progress'?1:2};if(type==='slot'){el.role='input';el.label='INPUT';}if(type==='progress'){el.label='PROCESS';el.color=layout.theme.accent;}if(type==='arrow')el.color=layout.theme.accent;if(type==='label'){el.text='NEW LABEL';el.size=14;}layout.elements.push(el);selected=el;render();});
for(const [id,key] of [['title','title'],['cols','cols'],['rows','rows']])$(id).oninput=()=>{if(key==='title')layout.title=$(id).value;else layout.grid[key]=+$(id).value;render();};
$('background').oninput=()=>{layout.theme.background=$('background').value;render();};$('accent').oninput=()=>{layout.theme.accent=$('accent').value;render();};
for(const [id,key,num] of [['pId','id',false],['pText','text',false],['pRole','role',false],['pX','x',true],['pY','y',true],['pW','w',true],['pH','h',true]])$(id).oninput=()=>{if(!selected)return;selected[key]=num?+$(id).value:$(id).value;if(key==='text'&&selected.type!=='label')selected.label=$(id).value;render();};
$('remove').onclick=()=>{layout.elements=layout.elements.filter(e=>e!==selected);selected=null;render();};$('export').onclick=()=>{const blob=new Blob([JSON.stringify(layout,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${layout.id||'block'}-layout.json`;a.click();URL.revokeObjectURL(a.href);};
$('load').onclick=()=>$('file').click();$('file').onchange=async e=>{const f=e.target.files[0];if(f)try{layout=JSON.parse(await f.text());selected=null;render();}catch{alert('That file is not a valid block layout JSON.');}};
render();
