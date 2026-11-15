import {CRATES,RARITY_COLORS,itemById} from './collection.ts'
import {itemArt,type Economy} from './rewards.ts'
import {icon} from './icons.ts'

interface Offer {id:string;name:string;price:number;originalPrice?:number;tag:string;color:string;art:string}
interface Slot {element:HTMLElement;faces:HTMLAnchorElement[];quarter:number;animation?:Animation;timer?:ReturnType<typeof setTimeout>;hovered:boolean;index:number}
const shop='/chess/collection.html#shop'
const pauseGlyph='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>'
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))

/** Only advertise offers returned by the shop; weekly/seasonal picks aren't labelled as discounts. */
export function homeOffers(data:Economy):Offer[]{
 const itemOffer=(id:string,tag:string,price?:number,originalPrice?:number):Offer|undefined=>{
  const item=itemById(id);return item?{id:'item:'+id,name:item.name,price:price??item.price,originalPrice,tag,color:RARITY_COLORS[item.rarity],art:itemArt(item,64),}:undefined
 }
 const caseOffer=(offer:Economy['caseOffers'][number]):Offer|undefined=>{
  const item=CRATES.find(c=>c.id===offer.id);return item?{id:'case:'+item.id,name:item.name,price:offer.price,originalPrice:offer.price<item.price?item.price:undefined,tag:offer.window==='daily'?'DAILY · −15%':offer.window==='seasonal'?'SEASONAL CASE':'CASE',color:['#a7c38a','#bca1da','#e4bc73'][item.tier],art:`<span class="deal-case-art">${icon('inventory')}<i>✦</i></span>`}:undefined
 }
 const dailyCase=data.caseOffers.find(c=>c.window==='daily')
 const candidates=[...data.dailyDeals.map(d=>itemOffer(d.itemId,'DAILY · −25%',d.price,d.originalPrice)),...data.featured.map(id=>itemOffer(id,'WEEKLY FIND')),dailyCase?caseOffer(dailyCase):undefined,...data.seasonalItems.map(id=>itemOffer(id,'SEASONAL')),...data.caseOffers.map(caseOffer)]
 const seen=new Set<string>()
 return candidates.filter((offer):offer is Offer=>{if(!offer||seen.has(offer.id))return false;seen.add(offer.id);return true}).slice(0,12)
}

