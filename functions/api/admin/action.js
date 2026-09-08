export async function onRequestPost({request,env}){
  if(!isAdmin(request,env))return json({error:'Falsches Admin-Passwort.'},401);
  if(!env.BUCKET)return json({error:'R2-Binding BUCKET fehlt.'},500);

  const body=await request.json();
  const action=body.action;
  const keys=Array.isArray(body.keys)?[...new Set(body.keys.map(String))]:body.key?[String(body.key)]:[];
  if(keys.length===0)return json({error:'Keine Bilder ausgewählt.'},400);
  if(keys.length>10000)return json({error:'Zu viele Bilder ausgewählt.'},400);
  if(!['delete','approve','unapprove'].includes(action))return json({error:'Ungültige Aktion.'},400);
  if(keys.some(key=>!validKey(key)))return json({error:'Ungültiger Dateipfad.'},400);

  const applicable=keys.filter(key=>
    action==='delete'||
    (action==='approve'&&key.startsWith('uploads/'))||
    (action==='unapprove'&&key.startsWith('approved/'))
  );

  let processed=0;
  for(let i=0;i<applicable.length;i+=10){
    const batch=applicable.slice(i,i+10);
    await Promise.all(batch.map(async key=>{
      if(action==='delete')await env.BUCKET.delete(key);
      else if(action==='approve')await moveObject(env.BUCKET,key,key.replace(/^uploads\//,'approved/'));
      else await moveObject(env.BUCKET,key,key.replace(/^approved\//,'uploads/'));
      processed++;
    }));
  }

  return json({ok:true,processed,skipped:keys.length-applicable.length});
}

async function moveObject(bucket,sourceKey,targetKey){
  const object=await bucket.get(sourceKey);
  if(!object)throw new Error('Bild wurde nicht gefunden.');
  await bucket.put(targetKey,object.body,{httpMetadata:object.httpMetadata,customMetadata:object.customMetadata});
  await bucket.delete(sourceKey);
}
function validKey(key){return key.startsWith('uploads/')||key.startsWith('approved/')}
function isAdmin(request,env){const expected=env.ADMIN_PASSWORD||'';return expected.length>0&&(request.headers.get('X-Admin-Password')||'')===expected}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
