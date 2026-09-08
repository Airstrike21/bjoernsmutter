const loginCard=document.querySelector('#loginCard');
const loginForm=document.querySelector('#loginForm');
const adminPasswordInput=document.querySelector('#adminPassword');
const loginMessage=document.querySelector('#loginMessage');
const adminArea=document.querySelector('#adminArea');
const grid=document.querySelector('#grid');
const countText=document.querySelector('#countText');
const storageText=document.querySelector('#storageText');
const emptyState=document.querySelector('#emptyState');
const adminMessage=document.querySelector('#adminMessage');
const refreshButton=document.querySelector('#refreshButton');
const logoutButton=document.querySelector('#logoutButton');
const viewer=document.querySelector('#viewer');
const viewerImage=document.querySelector('#viewerImage');
const viewerName=document.querySelector('#viewerName');
const viewerGuest=document.querySelector('#viewerGuest');
const closeViewer=document.querySelector('#closeViewer');
const selectionText=document.querySelector('#selectionText');
const selectAllButton=document.querySelector('#selectAllButton');
const clearSelectionButton=document.querySelector('#clearSelectionButton');
const approveSelectedButton=document.querySelector('#approveSelectedButton');
const unapproveSelectedButton=document.querySelector('#unapproveSelectedButton');
const downloadSelectedButton=document.querySelector('#downloadSelectedButton');
const deleteSelectedButton=document.querySelector('#deleteSelectedButton');
const downloadVisibleAllButton=document.querySelector('#downloadVisibleAllButton');
const downloadEverythingButton=document.querySelector('#downloadEverythingButton');

let password=sessionStorage.getItem('adminPassword')||'';
let items=[];
let filter='uploads';
const selected=new Set();

if(password)loadItems();

loginForm.addEventListener('submit',async e=>{e.preventDefault();password=adminPasswordInput.value;sessionStorage.setItem('adminPassword',password);await loadItems(true)});
refreshButton.addEventListener('click',()=>loadItems());
logoutButton.addEventListener('click',()=>{sessionStorage.removeItem('adminPassword');password='';selected.clear();adminArea.hidden=true;loginCard.hidden=false;adminPasswordInput.value=''});
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));b.classList.add('active');filter=b.dataset.filter;render()}));
closeViewer.addEventListener('click',()=>viewer.close());
viewer.addEventListener('click',e=>{if(e.target===viewer)viewer.close()});
selectAllButton.addEventListener('click',()=>{visibleItems().forEach(item=>selected.add(item.key));render()});
clearSelectionButton.addEventListener('click',()=>{selected.clear();render()});
approveSelectedButton.addEventListener('click',()=>batchAction('approve'));
unapproveSelectedButton.addEventListener('click',()=>batchAction('unapprove'));
deleteSelectedButton.addEventListener('click',()=>batchAction('delete'));
downloadSelectedButton.addEventListener('click',()=>downloadZip('selected',[...selected]));
downloadVisibleAllButton.addEventListener('click',()=>{
  const mode=filter==='uploads'?'all-uploads':filter==='approved'?'all-approved':'all-everything';
  downloadZip(mode);
});
downloadEverythingButton.addEventListener('click',()=>downloadZip('all-everything'));

async function loadItems(fromLogin=false){
  hideMessage();
  try{
    const r=await fetch('/api/admin/list',{headers:{'X-Admin-Password':password}}),d=await r.json();
    if(!r.ok)throw new Error(d.error||'Adminbereich konnte nicht geladen werden.');
    items=d.items;
    for(const key of [...selected])if(!items.some(item=>item.key===key))selected.delete(key);
    loginCard.hidden=true;adminArea.hidden=false;render();if(fromLogin)adminPasswordInput.value='';
  }catch(e){sessionStorage.removeItem('adminPassword');if(fromLogin){loginMessage.textContent=e.message;loginMessage.hidden=false}else{loginCard.hidden=false;adminArea.hidden=true}}
}

function visibleItems(){return items.filter(i=>filter==='all'||i.status===filter)}

function render(){
  const visible=visibleItems();
  grid.innerHTML='';
  countText.textContent=`${visible.length} Bild${visible.length===1?'':'er'}`;
  storageText.textContent=` · ${formatBytes(visible.reduce((s,i)=>s+i.size,0))}`;
  emptyState.hidden=visible.length!==0;
  updateSelectionUi();

  for(const item of visible){
    const card=document.createElement('article');card.className='photo-card';card.dataset.key=item.key;
    if(selected.has(item.key))card.classList.add('selected');

    const selectLabel=document.createElement('label');selectLabel.className='photo-select';
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=selected.has(item.key);checkbox.setAttribute('aria-label','Bild auswählen');
    checkbox.addEventListener('change',()=>{checkbox.checked?selected.add(item.key):selected.delete(item.key);card.classList.toggle('selected',checkbox.checked);updateSelectionUi()});
    selectLabel.appendChild(checkbox);card.appendChild(selectLabel);

    const image=document.createElement('img');image.loading='lazy';image.src=imageUrl(item.key);image.alt=item.originalFilename||item.filename;image.addEventListener('click',()=>openViewer(item));
    const info=document.createElement('div');info.className='photo-info';info.innerHTML=`<strong title="${escapeHtml(item.originalFilename||item.filename)}">${escapeHtml(item.originalFilename||item.filename)}</strong><small>${escapeHtml(item.guestName||'Gast')}</small><small>${formatDate(item.uploadedAt)}</small>`;
    const actions=document.createElement('div');actions.className='photo-actions';
    const download=document.createElement('a');download.href=imageUrl(item.key,true);download.textContent='Herunterladen';download.className='secondary-button';download.style.textAlign='center';download.style.textDecoration='none';actions.appendChild(download);
    actions.appendChild(item.status==='uploads'?actionButton('Für Galerie freigeben','approve','approve',item.key):actionButton('Aus Galerie entfernen','unapprove','',item.key));
    actions.appendChild(actionButton('Löschen','delete','remove',item.key));
    card.append(image,info,actions);grid.appendChild(card);
  }
}

