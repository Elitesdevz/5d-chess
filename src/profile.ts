import {api,ApiError,getSession,initShell,renderAccount} from './shell.ts'
import {type PlayerCard,type ProfileEditor,type ShowcaseSkin,type HistoryEntry,type HistoryPage,type ProfileSave,BIO_LIMIT,profileHref} from './profile-model.ts'
import {itemById,setById,RARITY_COLORS} from './collection.ts'
import {KINDS,PLAYERS,type Kind,type Player} from './model.ts'
import {pieceIcon,NAMES,COLORS,drawPiece} from './art.ts'
import {itemArt,setArt} from './rewards.ts'
import {drawMovement,drawCapture} from './effects.ts'
import {framedAvatar} from './cosmetic-art.ts'
import {icon} from './icons.ts'
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T
const esc=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
let card:PlayerCard,editor:ProfileEditor,tab='games',cursor:string|null=null,loading=false,generation=0,editing=false,saving=false,editorReady=false,editorRequest=0
let selected:(ShowcaseSkin|null)[]=[]
const format=(value:number)=>new Intl.NumberFormat('en',{maximumFractionDigits:4}).format(value)
const delta=(n:number)=>`${n>0?'+':n<0?'−':''}${format(Math.abs(n))}`
function message(id:string,text=''){el(id).textContent=text;el(id).hidden=!text}
function showcaseArt(entry:ShowcaseSkin,size:number){
 const set=setById(entry.itemId);if(set)return setArt(set)
 const item=itemById(entry.itemId)!
 if(item.type==='skin')return pieceIcon(entry.kind,entry.color,size,item.id)
 if(item.type==='shape')return pieceIcon(entry.kind,entry.color,size,'default',item.id)
 if(item.type==='movement'||item.type==='capture')return `<canvas class="showcase-effect" width="320" height="180" data-effect="${item.id}" data-kind="${entry.kind}" data-color="${entry.color}" aria-label="${esc(item.name)} animation"></canvas>`
 return itemArt(item)
}
const animatedShowcases=new WeakSet<HTMLCanvasElement>()
function animateShowcase(){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches
 for(const canvas of document.querySelectorAll<HTMLCanvasElement>('.showcase-effect')){
  if(animatedShowcases.has(canvas))continue
  animatedShowcases.add(canvas)
  const ctx=canvas.getContext('2d')!,id=canvas.dataset.effect!,kind=canvas.dataset.kind as Kind,color=canvas.dataset.color as Player,start=performance.now()
  const tick=(now:number)=>{if(!canvas.isConnected)return;const p=reduced?.5:((now-start)%2600)/2600;ctx.clearRect(0,0,320,180)
   if(id.startsWith('movement-')){const at={x:45+p*230,y:90};drawMovement(ctx,id,[{x:45,y:90},at],at,p,(x,y,a)=>{ctx.save();ctx.globalAlpha=a;drawPiece(ctx,kind,color,x,y,38);ctx.restore()},reduced);drawPiece(ctx,kind,color,at.x,at.y,38)}
   else drawCapture(ctx,id,{x:160,y:90},p,()=>drawPiece(ctx,kind,color,0,0,38),reduced)
   if(!reduced)requestAnimationFrame(tick)
  };tick(start+900)
 }
}
function renderCard(){
 document.title=card.name+' · 5D Chess'
 el('player-card').innerHTML=`<div class="player-card-grain" aria-hidden="true"></div><div class="player-card-header"><div class="player-identity"><span class="eyebrow">${card.owner?'YOUR PLAYER CARD':'PLAYER CARD'}</span><h1>${esc(card.name)}</h1><div class="player-rating" title="${card.games} rated games"><span>${icon('chart')}<strong>${format(card.rating)}</strong> Elo</span><span class="player-rank">#${card.rank}</span></div></div><div class="player-portrait">${card.owner?`<button type="button" data-edit-profile aria-label="Edit your avatar and frame">${framedAvatar(card.avatar,card.frame)}</button>`:framedAvatar(card.avatar,card.frame)}${card.owner?'<button class="button edit-profile-button" type="button" data-edit-profile>Edit profile</button>':''}</div></div><p class="player-bio ${card.bio?'':'empty-bio'}">${esc(card.bio||(card.owner?'Add a few words about yourself.':'This player has not added a description.'))}</p><div class="player-record"><span><b>${card.record.played.toLocaleString()}</b> completed games</span><span><b>${card.record.wins.toLocaleString()}</b> wins</span><span><b>${card.record.draws.toLocaleString()}</b> draws</span><span><b>${card.record.losses.toLocaleString()}</b> losses</span></div><div class="showcase-heading"><h2>In the spotlight</h2><span>${card.showcase.length} / 3 items</span></div><div class="profile-showcase">${Array.from({length:3},(_,i)=>{const skin=card.showcase[i],set=skin?setById(skin.itemId):undefined,item=skin?itemById(set?.itemId??skin.itemId):undefined;return skin&&item?`<article class="showcase-piece" style="--rarity:${RARITY_COLORS[item.rarity]};--faction:${COLORS[skin.color]}"><span class="showcase-number">0${i+1}</span><div class="showcase-art">${showcaseArt(skin,180)}</div><div class="showcase-copy"><small>${item.rarity} · ${NAMES[skin.kind]}</small><h3>${esc(item.name)}</h3></div></article>`:`<article class="showcase-piece showcase-empty"><span class="showcase-number">0${i+1}</span><div class="showcase-art">${pieceIcon(['K','N','Q'][i] as Kind,'green',140)}</div>${card.owner?'<button class="button" type="button" data-edit-profile>Choose an item</button>':'<small>Showcase slot</small>'}</article>`}).join('')}</div>`
 animateShowcase()
 el('player-card').querySelectorAll<HTMLButtonElement>('[data-edit-profile]').forEach(b=>b.onclick=()=>void openEditor())
}
function entryHTML(e:HistoryEntry){
 const masked=e.kind==='anomaly',image=icon(masked?'signal':e.kind==='match'?'knight':e.kind==='dice'?'dice':'wheel'),title=masked?'<span class="glitch-title" data-text="?????">?????</span>':e.href?`<a class="history-game-link" href="${e.href}">${esc(e.title)}</a>`:esc(e.title)
 const opponent=e.opponents?.length?e.opponents.map(name=>`<a class="player-profile-link" href="${e.ai?'/chess/lobby.html#ai':profileHref(name)}">${esc(name)}</a>`).join('<span class="opponent-divider"> · </span>'):''
 return `<article class="profile-history-row ${masked?'history-anomaly':''}" data-history-kind="${e.kind}"><span class="history-symbol">${image}</span><div class="history-details"><h3>${title}</h3><p>${masked?'<span class="glitch-static" aria-hidden="true"></span>':`${esc(e.status)}${e.movement?' · '+esc(e.movement==='classic'?'Classic':e.movement==='live'?'Live':e.movement):''}${e.players?' · '+e.players+' players':''}`}</p>${opponent?`<div class="history-opponents">${opponent}</div>`:''}</div><div class="history-outcome"><strong class="${e.delta>0?'positive':e.delta<0?'negative':'neutral'}">${e.kind==='match'&&!e.delta?e.rated?'—':'Unrated':delta(e.delta)}${e.kind==='match'&&!e.delta?'':` <small>${e.unit==='elo'?'Elo':'coins'}</small>`}</strong><time datetime="${new Date(e.created).toISOString()}">${new Date(e.created).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}</time></div></article>`
}
async function loadHistory(reset=false){
 if(loading&&!reset)return
 const token=reset?++generation:generation;loading=true;el<HTMLButtonElement>('history-more').disabled=true;message('history-error')
 if(reset){cursor=null;el('history-more').hidden=true;el('player-history').innerHTML='<div class="history-loading" role="status">Loading history…</div>'}
 try{const page=await api<HistoryPage>('/profile/history?user='+encodeURIComponent(card.name)+'&tab='+tab+(cursor?'&before='+encodeURIComponent(cursor):''));if(token!==generation)return
  if(reset)el('player-history').replaceChildren();for(const row of page.items)el('player-history').insertAdjacentHTML('beforeend',entryHTML(row));if(reset&&!page.items.length)el('player-history').innerHTML=`<div class="profile-empty-history">${icon(tab==='games'?'knight':'dice')}<h3>${tab==='games'?'A new timeline':'No wagers yet'}</h3><p>${tab==='games'?'Games will appear here as this player takes their place on the board.':'Recent gambling results will appear here.'}</p></div>`
  cursor=page.next;el('history-more').textContent='Load more history';el('history-more').hidden=!cursor
 }catch(cause){if(token===generation){message('history-error',cause instanceof Error?cause.message:'History could not load.');if(reset)el('player-history').replaceChildren();el('history-more').textContent='Retry history';el('history-more').hidden=false}}
 finally{if(token===generation){loading=false;el<HTMLButtonElement>('history-more').disabled=false}}
}
function routeHistory(){tab=location.hash==='#casino'?'casino':'games';document.querySelectorAll<HTMLElement>('[data-history-tab]').forEach(a=>{if(a.dataset.historyTab===tab)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});void loadHistory(true)}
function editorArt(){el('editor-avatar').innerHTML=framedAvatar(el<HTMLSelectElement>('profile-avatar').value,el<HTMLSelectElement>('profile-frame').value)}
function renderSlot(i:number){
 const skin=selected[i],row=el('showcase-edit-'+i)
 row.innerHTML=`<span class="editor-slot-label">SHOWCASE ${i+1}</span><div class="editor-skin-art">${skin?showcaseArt(skin,110):pieceIcon(['K','N','Q'][i] as Kind,'green',110)}</div><label>Item ${i+1}<select data-skin-slot="${i}"><option value="">Empty slot</option>${editor.skins.map(s=>`<option value="${s.itemId}" ${skin?.itemId===s.itemId?'selected':''}>${esc(itemById(s.itemId)?.name??setById(s.itemId)!.name)}</option>`).join('')}</select></label>${skin?`<label>Piece type ${i+1}<select data-kind-slot="${i}">${editor.skins.find(s=>s.itemId===skin.itemId)!.kinds.map(k=>`<option value="${k}" ${skin.kind===k?'selected':''}>${NAMES[k]}</option>`).join('')}</select></label><div class="editor-factions" role="group" aria-label="Showcase ${i+1} faction">${PLAYERS.map(p=>`<button type="button" data-slot="${i}" data-faction="${p}" aria-label="${p} faction for showcase ${i+1}" aria-pressed="${skin.color===p}" style="--faction:${COLORS[p]}"></button>`).join('')}</div>`:'<p class="editor-slot-hint">Choose an owned item.</p>'}`
 animateShowcase()
 row.querySelector<HTMLSelectElement>('[data-skin-slot]')!.onchange=e=>{const id=(e.target as HTMLSelectElement).value,kinds=editor.skins.find(s=>s.itemId===id)?.kinds;selected[i]=id?{itemId:id,kind:kinds!.includes(selected[i]?.kind??'N')?(selected[i]?.kind??'N'):kinds![0],color:selected[i]?.color??'red'}:null;renderSlot(i)}
 row.querySelector<HTMLSelectElement>('[data-kind-slot]')?.addEventListener('change',e=>{selected[i]!.kind=(e.target as HTMLSelectElement).value as Kind;renderSlot(i)})
 row.querySelectorAll<HTMLButtonElement>('[data-faction]').forEach(b=>b.onclick=()=>{selected[i]!.color=b.dataset.faction as Player;renderSlot(i)})
 for(const select of el('editor-fields').querySelectorAll<HTMLSelectElement>('[data-skin-slot]')){const slot=Number(select.dataset.skinSlot);for(const option of select.options)option.disabled=!!option.value&&selected.some((s,j)=>j!==slot&&s?.itemId===option.value)}
}
async function openEditor(){
 if(!card.owner||saving)return
 const request=++editorRequest;editorReady=false;const dialog=el<HTMLDialogElement>('profile-editor');message('editor-error');el('editor-reload').hidden=true;el('editor-fields').innerHTML='<p class="history-loading">Loading your collection…</p>';el<HTMLButtonElement>('editor-save').disabled=true;if(!dialog.open)dialog.showModal();editing=true
 try{const loaded=await api<ProfileEditor>('/profile/edit');if(!dialog.open||request!==editorRequest)return;editor=loaded;selected=Array.from({length:3},(_,i)=>editor.showcase[i]?{...editor.showcase[i]}:null)
  const options=(ids:string[],value:string,empty:string)=>`<option value="default">${empty}</option>`+ids.map(id=>`<option value="${id}" ${id===value?'selected':''}>${esc(itemById(id)!.name)}</option>`).join('')
  el('editor-fields').innerHTML=`<div class="editor-identity"><div id="editor-avatar"></div><div><label>Player icon<select id="profile-avatar">${options(editor.icons,editor.avatar,'Original icon')}</select></label><label>Animated frame<select id="profile-frame">${options(editor.frames,editor.frame,'No frame')}</select></label></div></div><label class="editor-bio-label">About you<textarea id="profile-bio" rows="3" maxlength="${BIO_LIMIT}" placeholder="A few words for your player card."></textarea><small id="bio-count"></small></label><div class="editor-showcase-heading"><h3>Three items to show off</h3><p>Choose owned items and their appearance.</p></div><div class="editor-showcases">${[0,1,2].map(i=>`<div id="showcase-edit-${i}" class="showcase-editor-slot"></div>`).join('')}</div>${!editor.skins.length?'<p class="profile-message">Your collection is waiting. Explore the shop to find items.</p>':''}`
  el<HTMLTextAreaElement>('profile-bio').value=editor.bio;const count=()=>{el('bio-count').textContent=`${el<HTMLTextAreaElement>('profile-bio').value.length} / ${BIO_LIMIT}`};el('profile-bio').oninput=count;count();editorArt();el('profile-avatar').onchange=editorArt;el('profile-frame').onchange=editorArt;for(let i=0;i<3;i++)renderSlot(i);editorReady=true;el<HTMLButtonElement>('editor-save').disabled=false
 }catch(cause){if(request!==editorRequest||!dialog.open)return;message('editor-error',cause instanceof Error?cause.message:'Your collection could not load.');el('editor-reload').hidden=false}
}
async function saveProfile(event:SubmitEvent){
 event.preventDefault();if(saving||!editing||!editorReady)return
 const showcase=selected.filter((s):s is ShowcaseSkin=>!!s);if(new Set(showcase.map(s=>s.itemId)).size!==showcase.length){message('editor-error','Choose a different item for each showcase slot.');return}
 saving=true;el<HTMLButtonElement>('editor-save').disabled=true;el<HTMLButtonElement>('editor-cancel').disabled=true;el<HTMLButtonElement>('editor-close').disabled=true;message('editor-error')
 try{const result=await api<ProfileSave>('/profile',{revision:editor.revision,bio:el<HTMLTextAreaElement>('profile-bio').value,avatar:el<HTMLSelectElement>('profile-avatar').value,frame:el<HTMLSelectElement>('profile-frame').value,showcase});card=result.card;renderAccount(result.profile);renderCard();el<HTMLDialogElement>('profile-editor').close();message('profile-status','Profile saved. Your player card is ready.')}
 catch(cause){message('editor-error',cause instanceof Error?cause.message:'Your profile could not save.');if(cause instanceof ApiError&&cause.status===409)el('editor-reload').hidden=false}
 finally{saving=false;for(const id of ['editor-save','editor-cancel','editor-close'])el<HTMLButtonElement>(id).disabled=false}
}
async function init(){
 await initShell();const session=await getSession();if(!session.user){location.replace('/chess/login.html');return}
 const name=new URLSearchParams(location.search).get('user')??session.user;card=await api<PlayerCard>('/profile?user='+encodeURIComponent(name));renderCard();el('profile-loading').hidden=true;el('profile-content').hidden=false
 el('history-more').onclick=()=>void loadHistory(cursor===null);window.addEventListener('hashchange',routeHistory);routeHistory()
 const dialog=el<HTMLDialogElement>('profile-editor');for(const id of ['editor-close','editor-cancel'])el(id).onclick=()=>{if(!saving)dialog.close()};dialog.oncancel=e=>{if(saving)e.preventDefault()};dialog.onclose=()=>{editing=false;editorReady=false;editorRequest++};el('editor-reload').onclick=()=>void openEditor();el<HTMLFormElement>('profile-form').onsubmit=e=>void saveProfile(e)
 if(location.hash==='#dressing-mirror'&&card.owner)void openEditor()
}
void init().catch(cause=>{el('profile-loading').hidden=true;message('profile-error',cause instanceof Error?cause.message:'This player card could not load.')})