/** Three independent four-sided rotors; only the settled face is interactive. */
export class HomeDeals {
 private slots:Slot[]=[];private signature='';private loaded=false;private visible=false;private paused=false;private focused=false;private disposed=false
 private motion=matchMedia('(prefers-reduced-motion: reduce)');private size:ResizeObserver;private viewport:IntersectionObserver;private events=new AbortController()
 private pause:HTMLButtonElement;
 constructor(private root:HTMLElement){
  const cap=(text:string,heading=false)=>`<div class="deal-tower-cap deal-tower-cube">${[0,1,2,3].map(i=>`<div class="deal-tower-face deal-tower-cap-face" style="--face:${i}"${i?' aria-hidden="true"':''}>${heading&&i===0?`<h2>${text}</h2>`:`<span>${text}</span>`}<small>${heading?'THE COLLECTION':'FIND YOUR NEXT FAVOURITE'}</small></div>`).join('')}<i class="deal-tower-lid"></i><i class="deal-tower-floor"></i></div>`
  root.innerHTML=`<div class="deal-tower-aura" aria-hidden="true"></div><button class="deal-tower-pause" type="button" aria-label="Pause deals rotation" aria-pressed="false">${pauseGlyph}</button><div class="deal-tower-stage"><div class="deal-tower-structure"><header class="deal-tower-section deal-tower-header">${cap('DEAL',true)}</header>${[0,1,2].map(i=>`<div class="deal-tower-section deal-tower-slot" data-deal-slot="${i}"><div class="deal-tower-rotor deal-tower-cube"><div class="deal-tower-loading">${icon('inventory')}<span>Curating…</span></div></div><button class="deal-tower-turn" type="button" aria-label="Next product in slot ${i+1}" disabled>↻</button></div>`).join('')}<a class="deal-tower-section deal-tower-shop" href="${shop}" aria-label="Open the shop">${cap('SHOP')}<span class="deal-tower-shop-arrow" aria-hidden="true">↗</span></a></div></div><span class="sr-only" data-deals-status role="status"></span>`
  this.pause=root.querySelector('.deal-tower-pause')!
  this.slots=Array.from(root.querySelectorAll<HTMLElement>('.deal-tower-slot')).map((element,index)=>({element,faces:[],quarter:0,hovered:false,index}))
  const signal=this.events.signal
  this.pause.addEventListener('click',()=>{this.paused=!this.paused;this.pause.setAttribute('aria-pressed',String(this.paused));this.pause.setAttribute('aria-label',this.paused?'Resume deals rotation':'Pause deals rotation');this.pause.innerHTML=this.paused?icon('play'):pauseGlyph;this.sync()},{signal})
  this.slots.forEach(slot=>{
   slot.element.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch'){slot.hovered=true;this.clearTimer(slot)}},{signal})
   slot.element.addEventListener('pointerleave',()=>{slot.hovered=false;this.schedule(slot)},{signal})
   slot.element.querySelector('button')!.addEventListener('click',()=>this.turn(slot,true),{signal})
  })
  root.addEventListener('focusin',()=>{this.focused=true;this.sync()},{signal})
  root.addEventListener('focusout',()=>queueMicrotask(()=>{this.focused=root.contains(document.activeElement);this.sync()}),{signal})
  document.addEventListener('visibilitychange',()=>this.sync(),{signal})
  this.motion.addEventListener('change',()=>{if(this.motion.matches)this.slots.forEach(s=>s.animation?.finish());this.sync()},{signal})
  window.addEventListener('pagehide',e=>{if(!e.persisted)this.dispose()},{signal})
  this.size=new ResizeObserver(()=>this.fit());this.size.observe(root)
  this.viewport=new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;this.sync()},{threshold:.05});this.viewport.observe(root)
  this.fit();this.sync()
 }
 update(data:Economy){
  const offers=homeOffers(data),signature=offers.map(o=>[o.id,o.price,o.originalPrice,o.tag].join(':')).join('|');if(signature===this.signature)return
  this.signature=signature;this.loaded=offers.length===12
  if(!this.loaded){this.unavailable();return}
  this.slots.forEach(slot=>{
   this.clearTimer(slot);slot.animation?.cancel();slot.animation=undefined;slot.quarter=0
   const rotor=slot.element.querySelector<HTMLElement>('.deal-tower-rotor')!;rotor.style.transform='translateZ(calc(var(--tower-width) / -2)) rotateY(0deg)'
   rotor.innerHTML=[0,1,2,3].map(face=>{const offer=offers[slot.index+face*3];return `<a class="deal-tower-face home-deal" data-offer-id="${offer.id}" style="--face:${face};--offer-color:${offer.color}" href="${shop}" title="${escape(offer.name)} · ${offer.price.toLocaleString()} coins"${face?' inert aria-hidden="true" tabindex="-1"':''}><small class="deal-tower-tag">${offer.tag}</small><span class="deal-tower-art" aria-hidden="true">${offer.art}</span><strong>${escape(offer.name)}</strong><span class="deal-tower-price">${offer.originalPrice?`<s>${offer.originalPrice.toLocaleString()}</s>`:''}<b>${icon('coin')}${offer.price.toLocaleString()}</b></span></a>`}).join('')+'<i class="deal-tower-lid"></i><i class="deal-tower-floor"></i>'
   slot.faces=Array.from(rotor.querySelectorAll<HTMLAnchorElement>('.deal-tower-face'));slot.element.querySelector<HTMLButtonElement>('button')!.disabled=false;slot.element.dataset.face='0';this.schedule(slot,true)
  })
  this.root.dataset.ready='true';this.root.querySelector('[data-deals-status]')!.textContent='Twelve shop picks. Hover to hold a product, or use the arrows to turn each section.'
 }
 unavailable(){if(this.loaded)return;this.root.dataset.ready='false';this.root.querySelector('[data-deals-status]')!.textContent='Offers are unavailable. You can still open the shop.';this.root.querySelectorAll('.deal-tower-loading span').forEach(n=>n.textContent='Visit the shop')}
 private fit(){const width=Math.max(40,(this.root.clientWidth-18)*.77);this.root.style.setProperty('--tower-width',width+'px')}
 private canRun(){return !this.disposed&&this.loaded&&this.visible&&document.visibilityState==='visible'&&!this.paused&&!this.focused&&!this.motion.matches}
 private clearTimer(slot:Slot){if(slot.timer!==undefined){clearTimeout(slot.timer);slot.timer=undefined}}
 private schedule(slot:Slot,first=false){
  if(!this.canRun()||slot.hovered||slot.animation||slot.timer!==undefined)return
  const delay=first?1400+slot.index*2250+Math.random()*550:3000+Math.random()*4900+slot.index*370
  slot.timer=setTimeout(()=>{slot.timer=undefined;if(this.canRun()&&!slot.hovered)this.turn(slot)},delay)
 }
 private turn(slot:Slot,manual=false){
  if(!this.loaded||slot.animation||this.disposed||!manual&&!this.canRun())return
  this.clearTimer(slot);const from=slot.quarter,to=from+(manual||Math.random()>.18?1:-1),rotor=slot.element.querySelector<HTMLElement>('.deal-tower-rotor')!
  slot.faces.forEach(face=>{face.inert=true;face.setAttribute('aria-hidden','true');face.tabIndex=-1});slot.element.dataset.turning='true'
  const pose=(quarter:number)=>`translateZ(calc(var(--tower-width) / -2)) rotateY(${-90*quarter}deg)`
  const finish=()=>{rotor.style.transform=pose(to);slot.animation?.cancel();slot.animation=undefined;slot.quarter=to;const front=(to%4+4)%4;slot.faces[front].inert=false;slot.faces[front].removeAttribute('aria-hidden');slot.faces[front].tabIndex=0;slot.element.dataset.face=String(front);slot.element.dataset.turning='false';if(manual)this.root.querySelector('[data-deals-status]')!.textContent=slot.faces[front].querySelector('strong')!.textContent;this.schedule(slot)}
  if(this.motion.matches||typeof rotor.animate!=='function'){finish();return}
  slot.animation=rotor.animate([{transform:pose(from)},{transform:pose(to)}],{duration:1350+Math.random()*550,easing:'cubic-bezier(.32,.02,.18,1)',fill:'forwards'});slot.animation.onfinish=finish
 }
 private sync(){
  const stopped=this.disposed||!this.visible||document.visibilityState!=='visible'||this.paused
  this.root.dataset.motion=this.motion.matches?'reduced':this.paused?'paused':'running';this.pause.hidden=this.motion.matches
  this.slots.forEach(slot=>{if(!this.canRun())this.clearTimer(slot);if(stopped)slot.animation?.pause();else if(slot.animation?.playState==='paused')slot.animation.play();this.schedule(slot)})
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.slots.forEach(slot=>{this.clearTimer(slot);slot.animation?.cancel()});this.events.abort();this.size.disconnect();this.viewport.disconnect()}
}