function updateSelectionUi(){
  const selectedItems=items.filter(item=>selected.has(item.key));
  const uploads=selectedItems.filter(item=>item.status==='uploads').length;
  const approved=selectedItems.filter(item=>item.status==='approved').length;
  selectionText.textContent=`${selectedItems.length} ausgewählt`;
  approveSelectedButton.disabled=uploads===0;
  unapproveSelectedButton.disabled=approved===0;
  downloadSelectedButton.disabled=selectedItems.length===0;
  deleteSelectedButton.disabled=selectedItems.length===0;
  clearSelectionButton.disabled=selectedItems.length===0;
  selectAllButton.disabled=visibleItems().length===0;
  downloadVisibleAllButton.disabled=visibleItems().length===0;
}

async function batchAction(action){
  const selectedItems=items.filter(item=>selected.has(item.key));
  const keys=selectedItems.filter(item=>action==='delete'||(action==='approve'&&item.status==='uploads')||(action==='unapprove'&&item.status==='approved')).map(item=>item.key);
  if(keys.length===0)return;
  if(action==='delete'&&!confirm(`${keys.length} ausgewählte Bild${keys.length===1?'':'er'} wirklich dauerhaft löschen?`))return;
  const labels={approve:'Freigeben',unapprove:'Entfernen',delete:'Löschen'};
  setBatchDisabled(true);
  try{
    const r=await fetch('/api/admin/action',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Password':password},body:JSON.stringify({action,keys})});
    const d=await r.json();if(!r.ok)throw new Error(d.error||'Aktion fehlgeschlagen.');
    keys.forEach(key=>selected.delete(key));
    showMessage(`${d.processed??keys.length} Bild${(d.processed??keys.length)===1?'':'er'} verarbeitet.`,'success');
    await loadItems();
  }catch(e){showMessage(`${labels[action]} fehlgeschlagen: ${e.message}`,'error')}finally{setBatchDisabled(false)}
}

function setBatchDisabled(disabled){[approveSelectedButton,unapproveSelectedButton,downloadSelectedButton,deleteSelectedButton,selectAllButton,clearSelectionButton].forEach(b=>b.disabled=disabled)}

function downloadZip(mode,keys=[]){
  if(mode==='selected'&&keys.length===0)return;
  const form=document.createElement('form');form.method='POST';form.action='/api/download-zip';form.style.display='none';
  addHidden(form,'mode',mode);addHidden(form,'admin',password);
  if(mode==='selected')addHidden(form,'keys',JSON.stringify(keys));
  document.body.appendChild(form);form.submit();form.remove();
}
function addHidden(form,name,value){const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;form.appendChild(input)}

function actionButton(label,action,className,key){const b=document.createElement('button');b.type='button';b.textContent=label;b.className=className;b.addEventListener('click',async()=>{if(action==='delete'&&!confirm('Dieses Bild wirklich dauerhaft löschen?'))return;b.disabled=true;try{const r=await fetch('/api/admin/action',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Password':password},body:JSON.stringify({action,key})}),d=await r.json();if(!r.ok)throw new Error(d.error||'Aktion fehlgeschlagen.');selected.delete(key);await loadItems()}catch(e){showMessage(e.message,'error');b.disabled=false}});return b}
function imageUrl(key,download=false){const p=new URLSearchParams({key,admin:password});if(download)p.set('download','1');return`/api/image?${p}`}
function openViewer(item){viewerImage.src=imageUrl(item.key);viewerName.textContent=item.originalFilename||item.filename;viewerGuest.textContent=item.guestName||'Gast';viewer.showModal()}
function showMessage(text,type){adminMessage.textContent=text;adminMessage.className=`message ${type}`;adminMessage.hidden=false}
function hideMessage(){adminMessage.hidden=true}
function formatDate(v){return v?new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):''}
function formatBytes(b){if(b<1048576)return`${Math.ceil(b/1024)} KB`;if(b<1073741824)return`${(b/1048576).toFixed(1)} MB`;return`${(b/1073741824).toFixed(2)} GB`}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
