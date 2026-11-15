import {caseOdds,CASE_DESCRIPTIONS} from './case-presentation.ts'
import {profileHref} from './profile-model.ts'
import {api,getSession,initShell,renderAccount} from './shell.ts'
import {type Profile} from './account-model.ts'
import {type Collectible,type ItemType,type OwnedItem,type Listing,MARKET_DESCRIPTION_LIMIT,SETS,setById,planSet,setRequirements,covers,ITEMS,ITEM_LABELS,CRATES,crateTickets,RARITIES,RARITY_COLORS,itemById,duplicateRefund} from './collection.ts'
import {type Kind,type Player,KINDS,PLAYERS} from './model.ts'
import {framedAvatar,frameArt} from './cosmetic-art.ts'
import {drawMovement,drawCapture} from './effects.ts'
import {COLORS,NAMES,pieceIcon,skinSetIcon,drawPiece} from './art.ts'
import {type Economy,type RewardReply,requestId,setArt,itemArt,itemCard,countdown,revealDrop,crateArt} from './rewards.ts'
import {icon} from './icons.ts'
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
const message=(id:string,text:string)=>{el(id).textContent=text;el(id).hidden=!text}
let state:Economy,profile:Profile,listings:Listing[]=[],slot:Kind|'icon'='K',layer:ItemType='skin',color:Player='red',preview='default',busy=false,clockOffset=0,featureType='all'
const appearanceDrafts=new Map<string,string>()
const purchaseKeys=new Map<string,string>()
const submit=async(path:string,data:Record<string,unknown>,key?:string)=>{
 if(busy)throw new Error('Please wait for the current action')
 busy=true;message('collection-error','')
 try{
  if(key){if(!purchaseKeys.has(key))purchaseKeys.set(key,requestId());data.requestId=purchaseKeys.get(key)}
  const reply=await api<RewardReply>(path,data);if(key)purchaseKeys.delete(key)
  state=reply;profile=reply.profile;clockOffset=reply.now-Date.now();renderAccount(profile);render();return reply
 }finally{busy=false;renderShop()}
}
const report=(cause:unknown)=>message('collection-error',cause instanceof Error?cause.message:'Could not complete this action')
function transaction(title:string,body:string,confirm:string,action:(dialog:HTMLDialogElement)=>Promise<void>){
 const dialog=document.createElement('dialog');dialog.className='transaction-dialog'
 dialog.innerHTML=`<h2>${title}</h2>${body}<p class="form-error" role="alert" hidden></p><div class="actions"><button class="button" type="button" data-cancel>Cancel</button><button class="button primary" type="button" data-confirm>${confirm}</button></div>`
 document.body.append(dialog);dialog.showModal();dialog.onclose=()=>dialog.remove()
 dialog.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick=()=>dialog.close()
 dialog.querySelector<HTMLButtonElement>('[data-confirm]')!.onclick=async()=>{
  const button=dialog.querySelector<HTMLButtonElement>('[data-confirm]')!;button.disabled=true
  try{await action(dialog);dialog.close()}catch(cause){const error=dialog.querySelector<HTMLElement>('.form-error')!;error.textContent=cause instanceof Error?cause.message:'Request failed';error.hidden=false;button.disabled=false}
 }
 return dialog
}
function inspectItem(item:Collectible){
 if(item.type==='movement'||item.type==='capture'){inspectEffect(item);return}
 const dialog=document.createElement('dialog');dialog.className='transaction-dialog inspect-dialog';dialog.style.setProperty('--rarity',RARITY_COLORS[item.rarity])
 const draw=(player:Player)=>{
  const set=item.type==='skin'||item.type==='shape'
  dialog.innerHTML=`<button class="dialog-close inspect-close" type="button" data-close-x aria-label="Close item preview">&times;</button><div class="inspect-art">${art(item,player)}</div><small class="rarity-label">${item.rarity} &middot; ${ITEM_LABELS[item.type]}${item.monthly?' &middot; SEASONAL':''}</small><h2>${item.name}</h2><p>${item.description}</p>${set?`<div class="inspect-roster">${KINDS.map(k=>pieceIcon(k,player,48,item.type==='skin'?item.id:'default',item.type==='shape'?item.id:undefined)).join('')}</div><div class="preview-colors" aria-label="Inspect faction color">${PLAYERS.map(p=>`<button type="button" data-variant="${p}" style="--faction:${COLORS[p]}" aria-label="Inspect ${p} variant" aria-pressed="${p===player}"></button>`).join('')}</div>`:''}<button type="button" class="button" data-close>Close preview</button>`
  dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick=()=>dialog.close();dialog.querySelector<HTMLButtonElement>('[data-close-x]')!.onclick=()=>dialog.close();dialog.querySelectorAll<HTMLButtonElement>('[data-variant]').forEach(b=>b.onclick=()=>draw(b.dataset.variant as Player))
 };draw(color);document.body.append(dialog);dialog.showModal();dialog.onclose=()=>dialog.remove()
}
function inspectEffect(item:Collectible,kind:Kind='N',faction:Player='red'){
 const dialog=document.createElement('dialog');dialog.className='transaction-dialog effect-preview-dialog';dialog.innerHTML=`<h2>${item.name}</h2><canvas width="480" height="240" aria-label="${item.name} animated board preview"></canvas><p>${item.description}</p><p class="pool-note">Cosmetic only. Applies to all your pieces, including online play.</p><button type="button" class="button" data-close>Close preview</button>`
 document.body.append(dialog);dialog.showModal();const canvas=dialog.querySelector('canvas')!,ctx=canvas.getContext('2d')!,start=performance.now(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;let frame=0
 const tick=(now:number)=>{const p=reduced?.45:((now-start)%2600)/2600;ctx.clearRect(0,0,480,240);ctx.fillStyle='#17241e';ctx.fillRect(0,0,480,240);for(let y=0;y<4;y++)for(let x=0;x<8;x++){ctx.fillStyle=(x+y)%2?'#d6d0ad22':'#697f5322';ctx.fillRect(x*60,y*60,60,60)}
 if(item.type==='movement'){const at={x:70+p*330,y:120};drawMovement(ctx,item.id,[{x:70,y:120},at],at,p,(x,y,a)=>{ctx.save();ctx.globalAlpha=a;drawPiece(ctx,kind,faction,x,y,46);ctx.restore()},reduced);drawPiece(ctx,kind,faction,at.x,at.y,46)}else{drawPiece(ctx,'R','red',180,120,46);drawCapture(ctx,item.id,{x:290,y:120},p,()=>drawPiece(ctx,'N','blue',0,0,46),reduced)}
 if(!reduced)frame=requestAnimationFrame(tick)};tick(start+800);dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick=()=>dialog.close();dialog.onclose=()=>{cancelAnimationFrame(frame);dialog.remove()}
}
function renderEffects(){
 if(inventoryTab!=='effects')return
 const inventory=state.wallet.inventory
 el('animation-grid').innerHTML=(['movement','capture'] as const).map(type=>{const equipped=state.wallet.loadout[type]??'default',items=ITEMS.filter(i=>i.type===type&&inventory.some(o=>o.itemId===i.id));return `<section class="collection-panel effect-department"><div class="section-title"><h2>${type==='movement'?'Movement trails':'Capture effects'}</h2><button class="button" type="button" data-equip-effect="default" data-effect-slot="${type}" ${equipped==='default'?'disabled':''}>Use classic</button></div><div class="effect-inventory-grid">${items.map(item=>{const copies=inventory.filter(o=>o.itemId===item.id),owned=copies.find(o=>!o.listed&&!o.pending);return `<article class="inventory-card" style="--rarity:${RARITY_COLORS[item.rarity]}"><button class="inventory-select" type="button" data-effect-preview="${item.id}">${itemArt(item)}<strong>${item.name}</strong></button><small class="rarity-label">${item.rarity} · ${copies.length} copies</small><div class="effect-actions"><button class="button" type="button" data-equip-effect="${owned?.uid??''}" data-effect-slot="${type}" ${!owned||equipped===item.id?'disabled':''}>${equipped===item.id?'Equipped':'Equip'}</button><button class="button" type="button" data-effect-copies="${item.id}">Manage / sell</button></div></article>`}).join('')||'<p class="market-empty">Collect animations from Motion Studio, Capture Theatre or mixed cases.</p>'}</div></section>`}).join('')
 el('animation-grid').querySelectorAll<HTMLButtonElement>('[data-equip-effect]').forEach(b=>b.onclick=()=>void submit('/economy/equip',{slot:b.dataset.effectSlot,uid:b.dataset.equipEffect}).then(()=>message('collection-status','Board animation updated.')).catch(report))
 el('animation-grid').querySelectorAll<HTMLButtonElement>('[data-effect-preview]').forEach(b=>b.onclick=()=>inspectEffect(itemById(b.dataset.effectPreview!)!))
 el('animation-grid').querySelectorAll<HTMLButtonElement>('[data-effect-copies]').forEach(b=>b.onclick=()=>manageCopies(b.dataset.effectCopies!))
}
const shopKeys=new Map<string,string>()
let inventoryPage=0,inventoryColumns=0,inventoryQuery=''
let shopFilter='all'
let showWelcome=false,shopVisited=false,crateFilter='all',inventoryTab='equipment',setSearch='',setType='all',setProgress='all',setLimit=18
const art=(item:Collectible,player:Player='red')=>item.type==='skin'?skinSetIcon(item.id,player):item.type==='shape'?skinSetIcon('default',player,item.id):itemArt(item)
function mountShop(id:string,key:string,draw:()=>string){if(shopKeys.get(id)===key)return;el(id).innerHTML=draw();shopKeys.set(id,key)}
function crateCard(crate:typeof CRATES[number]){
 const offer=state.caseOffers.find(o=>o.id===crate.id)!
 return `<article class="crate-card" data-crate-card="${crate.id}" data-format="${crate.setChance===1000000?'sets':crate.setChance?'hybrid':'single'}" data-category="${crate.type}" data-style="0"><div class="crate-card-stage">${crateArt(crate)}</div><div class="crate-card-copy"><small class="rarity-label">${crate.monthly?'SEASONAL':ITEM_LABELS[crate.type as ItemType]??'MIXED'}</small><h3>${crate.name}</h3><p class="case-format">${crate.setChance===1000000?'Complete Sets only':crate.setChance?'Singles + Sets':'Single cosmetics only'}</p>${crate.styles?`<div class="crate-style-picker" role="group" aria-label="${crate.name} case finish">${crate.styles.map((name,i)=>`<button type="button" data-finish="${i}" aria-pressed="${i===0}">${name}</button>`).join('')}</div>`:''}<div class="crate-card-actions"><button class="button primary" type="button" data-crate-buy="${crate.id}">${icon('coin')}${offer.price.toLocaleString()} <span>Open</span></button><button class="crate-pool-button" type="button" data-crate-pool="${crate.id}" aria-label="View ${crate.name} rewards and odds">Rewards &amp; odds</button></div></div></article>`
}
function inspectCrate(id:string){
 const crate=CRATES.find(c=>c.id===id)!,tickets=crateTickets(crate),dialog=document.createElement('dialog');dialog.className='transaction-dialog crate-catalog-dialog'
 dialog.innerHTML=`<header class="case-inspector-header"><div class="case-inspector-art">${crateArt(crate)}</div><div><p class="eyebrow">CASE ARCHIVE</p><h2>${crate.name}</h2><p>${CASE_DESCRIPTIONS[crate.id]}</p><span class="case-format">${crate.setChance===1000000?'COMPLETE SETS ONLY':crate.setChance?'SINGLE PIECES + RARE SETS':'INDIVIDUAL REWARDS'}</span></div><button class="dialog-close" data-close type="button" aria-label="Close rewards and odds">&times;</button></header><div class="odds-grid">${[...RARITIES].reverse().map(r=>`<span style="--rarity:${RARITY_COLORS[r]}"><i></i>${r}<b>${percentWeight(tickets.filter(t=>t.item.rarity===r).reduce((s,t)=>s+t.weight,0))}</b></span>`).join('')}</div><p class="pool-note">One reward per case. Odds are rounded; less than 0.01% is shown as ＜0.01%. A single skin or outline is one randomly selected piece type. Complete Sets contain every required piece.</p><div class="case-inspector-groups">${[...RARITIES].reverse().map(r=>{const rows=tickets.filter(t=>t.item.rarity===r).sort((a,b)=>Number(!!b.setId)-Number(!!a.setId)||b.weight-a.weight||a.item.name.localeCompare(b.item.name));return rows.length?`<section class="case-rarity-group" style="--rarity:${RARITY_COLORS[r]}"><header><h3>${r}</h3><span>${rows.length} rewards · ${percentWeight(rows.reduce((sum,t)=>sum+t.weight,0))}</span></header><div class="crate-reward-catalog">${rows.map(t=>`<button type="button" data-inspect="${t.item.id}" data-inspect-set="${t.setId??''}" style="--rarity:${RARITY_COLORS[r]}"><span class="case-reward-chance">${percentWeight(t.weight)}</span><span class="item-picture">${t.setId?setArt(setById(t.setId)!):itemArt(t.item,75)}</span><strong>${t.setId?setById(t.setId)!.name:t.item.name}</strong><small>${t.setId?'COMPLETE SET':t.item.type==='skin'||t.item.type==='shape'?'SINGLE PIECE':ITEM_LABELS[t.item.type]}</small></button>`).join('')}</div></section>`:''}).join('')}</div>`

 document.body.append(dialog);dialog.showModal();dialog.onclose=()=>dialog.remove();dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick=()=>dialog.close()
}
const percentWeight=caseOdds
function pieceChoice(item:Collectible){return ['skin','shape'].includes(item.type)?`<label>Piece type<select data-purchase-kind>${KINDS.map(k=>`<option value="${k}" ${slot===k||slot==='icon'&&k==='N'?'selected':''}>${NAMES[k]}</option>`).join('')}</select></label><p class="pool-note">One piece only. Collect all six for a complete Set.</p>`:''}
function directCard(id:string){const item=itemById(id)!;return `<article class="featured-card" style="--rarity:${RARITY_COLORS[item.rarity]}"><button class="feature-art-button" type="button" data-inspect="${id}"><span class="item-picture">${itemArt(item)}</span></button><small class="rarity-label">${item.rarity} · ${ITEM_LABELS[item.type]}</small><strong>${item.name}</strong><button type="button" class="button" data-buy="${id}">${item.price.toLocaleString()} coins</button></article>`}
function applyShopFilter(){
 const all=shopFilter==='all', cases=shopFilter==='cases'
 document.querySelectorAll<HTMLElement>('#shop [data-crate-card]').forEach(card=>{
  const crate=CRATES.find(c=>c.id===card.dataset.crateCard)
  const matches=crate && crateTickets(crate).some(ticket=>ticket.weight>0 && (shopFilter==='sets' ? !!ticket.setId : shopFilter==='animation' ? ticket.item.type==='movement'||ticket.item.type==='capture' : ticket.item.type===shopFilter))
  const subfilter=crateFilter==='all'||!(card.parentElement?.id==='general-crates'||card.parentElement?.id==='weekly-cases')||card.dataset.category===crateFilter
  card.hidden=!(all||cases||matches)||!subfilter
 })
 document.querySelectorAll<HTMLElement>('#daily-deal-items .featured-card, #seasonal-items .featured-card, #featured-items .featured-card').forEach(card=>{
  const id=card.querySelector<HTMLElement>('[data-inspect]')?.dataset.inspect
  const type=id?itemById(id)?.type:undefined
  card.hidden=!all && !(shopFilter==='animation' ? type==='movement'||type==='capture' : shopFilter===type)
 })
 el('etc-pack').hidden=!(all||shopFilter==='sets')
 const hasVisible=(selector:string)=>Array.from(document.querySelectorAll<HTMLElement>(selector)).some(card=>!card.hidden)
 const dailyItems=hasVisible('#daily-deal-items .featured-card'),dailyCases=hasVisible('#daily-case [data-crate-card]')
 document.querySelector<HTMLElement>('.daily-case-feature')!.hidden=!dailyCases
 el('daily-deal-items').hidden=!dailyItems
 el('daily-offers').hidden=!dailyItems&&!dailyCases
 el('weekly-case-section').hidden=!hasVisible('#weekly-cases [data-crate-card]')
 el('permanent-cases').hidden=!hasVisible('#general-crates [data-crate-card]')
 const seasonalCases=hasVisible('#monthly-crates [data-crate-card]'),seasonalItems=hasVisible('#seasonal-items .featured-card')
 el('seasonal-offers').hidden=!seasonalCases&&!seasonalItems
 el('monthly-crates').hidden=!seasonalCases
 el('seasonal-items').hidden=!seasonalItems
 document.querySelector<HTMLElement>('.seasonal-direct-heading')!.hidden=!seasonalItems
 el('weekly-direct').hidden=!hasVisible('#featured-items .featured-card')
 el('starter-note').hidden=!showWelcome||!all
 el('shop-filter-empty').hidden=all||!['daily-offers','weekly-case-section','seasonal-offers','permanent-cases','weekly-direct','etc-pack'].every(id=>el(id).hidden)
 document.querySelectorAll<HTMLElement>('[data-shop-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.shopFilter===shopFilter)))
}
function renderShop(){
 el('starter-note').hidden=!showWelcome
 mountShop('monthly-crates','monthly',()=>CRATES.filter(c=>c.monthly).map(crateCard).join(''))
 mountShop('general-crates','permanent',()=>CRATES.filter(c=>c.permanent).map(crateCard).join(''))
 mountShop('weekly-cases',JSON.stringify(state.caseOffers.filter(o=>o.window==='weekly')),()=>state.caseOffers.filter(o=>o.window==='weekly').map(o=>crateCard(CRATES.find(c=>c.id===o.id)!)).join(''))
 mountShop('daily-case',JSON.stringify(state.caseOffers.filter(o=>o.window==='daily')),()=>state.caseOffers.filter(o=>o.window==='daily').map(o=>crateCard(CRATES.find(c=>c.id===o.id)!)).join(''))
 mountShop('seasonal-items',state.seasonalItems.join(','),()=>state.seasonalItems.map(id=>directCard(id)).join(''))
 mountShop('etc-pack','etc',()=>{const set=setById('set-skin-etc')!;return `<article class="etc-set"><div class="etc-art">${setArt(set)}</div><div><span class="eyebrow">ETC / COMPLETE MYTHIC SET</span><h2>Eternal Court</h2><p>Six black-opal skins. Six exclusive Eternal Crown outlines. Every piece type, all four faction colors.</p><strong>${set.price.toLocaleString()} coins</strong><button type="button" class="button primary" data-buy-set="${set.id}">Acquire the complete Set</button></div></article>`})
 mountShop('featured-items',state.featured.join(',')+featureType,()=>state.featured.filter(id=>featureType==='all'||itemById(id)?.type===featureType).map(id=>{const item=itemById(id)!;return `<article class="featured-card" style="--rarity:${RARITY_COLORS[item.rarity]}"><span class="owned-label" data-owned="${id}" hidden>OWNED</span><button class="feature-art-button" type="button" data-inspect="${id}" aria-label="Preview ${item.name}"><span class="item-picture">${itemArt(item)}</span></button><small class="rarity-label">${item.rarity} &middot; ${ITEM_LABELS[item.type]}</small><strong>${item.name}</strong><button class="button" type="button" data-buy="${id}">${icon('coin')}${item.price.toLocaleString()}</button></article>`}).join(''))
 mountShop('daily-deal-items',JSON.stringify(state.dailyDeals),()=>state.dailyDeals.map(d=>{const item=itemById(d.itemId)!;return `<article class="featured-card daily-deal-card" style="--rarity:${RARITY_COLORS[item.rarity]}"><span class="discount-tag">SAVE 25%</span><button class="feature-art-button" type="button" data-inspect="${item.id}" aria-label="Preview ${item.name}"><span class="item-picture">${itemArt(item)}</span></button><div class="deal-copy"><small class="rarity-label">${item.rarity} &middot; ${ITEM_LABELS[item.type]}</small><strong>${item.name}</strong><button class="button" type="button" data-daily-buy="${item.id}">${icon('coin')}${d.price.toLocaleString()} <s>${d.originalPrice.toLocaleString()}</s></button></div></article>`}).join(''))
 document.querySelectorAll<HTMLButtonElement>('[data-crate-buy]').forEach(b=>{b.disabled=busy||state.wallet.coins<(state.caseOffers.find(o=>o.id===b.dataset.crateBuy)?.price??Infinity)})
 document.querySelectorAll<HTMLButtonElement>('[data-buy-set]').forEach(b=>b.disabled=busy||state.wallet.coins<setById(b.dataset.buySet!)!.price)
 document.querySelectorAll<HTMLButtonElement>('[data-buy],[data-daily-buy]').forEach(b=>{const id=b.dataset.buy??b.dataset.dailyBuy!,price=b.dataset.buy?itemById(id)!.price:state.dailyDeals.find(d=>d.itemId===id)!.price;b.disabled=busy||state.wallet.coins<price})
 document.querySelectorAll<HTMLElement>('[data-owned]').forEach(b=>b.hidden=!state.wallet.inventory.some(o=>o.itemId===b.dataset.owned))
 document.querySelectorAll<HTMLElement>('[data-feature-type]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.featureType===featureType)))
 applyShopFilter()
}
function bindShop(){
 document.addEventListener('click',event=>{
  const b=(event.target as Element).closest<HTMLElement>('button');if(!b)return
  if(b.dataset.shopFilter){shopFilter=b.dataset.shopFilter;crateFilter='all';document.querySelectorAll<HTMLElement>('[data-crate-filter]').forEach(f=>f.setAttribute('aria-pressed',String(f.dataset.crateFilter==='all')));applyShopFilter();return}
  if(b.dataset.inspectSet){const set=setById(b.dataset.inspectSet)!;const dialog=document.createElement('dialog');dialog.className='transaction-dialog inspect-set-dialog';dialog.innerHTML=`<h2>${set.name}</h2><div class="set-preview-roster">${setArt(set)}</div><p>One complete Set reward contains every member below. All four faction colors are included.</p><div class="set-member-list">${setRequirements(set).map(r=>`<span>${itemArt(itemById(r.itemId)!,30,r.kind)}${NAMES[r.kind]} · ${itemById(r.itemId)!.name}</span>`).join('')}</div><button class="button" type="button" data-close>Close Set preview</button>`;document.body.append(dialog);dialog.showModal();dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();return}
  if(b.dataset.inspect){inspectItem(itemById(b.dataset.inspect)!);return}
  if(b.dataset.finish){const card=b.closest<HTMLElement>('[data-crate-card]')!;card.dataset.style=b.dataset.finish;card.querySelectorAll<HTMLElement>('[data-finish]').forEach(f=>f.setAttribute('aria-pressed',String(f===b)));return}
  if(b.dataset.cratePool){inspectCrate(b.dataset.cratePool);return}
  if(b.dataset.crateFilter){crateFilter=b.dataset.crateFilter;document.querySelectorAll<HTMLElement>('[data-crate-filter]').forEach(f=>f.setAttribute('aria-pressed',String(f===b)));document.querySelectorAll<HTMLElement>('#general-crates [data-crate-card],#weekly-cases [data-crate-card]').forEach(c=>c.hidden=crateFilter!=='all'&&c.dataset.category!==crateFilter);applyShopFilter();return}
  if(b.dataset.buySet){const set=setById(b.dataset.buySet)!;transaction('Acquire '+set.name+'?',`<div class="set-preview-roster">${setArt(set)}</div><p>${set.price.toLocaleString()} coins · ${setRequirements(set).length} individual cosmetics · All required skins and outlines included.</p>`,'Buy complete Set',async()=>{await submit('/economy/buy-set',{setId:set.id},'buy-set:'+set.id);message('collection-status','Complete Set added to Collections.')});return}
  if(b.dataset.crateBuy){
   const crate=CRATES.find(c=>c.id===b.dataset.crateBuy)!,month=state.month,finish=Number(b.closest<HTMLElement>('[data-crate-card]')?.dataset.style??0)
   const tickets=crateTickets(crate),offer=state.caseOffers.find(o=>o.id===crate.id)!
   transaction(`Open ${crate.name}?`,`<div class="purchase-crate-preview" data-crate-card="${crate.id}" data-style="${finish}">${crateArt(crate)}</div><p>${icon('coin')} <strong>${offer.price.toLocaleString()} coins</strong> &middot; 1 ${crate.setChance===1000000?'complete Set':'reward'}</p><div class="odds-grid">${RARITIES.map(r=>`<span style="--rarity:${RARITY_COLORS[r]}"><i></i>${r}<b>${percentWeight(tickets.filter(t=>t.item.rarity===r).reduce((s,t)=>s+t.weight,0))}</b></span>`).join('')}</div><p class="pool-note">Duplicates are possible. Case finishes share the same rewards and odds.</p>`,'Buy & open',async d=>{const data=await submit('/economy/case',{case:crate.id,month,offerKey:offer.key,expectedPrice:offer.price},'crate:'+crate.id);d.close();await revealDrop(data.drop!,'crate',crate.tier,next=>{state=next;render()},crate.id,finish,(offer,month)=>submit('/economy/case',{case:crate.id,month,offerKey:offer.key,expectedPrice:offer.price},'crate:'+crate.id))})
  }
  const id=b.dataset.dailyBuy??b.dataset.buy
  if(id){const item=itemById(id)!,price=b.dataset.dailyBuy?state.dailyDeals.find(d=>d.itemId===id)!.price:item.price;transaction(`Buy ${item.name}?`,`<div class="item-picture">${art(item)}</div><p><strong>${price.toLocaleString()} coins</strong>${state.wallet.inventory.some(o=>o.itemId===id)?' &middot; Adds another tradable copy.':''}</p>${pieceChoice(item)}`,'Buy item',async d=>{await submit('/economy/buy',{itemId:id,expectedPrice:price,kind:d.querySelector<HTMLSelectElement>('[data-purchase-kind]')?.value},'buy:'+id);message('collection-status',`${item.name} added to your inventory.`)})}
 })
 el('dismiss-welcome').onclick=()=>{showWelcome=false;el('starter-note').hidden=true}
}
function selectedItem(){return itemById(state.wallet.inventory.find(o=>o.uid===preview)?.itemId??'')}
const slotType=():ItemType=>layer
const shapeFor=(kind:Kind)=>state.wallet.loadout.shapes?.[kind]??state.wallet.loadout.shape??'default'
const currentAppearance=(type:ItemType,kind:Kind|'icon'=slot)=>type==='movement'||type==='capture'?(kind==='icon'?'default':state.wallet.loadout[type==='movement'?'movements':'captures']?.[kind]??state.wallet.loadout[type]??'default'):type==='icon'?state.wallet.loadout.icon:type==='frame'?state.wallet.loadout.frame??'default':type==='shape'?shapeFor(kind as Kind):state.wallet.loadout.pieces[kind as Kind]??'default'
const draftAppearance=(type:ItemType)=>appearanceDrafts.get(`${slot}:${type}`)??currentAppearance(type)
const equippedId=()=>currentAppearance(layer)
const ownedId=(id:string)=>id==='default'?'default':state.wallet.inventory.find(o=>covers(o,id,slot==='icon'?undefined:slot)&&!o.pending&&!o.listed)?.uid
function chooseLayer(next:ItemType){layer=next;preview=ownedId(draftAppearance(layer))??'default';renderInventory()}
function previewArt(id:string,kind:Kind='N'){
 const primary=slot==='icon'?'icon':'skin',secondary=slot==='icon'?'frame':'shape'
 const first=layer===primary?id:draftAppearance(primary),second=layer===secondary?id:draftAppearance(secondary)
 return slot==='icon'?framedAvatar(first,second):pieceIcon(kind,color,210,first,second)
}
function renderPreview(){
 const item=selectedItem(),id=item?.id??'default',kind:Kind=slot==='icon'?'N':slot
 if(slot!=='icon'&&(layer==='movement'||layer==='capture')){
  const equipped=currentAppearance(layer),uid=ownedId(id),unavailable=!uid
  const skin=draftAppearance('skin'),outline=draftAppearance('shape')
  el('equipment-preview').innerHTML=`<div class="preview-canvas effect-stage">${pieceIcon(kind,color,140,skin,outline)}${item?`<span class="effect-preview-mark">${itemArt(item)}</span>`:''}</div><div class="preview-colors">${PLAYERS.map(p=>`<button type="button" data-color="${p}" style="--faction:${COLORS[p]}" aria-label="${p} variant" aria-pressed="${p===color}"></button>`).join('')}</div><div class="look-summary"><span><small>SKIN</small><strong>${itemById(skin)?.name??'Classic'}</strong></span><b>+</b><span><small>OUTLINE</small><strong>${itemById(outline)?.name??'Classic'}</strong></span></div><h2>${item?.name??'Classic'}</h2><p>${layer==='movement'?'Movement animation':'Capture animation'} - ${NAMES[kind]}</p>${item?'<button class="button" type="button" id="preview-effect">Preview animation</button>':''}<div class="equip-actions"><button class="button primary" id="equip-preview" type="button" ${unavailable||id===equipped?'disabled':''}>${unavailable?'Item unavailable':id===equipped?'Equipped':'Equip animation'}</button></div>`
  el('equipment-preview').querySelectorAll<HTMLButtonElement>('[data-color]').forEach(b=>b.onclick=()=>{color=b.dataset.color as Player;renderInventory()})
  el('preview-effect')?.addEventListener('click',()=>{if(item)inspectEffect(item,kind,color)})
  el('equip-preview').onclick=()=>void submit('/economy/equip',{slot:`${layer}-${kind}`,uid}).then(()=>message('collection-status','Animation updated.')).catch(report)
  el('inventory-grid').querySelectorAll<HTMLElement>('[data-preview]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preview===preview)))
  return
 }
 const primary=slot==='icon'?'icon':'skin',secondary=slot==='icon'?'frame':'shape',first=draftAppearance(primary),second=draftAppearance(secondary)
 const fullDesign=KINDS.every(k=>state.wallet.inventory.some(o=>covers(o,first,k)&&!o.pending&&!o.listed))
 const unchanged=first===currentAppearance(primary)&&second===currentAppearance(secondary),firstUid=ownedId(first),secondUid=ownedId(second)
 const owned=state.wallet.inventory.find(o=>o.uid===preview),usable=!!firstUid&&!!secondUid&&(!owned||!owned.listed&&!owned.pending)
 el('equipment-preview').style.setProperty('--rarity',item?RARITY_COLORS[item.rarity]:'#a9c486')
 const largeArt=slot==='icon'?framedAvatar(first,second):pieceIcon(kind,color,210,first,second)
 const name=(value:string,fallback:string)=>itemById(value)?.name??fallback
 el('equipment-preview').innerHTML=`<div class="preview-canvas"><span class="preview-stage-label">${slot==='icon'?'PLAYER IDENTITY':NAMES[kind].toUpperCase()}</span>${largeArt}<span class="preview-plinth"></span></div>${slot!=='icon'?`<div class="preview-colors">${PLAYERS.map(p=>`<button type="button" data-color="${p}" style="--faction:${COLORS[p]}" aria-label="${p} variant" aria-pressed="${p===color}"></button>`).join('')}</div>`:'<div style="height:20px"></div>'}<div class="look-summary"><span><small>${primary==='icon'?'ICON':'SKIN'}</small><strong>${name(first,primary==='icon'?'Player':'Classic')}</strong></span><b>+</b><span><small>${secondary==='frame'?'FRAME':'OUTLINE'}</small><strong>${name(second,secondary==='frame'?'No frame':'Classic')}</strong></span></div><h2>${slot==='icon'?'Player icon':NAMES[kind]}</h2><div class="equip-actions"><button class="button primary" id="equip-preview" type="button" ${!usable||unchanged?'disabled':''}>${unchanged?'Equipped':!usable?owned?.pending?'Keep or refund below':'Item unavailable':'Equip look'}</button>${slot!=='icon'&&layer==='skin'?`<button class="button" id="equip-set" type="button" ${!fullDesign||KINDS.every(k=>(state.wallet.loadout.pieces[k]??'default')===first)?'disabled':''}>${KINDS.every(k=>(state.wallet.loadout.pieces[k]??'default')===first)?'Full set equipped':'Equip full skin set'}</button>`:''}</div>`
 el('equipment-preview').querySelectorAll<HTMLButtonElement>('[data-color]').forEach(b=>b.onclick=()=>{color=b.dataset.color as Player;renderInventory()})
 el('equip-preview').onclick=()=>void submit('/economy/equip-look',{target:slot,primary:firstUid,secondary:secondUid}).then(()=>message('collection-status','Appearance updated.')).catch(report)
 el('equip-set')?.addEventListener('click',()=>void submit('/economy/equip-design',{itemId:first}).then(()=>{for(const k of KINDS)appearanceDrafts.delete(`${k}:skin`);message('collection-status','Full skin set equipped.')}).catch(report))
 el('inventory-grid').querySelectorAll<HTMLElement>('[data-preview]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preview===preview)))
}
function manageCopies(itemId:string){
 const item=itemById(itemId)!,dialog=document.createElement('dialog');dialog.className='transaction-dialog copies-dialog'
 const draw=()=>{
 const copies=state.wallet.inventory.filter(o=>o.itemId===itemId).sort((a,b)=>Number(b.pending)-Number(a.pending)||b.acquired-a.acquired)
 dialog.innerHTML=`<h2>${item.name}</h2><p>${copies.length} individual ${copies.length===1?'copy':'copies'} · Your equipped style stays available while you keep a usable copy.</p><div class="copy-list">${copies.map(o=>`<div class="copy-row"><div><strong>${o.kind?NAMES[o.kind]+' · ':''}${o.pending?'Duplicate reward':o.listed?'On the market':o.kind?'Available':'Legacy universal copy'}</strong><small>${new Date(o.acquired).toLocaleDateString('en-GB')} · ${o.uid.slice(-6)}</small></div><div>${o.pending?`<button class="button" data-keep="${o.uid}">Keep copy</button><button class="button" data-refund="${o.uid}">Refund ${duplicateRefund(item)}</button>`:o.listed?`<button class="button" data-cancel-copy="${o.listed}">Cancel listing</button>`:`<button class="button" data-sell-copy="${o.uid}">Sell copy</button>`}</div></div>`).join('')}</div><button class="button" data-close>Done</button>`
 dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick=()=>dialog.close()
 for(const key of ['keep','refund'])dialog.querySelectorAll<HTMLButtonElement>(`[data-${key}]`).forEach(b=>b.onclick=()=>void submit('/economy/duplicate',{uid:b.dataset[key],refund:key==='refund'}).then(draw).catch(report))
 dialog.querySelectorAll<HTMLButtonElement>('[data-sell-copy]').forEach(b=>b.onclick=()=>{dialog.close();sell(b.dataset.sellCopy!)})
 dialog.querySelectorAll<HTMLButtonElement>('[data-cancel-copy]').forEach(b=>b.onclick=()=>{dialog.close();cancel(b.dataset.cancelCopy!)})
 };draw();document.body.append(dialog);dialog.showModal();dialog.onclose=()=>dialog.remove()
}
function renderInventory(){
 const equipped=equippedId(),type=slotType(),chosen=state.wallet.inventory.find(o=>o.uid===preview)
 if(chosen&&(chosen.listed||chosen.pending)){const usable=state.wallet.inventory.find(o=>o.itemId===chosen.itemId&&!o.listed&&!o.pending);if(usable)preview=usable.uid}
 if(preview!=='default'&&!state.wallet.inventory.some(o=>o.uid===preview))preview='default'
 const rarity=el<HTMLSelectElement>('inventory-rarity').value,search=el<HTMLInputElement>('inventory-search').value.trim().toLowerCase(),status=el<HTMLSelectElement>('inventory-status').value
 const grouped=new Map<string,OwnedItem[]>()
 for(const owned of state.wallet.inventory){const item=itemById(owned.itemId);if(!item||item.type!==type||slot!=='icon'&&owned.kind&&owned.kind!==slot)continue;const group=grouped.get(item.id)??[];group.push(owned);grouped.set(item.id,group)}
 const groups=[...grouped.entries()].filter(([id,copies])=>{const item=itemById(id)!;return (rarity==='all'||item.rarity===rarity)&&(!search||item.name.toLowerCase().includes(search))&&(status==='all'||status==='duplicates'&&copies.length>1||status==='attention'&&copies.some(o=>o.pending||o.listed))}).sort(([a,ac],[b,bc])=>Number(bc.some(o=>o.pending))-Number(ac.some(o=>o.pending))||RARITIES.indexOf(itemById(b)!.rarity)-RARITIES.indexOf(itemById(a)!.rarity)||itemById(a)!.name.localeCompare(itemById(b)!.name))
 const pendingCount=state.wallet.inventory.filter(o=>o.pending).length,caseCount=state.wallet.cases?.length??0
 el('inventory-attention').hidden=!pendingCount
 el('inventory-attention-text').textContent=`${pendingCount} ${pendingCount===1?'reward needs':'rewards need'} your decision`
 el('inventory-case-count').hidden=!caseCount
 el('inventory-case-count').textContent=String(caseCount)
 el('inventory-clear-filters').hidden=rarity==='all'&&!search&&status==='all'
 el('armory-title').textContent=type==='skin'?`${NAMES[slot as Kind]} skins`:type==='shape'?`${NAMES[slot as Kind]} outlines`:type==='frame'?'Icon frames':type==='movement'?`${NAMES[slot as Kind]} movement`:type==='capture'?`${NAMES[slot as Kind]} kills`:'Player icons';el('armory-count').textContent=`${groups.length} ${groups.length===1?'design':'designs'}`
 el('equipment-slots').innerHTML=[...KINDS,'icon'].map(k=>`<button type="button" data-slot="${k}" aria-pressed="${slot===k}">${k==='icon'?framedAvatar(state.wallet.loadout.icon,state.wallet.loadout.frame):pieceIcon(k as Kind,color,32,state.wallet.loadout.pieces[k as Kind]??'default',shapeFor(k as Kind))}<span>${k==='icon'?'Player icon':NAMES[k as Kind]}</span></button>`).join('')
 el('equipment-slots').querySelectorAll<HTMLButtonElement>('[data-slot]').forEach(b=>b.onclick=()=>{slot=b.dataset.slot as typeof slot;layer=slot==='icon'?(layer==='frame'?'frame':'icon'):(layer==='shape'?'shape':'skin');preview=ownedId(draftAppearance(layer))??'default';renderInventory()})
 const layers:ItemType[]=slot==='icon'?['icon','frame']:['skin','shape','movement','capture']
 el('inventory-layers').innerHTML=layers.map(l=>`<button type="button" data-layer="${l}" aria-pressed="${layer===l}">${l==='shape'?'Outline':l==='skin'?'Skin':l==='frame'?'Animated frame':l==='movement'?'Movement':l==='capture'?'Kill':'Icon'}</button>`).join('')
 el('inventory-layers').querySelectorAll<HTMLButtonElement>('[data-layer]').forEach(b=>b.onclick=()=>chooseLayer(b.dataset.layer as ItemType))
 const query=[slot,type,rarity,search,status].join('|')
 if(query!==inventoryQuery){inventoryPage=0;inventoryQuery=query}
 const width=el('inventory-grid').clientWidth,minimum=innerWidth<=600?94:128,gap=innerWidth<=600?7:8
 const columns=width?Math.max(1,Math.floor((width+gap)/(minimum+gap))):Math.max(1,inventoryColumns||2)
 inventoryColumns=columns
 const defaultName=type==='frame'?'No frame':type==='icon'?'Player':type==='movement'||type==='capture'?'Classic animation':'Classic pieces'
 const defaultCard=(rarity==='all'&&!search&&status==='all'?`<article class="owned-card" style="--rarity:#a9c486"><button class="preview-item" type="button" data-preview="default"><span class="item-picture">${type==='movement'||type==='capture'?pieceIcon(slot as Kind,color,60):previewArt('default',slot==='icon'?'N':slot)}</span><strong>${defaultName}</strong></button><small class="copy-tag">${equipped==='default'?'Equipped':'Default'}</small></article>`:'')
 const cards=groups.map(([id,copies])=>{
  const item=itemById(id)!,available=copies.find(o=>!o.pending&&!o.listed),pending=copies.find(o=>o.pending),owned=available??pending??copies[0]
  return `<article class="owned-card ${equipped===id?'equipped-card':''}" style="--rarity:${RARITY_COLORS[item.rarity]}"><button class="preview-item" type="button" data-preview="${owned.uid}"><span class="item-picture">${type==='movement'||type==='capture'?itemArt(item):previewArt(id,slot==='icon'?'N':slot)}</span><small class="rarity-label">${item.rarity}${item.monthly?' &middot; SEASONAL':''}</small><strong>${item.name}</strong></button><small class="copy-tag ${pending?'pending':''}">${pending?'Duplicate choice waiting':equipped===id?'Equipped &middot; ':''}${copies.length} ${copies.length===1?'copy':'copies'}</small><button class="manage-copy-link" type="button" data-manage="${id}">${pending?'Resolve reward':copies.some(o=>o.listed)?'Manage listing':'Manage copies'}</button></article>`
 })
 if(defaultCard)cards.unshift(defaultCard)
 const pageCount=Math.max(1,Math.ceil(cards.length/(columns*2)))
 inventoryPage=Math.min(inventoryPage,pageCount-1)
 el('inventory-grid').innerHTML=cards.slice(inventoryPage*columns*2,(inventoryPage+1)*columns*2).join('')
 el('inventory-pagination').hidden=pageCount<=1
 el<HTMLButtonElement>('inventory-prev').disabled=inventoryPage===0
 el<HTMLButtonElement>('inventory-next').disabled=inventoryPage>=pageCount-1
 el('inventory-page-label').textContent=`${inventoryPage+1} / ${pageCount}`
 if(!groups.length)el('inventory-grid').insertAdjacentHTML('beforeend',`<div class="inventory-empty"><strong>${grouped.size?'No designs found':'Nothing here yet'}</strong><p>${grouped.size?'Try another search or clear your filters.':'Explore the shop to find a look you love.'}</p>${grouped.size?'':'<a class="button" href="#shop">Explore shop</a>'}</div>`)
 el('inventory-grid').querySelectorAll<HTMLButtonElement>('[data-preview]').forEach(b=>b.onclick=()=>{preview=b.dataset.preview!;appearanceDrafts.set(`${slot}:${layer}`,state.wallet.inventory.find(o=>o.uid===preview)?.itemId??'default');renderPreview();if(matchMedia('(max-width: 600px)').matches)el('equipment-preview').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})})
 el('inventory-grid').querySelectorAll<HTMLButtonElement>('[data-manage]').forEach(b=>b.onclick=()=>manageCopies(b.dataset.manage!))
 el('inventory-grid').querySelectorAll<HTMLButtonElement>('[data-sell]').forEach(b=>b.onclick=()=>sell(b.dataset.sell!))
 renderPreview()
}
function renderOwnedCases(){
 const cases=state.wallet.cases??[]
 el('owned-case-grid').innerHTML=cases.map(o=>{const c=CRATES.find(c=>c.id===o.caseId)!;return `<article class="crate-card"><div class="crate-card-stage">${crateArt(c)}</div><div class="crate-card-copy"><small>UNOPENED CASE · OWNED</small><h3>${c.name}</h3><button type="button" class="button primary" data-open-owned="${o.uid}">Open case</button><button type="button" class="crate-pool-button" data-crate-pool="${c.id}">Rewards &amp; odds</button></div></article>`}).join('')||'<p class="market-empty">Case rewards from the daily wheel appear here.</p>'
 el('owned-case-grid').querySelectorAll<HTMLButtonElement>('[data-open-owned]').forEach(b=>b.onclick=()=>{const o=cases.find(c=>c.uid===b.dataset.openOwned)!,c=CRATES.find(c=>c.id===o.caseId)!;transaction('Open your '+c.name+'?',`<div class="purchase-crate-preview">${crateArt(c)}</div><p>No coins required. One owned case will be consumed.</p>`,'Open owned case',async d=>{const data=await submit('/economy/open-case',{caseUid:o.uid},'open-owned:'+o.uid);d.close();await revealDrop(data.drop!,'crate',c.tier,next=>{state=next;render()},c.id,0,(offer,month)=>submit('/economy/case',{case:c.id,month,offerKey:offer.key,expectedPrice:offer.price},'crate:'+c.id))})})
}
function renderSets(){
 if(inventoryTab!=='sets')return
 const entries=SETS.map(set=>{
  const requirements=setRequirements(set),plan=planSet(state.wallet.inventory,set)
  const owned=requirements.filter(r=>state.wallet.inventory.some(o=>covers(o,r.itemId,r.kind))).length
  return {set,requirements,plan,owned}
 })
 const rows=entries.filter(({set,plan,owned})=>(!setSearch||set.name.toLowerCase().includes(setSearch))&&(setType==='all'||setType==='combined'&&!!set.skinId&&!!set.outlineId||setType==='skin'&&!!set.skinId&&!set.outlineId||setType==='outline'&&!!set.outlineId&&!set.skinId)&&(setProgress==='all'||setProgress==='started'&&owned>0||setProgress==='complete'&&plan.complete||setProgress==='unstarted'&&owned===0))
  .sort((a,b)=>Number(b.owned>0)-Number(a.owned>0)||b.owned/b.requirements.length-a.owned/a.requirements.length||a.set.name.localeCompare(b.set.name))
 const visible=rows.slice(0,setLimit)
 el('set-summary').textContent=`${entries.filter(e=>e.owned>0).length} started / ${SETS.length} sets - ${entries.filter(e=>e.plan.complete).length} ready to equip`
 let lastGroup=''
 el('set-grid').innerHTML=visible.map(({set:s,plan:p,requirements,owned})=>{
  const group=owned?'In your collection':'Not started',heading=group!==lastGroup?`<h3 class="set-group-heading">${group}</h3>`:'';lastGroup=group
  return `${heading}<article class="set-card ${p.complete?'set-complete':''} ${owned?'':'set-unstarted'}" data-set-id="${s.id}" data-owned-progress="${owned}" style="--rarity:${RARITY_COLORS[itemById(s.itemId)!.rarity]}"><div class="set-card-art">${setArt(s)}</div><span class="rarity-label">${s.outlineId&&s.skinId?'SKINS + REQUIRED OUTLINES':s.skinId?'SKIN SET':'OUTLINE SET'}</span><h3>${s.name}</h3><progress value="${owned}" max="${p.total}" aria-label="${s.name} collected"></progress><p>${owned} / ${p.total} pieces collected${owned!==p.collected?` - ${p.collected} available`:''}</p><div class="set-piece-grid">${requirements.map(r=>{
   const copies=state.wallet.inventory.filter(o=>covers(o,r.itemId,r.kind)),available=copies.some(o=>!o.pending&&!o.listed)
   const status=available?'Collected':copies.length?'Unavailable':'Missing'
   return `<span class="${available?'collected':copies.length?'unavailable':'missing'}" title="${NAMES[r.kind]} ${itemById(r.itemId)!.type==='skin'?'skin':'outline'} - ${status}" aria-label="${NAMES[r.kind]} ${itemById(r.itemId)!.type==='skin'?'skin':'outline'}: ${status}">${itemArt(itemById(r.itemId)!,28,r.kind)}</span>`
  }).join('')}</div><div class="set-card-actions"><button class="button" type="button" data-equip-collection="${s.id}" ${!p.complete?'disabled':''}>Equip Set</button><button class="button primary" type="button" data-sell-set="${s.id}" ${!p.complete?'disabled':''}>Sell complete Set</button></div></article>`
 }).join('')||'<p class="market-empty">No Sets match these filters.</p>'
 el('set-more').hidden=rows.length<=setLimit
 el('set-grid').querySelectorAll<HTMLButtonElement>('[data-equip-collection]').forEach(b=>b.onclick=()=>void submit('/economy/equip-collection',{setId:b.dataset.equipCollection}).then(()=>message('collection-status','Complete Set equipped.')).catch(report))
 el('set-grid').querySelectorAll<HTMLButtonElement>('[data-sell-set]').forEach(b=>b.onclick=()=>sellSet(b.dataset.sellSet!))
}
function sellSet(setId:string){
 const set=setById(setId)!,key=requestId(),p=planSet(state.wallet.inventory,set)
 transaction('Sell '+set.name+'?',`<div class="set-preview-roster">${setArt(set)}</div><p>${p.total} required cosmetics will be sold together in one listing. Legacy universal copies retain their full rights when transferred. Listed pieces are locked and unequipped when no available spare remains.</p><label>Set price in coins<input id="set-price" type="number" min="1" max="100000000" step="1" required value="${set.price}"></label><label>Seller’s note (optional)<textarea id="set-description" maxlength="240" rows="3"></textarea></label>`,'List complete Set',async d=>{const price=d.querySelector<HTMLInputElement>('#set-price')!;if(!price.reportValidity())throw Error('Choose a whole positive price');await submit('/economy/list-set',{setId,price:Number(price.value),description:d.querySelector<HTMLTextAreaElement>('#set-description')!.value,requestId:key});await loadMarket();message('collection-status','Complete Set listed. Every included copy is locked together.')})
}
function sell(uid:string){
 const owned=state.wallet.inventory.find(o=>o.uid===uid)!,item=itemById(owned.itemId)!
 const dialog=transaction(`Sell ${owned.kind?NAMES[owned.kind]+' · ':''}${item.name}`,`<div class="item-picture">${itemArt(item)}</div><label>Price in coins<input id="listing-price" type="number" inputmode="numeric" min="1" max="100000000" step="1" required value="${item.price}"></label><label class="listing-note-label" for="listing-description">Seller’s note <small>Optional · ${MARKET_DESCRIPTION_LIMIT} characters maximum</small><textarea id="listing-description" rows="3" maxlength="${MARKET_DESCRIPTION_LIMIT}" placeholder="Tell buyers what makes this copy worth a look."></textarea><span id="listing-note-count" class="listing-note-count">0 / ${MARKET_DESCRIPTION_LIMIT}</span></label><p>This exact copy will be locked while listed. If it is your last available copy, it will be unequipped. You can cancel an unsold listing at any time.</p>`,'List for sale',async d=>{
  const input=d.querySelector<HTMLInputElement>('input')!;if(!input.reportValidity())throw new Error('Enter a whole positive coin price')
  await submit('/economy/list',{uid,price:Number(input.value),description:d.querySelector<HTMLTextAreaElement>('#listing-description')!.value});await loadMarket();message('collection-status','Your copy is listed on the market.')
 });const note=dialog.querySelector<HTMLTextAreaElement>('#listing-description')!;note.oninput=()=>{dialog.querySelector('#listing-note-count')!.textContent=`${note.value.length} / ${MARKET_DESCRIPTION_LIMIT}`};dialog.querySelector('input')?.focus()
}
function cancel(id:string){transaction('Cancel this listing?','<p>Your copy will return to your available inventory.</p>','Cancel listing',async()=>{await submit('/economy/cancel',{id});await loadMarket();message('collection-status','Listing cancelled.')})}
function renderMarket(){
 const search=el<HTMLInputElement>('market-search').value.trim().toLowerCase(),typeFilter=el<HTMLSelectElement>('market-type').value,rarity=el<HTMLSelectElement>('market-rarity').value,mine=el<HTMLSelectElement>('market-owner').value==='mine',sort=el<HTMLSelectElement>('market-sort').value
 const filtered=listings.filter(l=>{const i=itemById(l.itemId)!;return (typeFilter==='all'||typeFilter==='set'&&!!l.setId||typeFilter!=='set'&&i.type===typeFilter&&!l.setId)&&(rarity==='all'||i.rarity===rarity)&&(!mine||l.seller===profile.name)&&(!search||[l.setId?setById(l.setId)?.name??i.name:i.name,l.seller,l.description??'',l.kind?NAMES[l.kind]:''].some(text=>text.toLowerCase().includes(search)))}).sort((a,b)=>sort==='low'?a.price-b.price:sort==='high'?b.price-a.price:b.created-a.created)
 el('market-summary').textContent=`${filtered.length} ${filtered.length===1?'listing':'listings'} · ${new Set(filtered.map(l=>l.seller)).size} sellers`
 el('market-grid').innerHTML=filtered.length?filtered.map(l=>{
  const item=itemById(l.itemId)!,own=l.seller===profile.name
  return `<article class="market-card" style="--rarity:${RARITY_COLORS[item.rarity]}">${l.setId?`<span class="item-picture">${setArt(setById(l.setId)!)}</span><small class="rarity-label">COMPLETE SET · ${(l.uids??[l.uid]).length} COPIES</small><strong>${setById(l.setId)!.name}</strong>`:itemCard(item,l.kind??'N')}${!l.setId&&['skin','shape'].includes(item.type)?`<small class="market-piece-label">${l.kind?NAMES[l.kind]+' only':'Legacy universal · all six types'}</small>`:''}<small class="seller">${own?'Your listing · ':'Sold by '}<a class="player-profile-link" href="${profileHref(l.seller)}">${escape(l.seller)}</a></small>${l.description?`<p class="market-seller-note">${escape(l.description)}</p>`:''}<strong class="coin-price">${icon('coin')}${l.price.toLocaleString()}</strong><button class="button" type="button" data-listing="${l.id}" ${!own&&l.price>state.wallet.coins?'disabled':''}>${own?'Cancel listing':'Buy copy'}</button></article>`
 }).join(''):'<p class="market-empty">No listings here yet.<br>List a copy from your inventory, or try another filter.</p>'
 el('market-grid').querySelectorAll<HTMLButtonElement>('[data-listing]').forEach(b=>b.onclick=()=>{
  const listing=listings.find(l=>l.id===b.dataset.listing)!;if(listing.seller===profile.name){cancel(listing.id);return}
  const item=itemById(listing.itemId)!
  transaction(`Buy ${listing.setId?setById(listing.setId)!.name:item.name}?`,`<div class="item-picture">${listing.setId?setArt(setById(listing.setId)!):itemArt(item,88,listing.kind??'N')}</div>${listing.setId?'<p>All required Set members transfer together.</p>':listing.kind?`<p>${NAMES[listing.kind]} only.</p>`:''}<p>Pay <strong>${listing.price.toLocaleString()} coins</strong> to <a class="player-profile-link" href="${profileHref(listing.seller)}">${escape(listing.seller)}</a> for this exact copy.</p>${listing.description?`<blockquote class="market-seller-note"><small>Seller’s note</small>${escape(listing.description)}</blockquote>`:''}`,'Buy copy',async()=>{await submit('/economy/market-buy',{id:listing.id});await loadMarket();message('collection-status',`${item.name} is now in your inventory.`)})
 })
}
async function loadMarket(){listings=(await api<{listings:Listing[]}>('/market')).listings;renderMarket()}
function render(){renderShop();renderInventory();renderMarket();renderSets();renderOwnedCases();renderEffects()}
function route(){
 const view=['shop','inventory','market'].includes(location.hash.slice(1))?location.hash.slice(1):'shop'
 document.querySelectorAll<HTMLElement>('.collection-view').forEach(v=>v.hidden=v.id!==view)
 document.querySelectorAll<HTMLAnchorElement>('.collection-tabs a').forEach(a=>{a.hidden=view==='inventory'&&a.hash==='#inventory';if(a.hash==='#'+view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')})
 el('shop-filters').hidden=view!=='shop'
 el('inventory-subtabs').hidden=view!=='inventory'
 el('collection-title').textContent=view==='shop'?'Shop':view==='inventory'?'Inventory':'Market'
 el('collection-intro').textContent=view==='shop'?'Find your next signature piece.':view==='inventory'?'Your collection. Your pieces. Your style.':'A new home for every extra copy.'
 document.title=`${el('collection-title').textContent} · 5D Chess`
 if(view==='shop'&&!shopVisited){shopVisited=true;showWelcome=!state.wallet.shopSeen;el('starter-note').hidden=!showWelcome;void api('/economy/visit-shop',{}).then(()=>{state.wallet.shopSeen=true}).catch(report)}else if(view!=='shop'){showWelcome=false;el('starter-note').hidden=true}
 if(view==='shop')applyShopFilter()
 if(view==='inventory')requestAnimationFrame(()=>renderInventory())
 if(view==='market')void loadMarket().catch(report)
}
async function init(){
 await initShell();const session=await getSession();if(!session.user){location.replace('/chess/login.html');return}
 profile=session.profile!;state=await api<Economy>('/economy');clockOffset=state.now-Date.now()
 preview=state.wallet.inventory.find(o=>o.itemId===state.wallet.loadout.pieces.K&&!o.listed&&!o.pending)?.uid??'default'
 bindShop()
 document.querySelectorAll<HTMLButtonElement>('[data-inventory-tab]').forEach(b=>b.onclick=()=>{inventoryTab=b.dataset.inventoryTab!;el('inventory-equipment').hidden=inventoryTab!=='equipment';el('set-collection').hidden=inventoryTab!=='sets';el('owned-cases').hidden=inventoryTab!=='cases';el('animation-collection').hidden=inventoryTab!=='effects';document.querySelectorAll('[data-inventory-tab]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));if(inventoryTab==='sets')renderSets();if(inventoryTab==='cases')renderOwnedCases();if(inventoryTab==='effects')renderEffects()})
 el('set-search').oninput=()=>{setSearch=el<HTMLInputElement>('set-search').value.trim().toLowerCase();setLimit=18;renderSets()}
 el('set-type').onchange=()=>{setType=el<HTMLSelectElement>('set-type').value;setLimit=18;renderSets()}
 el('set-progress').onchange=()=>{setProgress=el<HTMLSelectElement>('set-progress').value;setLimit=18;renderSets()}
 el('set-more').onclick=()=>{setLimit+=18;renderSets()}
 for(const id of ['inventory-rarity','market-rarity'])for(const rarity of RARITIES){const option=document.createElement('option');option.value=rarity;option.textContent=rarity[0].toUpperCase()+rarity.slice(1);el(id).append(option)}
 el('inventory-clear-filters').onclick=()=>{el<HTMLInputElement>('inventory-search').value='';el<HTMLSelectElement>('inventory-rarity').value='all';el<HTMLSelectElement>('inventory-status').value='all';renderInventory()}
 el('inventory-show-attention').onclick=()=>{const pending=state.wallet.inventory.find(o=>o.pending);if(pending)manageCopies(pending.itemId)}
 el('inventory-prev').onclick=()=>{inventoryPage--;renderInventory()}
 el('inventory-next').onclick=()=>{inventoryPage++;renderInventory()}
 new ResizeObserver(()=>{const width=el('inventory-grid').clientWidth,min=innerWidth<=600?94:128,gap=innerWidth<=600?7:8;const columns=width?Math.max(1,Math.floor((width+gap)/(min+gap))):0;if(columns&&columns!==inventoryColumns)renderInventory()}).observe(el('inventory-grid'))
 el('inventory-rarity').onchange=renderInventory
 el('inventory-status').onchange=renderInventory
 el('inventory-search').oninput=renderInventory
 document.querySelectorAll<HTMLButtonElement>('[data-feature-type]').forEach(b=>b.onclick=()=>{featureType=b.dataset.featureType!;renderShop()})
 for(const id of ['market-search','market-type','market-rarity','market-sort','market-owner'])el(id).oninput=renderMarket
 el('market-refresh').onclick=()=>void loadMarket().catch(report)
 window.addEventListener('hashchange',()=>{route();window.scrollTo({top:0})})
 render();route()
 const tick=()=>{el('rotation-timer').textContent=countdown(state.rotation,Date.now()+clockOffset);el('daily-deals-timer').textContent=countdown(state.reset,Date.now()+clockOffset);el('monthly-timer').textContent=countdown(state.monthlyReset,Date.now()+clockOffset)}
 tick();window.setInterval(tick,1000)
 window.setInterval(()=>{if(document.visibilityState!=='visible'||busy||document.querySelector('dialog[open]'))return;void Promise.all([api<Economy>('/economy'),api<{listings:Listing[]}>('/market')]).then(([data,market])=>{state=data;listings=market.listings;profile={...profile,coins:data.wallet.coins,loadout:data.wallet.loadout};renderAccount(profile);render()}).catch(report)},15000)
}
void init().catch(report)
