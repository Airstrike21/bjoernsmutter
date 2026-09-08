const grid=document.querySelector('#galleryGrid');
const empty=document.querySelector('#galleryEmpty');
const message=document.querySelector('#galleryMessage');
const viewer=document.querySelector('#galleryViewer');
const viewerImage=document.querySelector('#galleryViewerImage');
const closeButton=document.querySelector('#galleryClose');
const selectionText=document.querySelector('#gallerySelectionText');
const selectVisibleButton=document.querySelector('#selectVisibleButton');
const clearSelectionButton=document.querySelector('#clearGallerySelectionButton');
const downloadSelectionButton=document.querySelector('#downloadGallerySelectionButton');
const downloadAllButton=document.querySelector('#downloadAllGalleryButton');

let items=[];
let orientation='all';
const selected=new Set();

loadGallery();
closeButton.addEventListener('click',()=>viewer.close());
viewer.addEventListener('click',e=>{if(e.target===viewer)viewer.close()});

document.querySelectorAll('.gallery-filter').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('.gallery-filter').forEach(b=>b.classList.remove('active'));
  button.classList.add('active');orientation=button.dataset.orientation;applyFilter();
}));
selectVisibleButton.addEventListener('click',()=>{visibleCards().forEach(card=>selected.add(card.dataset.key));syncSelection()});
clearSelectionButton.addEventListener('click',()=>{selected.clear();syncSelection()});
downloadSelectionButton.addEventListener('click',()=>downloadZip('selected',[...selected]));
downloadAllButton.addEventListener('click',()=>downloadZip('all-approved'));

async function loadGallery(){
  try{
    const r=await fetch('/api/gallery/list'),d=await r.json();
    if(!r.ok)throw new Error(d.error||'Galerie konnte nicht geladen werden.');
    items=d.items;empty.hidden=items.length!==0;grid.innerHTML='';
    for(const item of items)createCard(item);
    updateSelectionUi();
  }catch(e){message.textContent=e.message;message.hidden=false}
}

function createCard(item){
  const card=document.createElement('article');card.className='gallery-item';card.dataset.key=item.key;card.dataset.orientation='unknown';
  const img=document.createElement('img');img.loading='lazy';img.src=`/api/image?key=${encodeURIComponent(item.key)}`;img.alt='Hochzeitsfoto';
  img.addEventListener('load',()=>{card.dataset.orientation=getOrientation(img);applyFilter()});
  img.addEventListener('click',()=>{viewerImage.src=img.src;viewer.showModal()});

  const label=document.createElement('label');label.className='gallery-select';
  const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.setAttribute('aria-label','Bild auswählen');
  checkbox.addEventListener('change',()=>{checkbox.checked?selected.add(item.key):selected.delete(item.key);syncSelection()});
  label.appendChild(checkbox);
  card.append(img,label);grid.appendChild(card);
}

function getOrientation(img){
  if(img.naturalWidth>img.naturalHeight)return'landscape';
  if(img.naturalHeight>img.naturalWidth)return'portrait';
  return'square';
}

function applyFilter(){
  document.querySelectorAll('.gallery-item').forEach(card=>{
    const type=card.dataset.orientation;
    card.hidden=orientation!=='all'&&type!=='unknown'&&type!==orientation;
  });
  updateSelectionUi();
}
function visibleCards(){return[...document.querySelectorAll('.gallery-item')].filter(card=>!card.hidden)}

function syncSelection(){
  document.querySelectorAll('.gallery-item').forEach(card=>{
    const checked=selected.has(card.dataset.key);card.classList.toggle('selected',checked);card.querySelector('input[type="checkbox"]').checked=checked;
  });
  updateSelectionUi();
}
function updateSelectionUi(){
  selectionText.textContent=`${selected.size} ausgewählt`;
  clearSelectionButton.disabled=selected.size===0;
  downloadSelectionButton.disabled=selected.size===0;
  selectVisibleButton.disabled=visibleCards().length===0;
  downloadAllButton.disabled=items.length===0;
}

function downloadZip(mode,keys=[]){
  if(mode==='selected'&&keys.length===0)return;
  const form=document.createElement('form');form.method='POST';form.action='/api/download-zip';form.style.display='none';
  addHidden(form,'mode',mode);if(mode==='selected')addHidden(form,'keys',JSON.stringify(keys));
  document.body.appendChild(form);form.submit();form.remove();
}
function addHidden(form,name,value){const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;form.appendChild(input)}
