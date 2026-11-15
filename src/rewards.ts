import {caseReel} from './case-reel.ts'
import {type Kind,type Player} from './model.ts'
import {api,renderAccount} from './shell.ts'
import {type Profile} from './account-model.ts'
import {type Wallet,type Drop,type Collectible,type Crate,ITEMS,CRATES,crateTickets,SPIN_REWARDS,LEGACY_SPIN_REWARDS,RARITY_COLORS,ITEM_LABELS,duplicateRefund,CRATE_ODDS,RARITIES,PAID_SPIN_PRICE,percent,itemById,setById,wheelArcs,spinRewards,type SpinReward,type CosmeticSet} from './collection.ts'
import {avatarArt,frameArt} from './cosmetic-art.ts'
import {NAMES,pieceIcon,skinSetIcon} from './art.ts'
import {effectSVG} from './effects.ts'
import {icon} from './icons.ts'
export interface Economy {spinRewards:SpinReward[];spinDay:string;caseOffers:{id:string;price:number;window:string;key:string}[];seasonalItems:string[];month:string;monthlyReset:number;paidSpinPrice:number;wallet:Wallet;spinReady:boolean;reset:number;rotation:number;featured:string[];dailyDeals:{itemId:string;price:number;originalPrice:number}[];now:number;recent:Drop[]}
export interface RewardReply extends Economy {profile:Profile;drop?:Drop}
export const requestId=()=>crypto.randomUUID()
export function itemArt(item:Collectible,size=88,kind:Kind='N',player:Player='red'){return item.type==='movement'||item.type==='capture'?effectSVG(item.id):item.type==='icon'?avatarArt(item.id):item.type==='frame'?frameArt(item.id):item.type==='shape'?pieceIcon(kind,player,size,'default',item.id):pieceIcon(kind,player,size,item.id)}
export function setArt(set:CosmeticSet,player:Player='red'){return skinSetIcon(set.skinId??'default',player,set.outlineId)}
export function itemCard(item:Collectible,kind:Kind='N',player:Player='red'){return `<span class="item-picture">${itemArt(item,88,kind,player)}</span><small class="rarity-label">${item.rarity}</small><strong>${item.name}</strong>`}
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches
export function countdown(to:number,now=Date.now()){let seconds=Math.max(0,Math.ceil((to-now)/1000));const days=Math.floor(seconds/86400);seconds%=86400;return `${days?days+'d ':''}${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`}
let wheelSerial=0
export function wheelSVG(rewards:SpinReward[]=SPIN_REWARDS){
 const id=`fortune-${++wheelSerial}`
 const colors=['#176861','#254d83','#227a69','#684794','#c59235','#276eaa','#a87724','#a84487']
 const arcs=wheelArcs(rewards),sectors=rewards.map((r,i)=>{const a=arcs[i].start*Math.PI/180-Math.PI/2,b=arcs[i].end*Math.PI/180-Math.PI/2,mid=(a+b)/2
 const p=(rad:number,angle:number)=>`${140+rad*Math.cos(angle)} ${140+rad*Math.sin(angle)}`
 const item=r.itemId?itemById(r.itemId):r.setId?itemById(setById(r.setId)!.itemId):undefined
 const label=r.coins?String(r.coins):r.caseId?'CASE':r.setId?'SET':item?item.name.split(' ')[0]:r.rarity?.toUpperCase()??'GIFT'
 const pictureHTML=r.coins?icon('coin'):r.caseId?icon('inventory'):item?itemArt(item,24):icon('knight')
 const picture=pictureHTML.match(/<svg[\s\S]*?<\/svg>/g)?.at(-1)??icon('inventory')
 const x=140+79*Math.cos(mid),y=140+79*Math.sin(mid),tx=140+106*Math.cos(mid),ty=140+106*Math.sin(mid)
 return `<g class="wheel-segment" data-segment="${i}"><title>${r.label}</title><path d="M140 140 ${p(121,a)}A121 121 0 0 1 ${p(121,b)}Z" fill="${r.rarity==='mythic'?'#87385e':r.rarity==='legendary'?'#8e6725':r.caseId?'#315b68':colors[i%colors.length]}" stroke="#e9d496" stroke-width=".8"/><g transform="translate(${x-8} ${y-8})" class="wheel-prize-icon">${picture.replace('<svg ', '<svg x="0" y="0" width="16" height="16" ')}</g><text x="${tx}" y="${ty}" fill="#fff4d5" font-size="${r.coins?9:5.4}" font-family="Arial,sans-serif" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${mid*180/Math.PI+(Math.cos(mid)<0?180:0)} ${tx} ${ty})">${label.slice(0,11)}</text></g>`}).join('')
 const bulbs=Array.from({length:32},(_,i)=>{const a=i*Math.PI/16;return `<circle class="wheel-bulb bulb-${i%2}" cx="${140+130*Math.cos(a)}" cy="${140+130*Math.sin(a)}" r="${i%4===0?2.3:1.4}" fill="#ffe6a3"/>`}).join('')
 return `<svg class="reward-wheel" viewBox="0 0 280 280" aria-hidden="true"><defs><linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff4bb"/><stop offset=".22" stop-color="#b47d25"/><stop offset=".48" stop-color="#ffe9a4"/><stop offset=".7" stop-color="#8c591c"/><stop offset="1" stop-color="#f8d87e"/></linearGradient><radialGradient id="${id}-glass" cx=".3" cy=".15" r=".85"><stop stop-color="#ffffff" stop-opacity=".3"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#030611" stop-opacity=".45"/></radialGradient></defs><circle cx="140" cy="143" r="137" fill="#101710"/><circle cx="140" cy="140" r="137" fill="url(#${id}-gold)" stroke="#f8dfa0" stroke-width="2"/><circle cx="140" cy="140" r="126" fill="#171d18" stroke="#e0c587" stroke-width="3"/><g class="wheel-disc">${sectors}<circle cx="140" cy="140" r="121" fill="url(#${id}-glass)"/></g><circle cx="140" cy="140" r="36" fill="url(#${id}-gold)" stroke="#b89a53" stroke-width="3"/><circle cx="140" cy="140" r="30" fill="#142a36" stroke="#f6dba3" stroke-opacity=".35"/><path d="M139 120h2v6h6v2h-6v4l10-4-4 15 3 7h-20l3-7-4-15 10 4v-4h-6v-2h6Z" fill="#ecd49b"/><path d="M134 146h12" stroke="#60532f" stroke-width="1"/>${bulbs}</svg>`
}
export function crateArt(crate:Crate){
 const mark=crate.monthly==='solar'?'<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="15"/><path d="M32 4v10m0 36v10M4 32h10m36 0h10M12 12l7 7m26 26 7 7M12 52l7-7m26-26 7-7"/></svg>':crate.monthly==='lunar'?'<svg viewBox="0 0 64 64"><path d="M45 9C5 0 2 59 45 55 24 47 24 18 45 9Z"/></svg>':crate.monthly?'<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="20"/><path d="M32 12a20 20 0 0 1 0 40Z"/></svg>':crate.type==='frame'?'<svg viewBox="0 0 64 64"><path d="M8 24V8h16m16 0h16v16m0 16v16H40m-16 0H8V40"/><circle cx="32" cy="32" r="13"/></svg>':icon(crate.type==='movement'?'trail':crate.type==='capture'?'capture':crate.type==='icon'?'person':crate.type==='shape'?'rook':crate.type==='mixed'?'inventory':'knight')
 return `<div class="crate-sculpture" data-kind="${crate.type}" data-theme="${crate.monthly??'general'}" data-format="${crate.setChance===1000000?'sets':crate.setChance?'hybrid':'single'}">${chestHTML(crate.tier).replace('THE COLLECTION',crate.setChance===1000000?'COMPLETE SETS':crate.setChance?'SINGLES + SETS':'SINGLE COSMETICS').replace(/<span class="chest-crest">.*?<\/span>/,`<span class="chest-crest">${mark}</span>`)}</div>`
}

export const chestHTML=(tier=0)=>`<div class="chest-perspective"><div class="chess-chest tier-${tier}"><div class="chest-face chest-back"></div><div class="chest-face chest-left"></div><div class="chest-face chest-front"><span class="chest-inlay inlay-top"></span><span class="chest-inlay inlay-bottom"></span><div class="chest-panel"><span class="chest-crest">${icon('knight')}</span><b>5D CHESS</b><span class="chest-inscription">THE COLLECTION</span><span class="chest-authenticity">✦ ARCHIVE EDITION ✦</span><span class="chest-serial">${['BRONZE · I','SILVER · II','GOLD · III'][tier]}</span></div><span class="chest-strap strap-left"></span><span class="chest-strap strap-right"></span>${[0,1,2,3].map(i=>`<span class="chest-rivet rivet-${i}"></span>`).join('')}<span class="crate-latch latch-left"></span><span class="crate-latch latch-right"></span></div><div class="chest-face chest-right"><span class="chest-handle"></span><span class="chest-side-seal">◆</span><span class="chest-vents"></span></div><div class="chest-lid"><span class="chest-top-rail rail-left"></span><span class="chest-top-rail rail-right"></span><span class="chest-lid-engraving"></span><span class="chest-top-crest">♔</span><span class="chest-lid-studs"><i></i><i></i><i></i><i></i></span><span class="chest-lid-lip"></span></div><div class="chest-corner corner-a"></div><div class="chest-corner corner-b"></div><span class="chest-keyhole"><i></i></span><div class="chest-feet"></div></div><div class="chest-ground"></div><div class="chest-impact"></div></div>`
export function oddsHTML(tier:number){return RARITIES.map((r,i)=>`<span style="--rarity:${RARITY_COLORS[r]}"><i></i>${r} <b>${percent(CRATE_ODDS[tier][i])}</b></span>`).join('')}
let dialog:HTMLDialogElement|undefined,running=false
export async function revealDrop(drop:Drop,mode:'spin'|'crate',tier=0,onChange?:(data:RewardReply)=>void,crateId?:string,boxFinish=0,openAnother?: (offer:Economy['caseOffers'][number],month:string)=>Promise<RewardReply>){
 if(running)return
 running=true
 dialog??=Object.assign(document.createElement('dialog'),{className:'reward-dialog'})
 if(!dialog.isConnected)document.body.append(dialog)
 const wheel=drop.wheel??LEGACY_SPIN_REWARDS
 const activeCrate=CRATES.find(c=>c.id===crateId)
 const rewardCase=drop.caseId?CRATES.find(c=>c.id===drop.caseId):undefined,rewardSet=drop.setId?setById(drop.setId):undefined,reward=itemById(drop.itemId??''),color=reward?RARITY_COLORS[reward.rarity]:'#e8c56c'
 dialog.className=`reward-dialog reward-v2 ${mode==='crate'?'reward-v3':''} mode-${mode}`;dialog.dataset.crateCard=crateId??'';dialog.dataset.style=String(boxFinish);dialog.dataset.phase='arrival';dialog.style.setProperty('--reward-color',mode==='crate'?'#d0b77f':color);dialog.dataset.rarity=''
 dialog.innerHTML=`<div class="reward-heading"><div><p class="eyebrow">${mode==='spin'?(drop.paid?'ENCORE SPIN':'THE DAILY SPIN'):activeCrate?.name.toUpperCase()??`${['BRONZE','SILVER','GOLD'][tier]} COLLECTION`}</p><h2>${mode==='spin'?'A turn of fortune.':'Something worth keeping.'}</h2></div><button type="button" class="text-button reward-skip">Skip animation</button></div><div class="reward-show"><div class="stage-floor" aria-hidden="true"><i></i><i></i><i></i></div><div class="reward-sparks" aria-hidden="true">${Array.from({length:32},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</div>${mode==='spin'?`<div class="wheel-machine"><div class="wheel-crown">◆</div><div class="wheel-stage"><div class="wheel-pointer"></div>${wheelSVG(wheel)}</div><div class="wheel-pedestal"><span>F O R T U N E</span></div></div>`:`<div class="crate-stage">${activeCrate?crateArt(activeCrate):chestHTML(tier)}<div class="chest-beams" aria-hidden="true"><i></i><i></i><i></i></div></div><div class="reel-window" aria-label="Opening reel"><div class="reel-marker"></div><div class="reel-strip"></div><div class="reel-edge edge-left"></div><div class="reel-edge edge-right"></div></div>`}<p class="reveal-phase" role="status">${mode==='spin'?'Winding up':'A delivery from the multiverse'}</p></div><section class="reward-result" hidden aria-live="polite"></section>${mode==='spin'?`<details class="wheel-odds"><summary>Reward odds</summary><p>Wheel segments are visual. Rewards use these exact odds.</p><div>${wheel.map(r=>`<span>${r.label}${r.coins?' coins':''}<small>${r.cadence}</small><b>${percent(r.weight)}</b></span>`).join('')}</div></details>`:''}<p class="reward-saving">Reward secured · Closing this window keeps your reward.</p>`
 dialog.showModal()
 let skip=false,ticker=0;const animations:Animation[]=[]
 const finish=()=>{skip=true;animations.forEach(a=>{try{a.finish()}catch{}})}
 const button=dialog.querySelector<HTMLButtonElement>('.reward-skip')!,phase=dialog.querySelector<HTMLElement>('.reveal-phase')!
 button.onclick=finish;dialog.oncancel=finish;dialog.addEventListener('close',finish,{once:true})
 const animate=async(el:Element,frames:Keyframe[],ms:number,easing='ease',onFrame?:(progress:number)=>void)=>{
  const animation=el.animate(frames,{duration:skip||reduced()?0:ms,easing,fill:'forwards'});animations.push(animation)
  if(onFrame&&!skip&&!reduced()){const tick=()=>{const p=animation.effect?.getComputedTiming().progress;if(typeof p==='number')onFrame(p);if(animation.playState==='running')ticker=requestAnimationFrame(tick)};ticker=requestAnimationFrame(tick)}
  await animation.finished.catch(()=>{});cancelAnimationFrame(ticker)
 }
 try{
  if(mode==='spin'){
   const wheel=dialog.querySelector('.wheel-disc')!,pointer=dialog.querySelector('.wheel-pointer')!,angle=360*8-(wheelArcs(drop.wheel??LEGACY_SPIN_REWARDS)[drop.segment??0].mid)
   await animate(wheel,[{transform:'rotate(0deg)'},{transform:'rotate(-14deg)'}],380,'ease-in-out')
   dialog.dataset.phase='spin';phase.textContent='Every turn, a possibility'
   let last=-1
   await animate(wheel,[{transform:'rotate(-14deg)',offset:0,easing:'cubic-bezier(.45,0,.7,.4)'},{transform:'rotate(630deg)',offset:.22,easing:'cubic-bezier(.12,.7,.05,1)'},{transform:`rotate(${angle}deg)`,offset:1}],6400,'linear',p=>{
    // The pointer and rim respond to the real animated disc, including its slowdown.
    const transform=getComputedStyle(wheel).transform,values=transform.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(Number)
    const degrees=values?Math.atan2(values[1],values[0])*180/Math.PI:0,needle=((360-degrees)%360+360)%360,sector=wheelArcs(drop.wheel??LEGACY_SPIN_REWARDS).findIndex(a=>needle>=a.start&&needle<a.end)
    if(last!==sector){last=sector;const a=pointer.animate([{rotate:'-13deg'},{rotate:'3deg',offset:.65},{rotate:'0deg'}],{duration:100,fill:'none'});animations.push(a);dialog!.classList.toggle('tick-odd',sector%2===0)}
    if(p>.65){phase.textContent='Finding its place';dialog!.dataset.phase='settling'}
   })
   await animate(wheel,[{transform:`rotate(${angle}deg)`},{transform:`rotate(${angle+.9}deg)`,offset:.45},{transform:`rotate(${angle}deg)`}],260,'ease-out')
   dialog.querySelector(`[data-segment="${drop.segment??0}"]`)?.classList.add('landed-segment')
  }else{
   const chest=dialog.querySelector('.chess-chest')!,stage=dialog.querySelector('.crate-stage')!
   await animate(chest,[{transform:'translateY(-310px) rotateY(-34deg) rotateX(-14deg) rotateZ(-8deg)'},{transform:'translateY(7px) rotateY(-25deg) rotateX(-12deg) rotateZ(1deg)',offset:.76},{transform:'translateY(-9px) rotateY(-25deg) rotateX(-12deg)',offset:.9},{transform:'translateY(0) rotateY(-25deg) rotateX(-12deg)'}],900,'cubic-bezier(.32,.01,.65,1)')
   stage.classList.add('landed');dialog.dataset.phase='unlock';phase.textContent='Breaking the seal'
   await Promise.all([...dialog.querySelectorAll('.crate-latch')].map((l,i)=>animate(l,[{transform:'translateZ(8px) rotateX(0deg)'},{transform:`translateZ(8px) rotateX(${i?-115:115}deg)`}],430,'cubic-bezier(.3,.2,.2,1)')))
   stage.classList.add('charging')
   await animate(chest,[{translate:'0'},{translate:'-2px',offset:.15},{translate:'3px',offset:.3},{translate:'-3px',offset:.5},{translate:'2px',offset:.7},{translate:'0'}],470,'ease-in-out')
   dialog.dataset.phase='opening';phase.textContent='Opening your collection'
   await animate(dialog.querySelector('.chest-lid')!,[{transform:'translateZ(-58px) rotateX(90deg)'},{transform:'translateZ(-58px) rotateX(213deg)',offset:.85},{transform:'translateZ(-58px) rotateX(205deg)'}],700,'cubic-bezier(.2,.75,.15,1)')
   stage.classList.add('opened');dialog.dataset.phase='spin';phase.textContent='One of a kind. Yours to keep.'
   const strip=dialog.querySelector<HTMLElement>('.reel-strip')!,windowEl=dialog.querySelector<HTMLElement>('.reel-window')!
   const {cards,target}=caseReel(activeCrate??CRATES.find(c=>c.tier===tier)!,drop)
   strip.innerHTML=cards.map((entry,index)=>{const set=entry.setId?setById(entry.setId):undefined;return `<div class="reel-card" data-item="${entry.item.id}" data-index="${index}" style="--rarity:${RARITY_COLORS[entry.item.rarity]}"><span class="reel-card-grid"></span><span class="item-picture">${set?setArt(set):itemArt(entry.item,104,entry.kind??'N')}</span><small class="rarity-label">${entry.item.rarity}</small><strong>${set?.name??entry.item.name}</strong><small class="reel-set-label">${set?'COMPLETE SET':entry.kind?NAMES[entry.kind]+' · '+ITEM_LABELS[entry.item.type]:ITEM_LABELS[entry.item.type]}</small></div>`}).join('')
   windowEl.classList.add('visible')
   const card=strip.children[target] as HTMLElement,first=strip.children[0] as HTMLElement,step=(strip.children[1] as HTMLElement).offsetLeft-first.offsetLeft,start=-first.offsetWidth/2,offset=-(card.offsetLeft+card.offsetWidth/2)
   let last=-1
   await animate(strip,[{transform:`translateX(${start}px)`,easing:'cubic-bezier(.55,0,.8,.6)'},{transform:`translateX(${-8*step}px)`,offset:.16,easing:'cubic-bezier(.08,.72,.08,1)'},{transform:`translateX(${offset-5}px)`,offset:.94,easing:'ease-out'},{transform:`translateX(${offset}px)`,offset:1}],6400,'linear',p=>{
    const matrix=new DOMMatrixReadOnly(getComputedStyle(strip).transform),index=Math.max(0,Math.min(cards.length-1,Math.round((-matrix.m41-first.offsetWidth/2)/step)))
    if(index!==last){strip.children[last]?.classList.remove('under-marker');strip.children[index]?.classList.add('under-marker');last=index;dialog!.querySelector('.reel-marker')?.animate([{scale:'1 1'},{scale:'1.6 1'},{scale:'1 1'}],{duration:100})}
    if(p>.7){dialog!.dataset.phase='settling';phase.textContent='Finding its place'}
   })
   strip.style.transform=`translateX(${offset}px)`;card.classList.add('winning-card');dialog.dataset.phase='landed';dialog.dataset.rarity=reward!.rarity;dialog.style.setProperty('--reward-color',color);phase.textContent=reward!.name
   await animate(windowEl,[{filter:'brightness(1)'},{filter:'brightness(1.45)',offset:.3},{filter:'brightness(1)'}],450)
   await animate(card,[{scale:'1'},{scale:'1.06',offset:.4},{scale:'1'}],RARITIES.indexOf(reward!.rarity)>=3?850:350)

  }
  dialog.dataset.phase='reward';dialog.classList.add('revealed');dialog.querySelector('h2')!.textContent=drop.duplicate?'Another for your collection.':'Meet your new favorite.'
  const result=dialog.querySelector<HTMLElement>('.reward-result')!
  result.innerHTML=`<div class="prize-halo" aria-hidden="true"><i></i><i></i><i></i>${Array.from({length:16},(_,i)=>`<b style="--ray:${i}"></b>`).join('')}</div><div class="reward-won-art">${rewardCase?crateArt(rewardCase):rewardSet?setArt(rewardSet):reward?(!drop.kind&&['skin','shape'].includes(reward.type)?skinSetIcon(reward.type==='skin'?reward.id:'default','red',reward.type==='shape'?reward.id:undefined):itemArt(reward,136,drop.kind??'N')):icon('coin')}</div><p class="rarity-label">${reward?reward.rarity:'COINS'}</p><h3>${rewardCase?rewardCase.name:rewardSet?rewardSet.name:reward?(drop.kind?NAMES[drop.kind]+' · ':'')+reward.name:`${drop.coins?.toLocaleString()} coins`}</h3><p>${drop.duplicate?'Already in your collection. Keep a tradable copy or take a small coin refund.':rewardCase?'An unopened case is waiting in Inventory → Cases. Earned cases remain openable after the shop rotates.':reward?reward.description:'A little fortune for your next find.'}</p>${rewardSet?`<small class="reward-set-note">${drop.items?.length??6} cosmetics · Complete Set · All four faction colors</small>`:drop.kind?`<small class="reward-set-note">${NAMES[drop.kind]} only · All four faction colors · Collect all six to complete a Set</small>`:''}<div class="reward-actions">${drop.duplicate?`<button type="button" class="button primary" data-keep>Keep copy</button><button type="button" class="button" data-refund>${icon('coin')}Refund ${drop.refund}</button>`:`<button type="button" class="button primary" data-done>Continue</button>`}</div><p class="form-error" role="alert" hidden></p>`
  if(mode==='crate'&&reward){
   const rank=RARITIES.indexOf(reward.rarity);dialog.dataset.rarity=reward.rarity;dialog.style.setProperty('--reward-color',color)
   dialog.querySelector('h2')!.textContent=rank>=4?'An extraordinary discovery.':rank===3?'A remarkable find.':'Your collection grows.'
   result.innerHTML=`<div class="case-prize-stage"><div class="case-prize-orbit"></div><div class="case-prize-orbit orbit-two"></div><div class="case-confetti" aria-hidden="true">${Array.from({length:rank>=3?44:16},(_,i)=>`<i style="--n:${i};--angle:${i*137.5}deg;--reach:${90+i%7*24}px;--delay:${i%9*35}ms"></i>`).join('')}</div><span class="case-rarity-seal">${rank>=4?'✦':rank===3?'◆':'◇'} ${reward.rarity}</span><div class="reward-won-art">${rewardSet?setArt(rewardSet):itemArt(reward,190,drop.kind??'N')}</div><span class="case-prize-caption">${rewardSet?'COMPLETE SET':drop.kind?NAMES[drop.kind]+' · '+ITEM_LABELS[reward.type]:ITEM_LABELS[reward.type]}</span></div><div class="case-prize-copy"><p class="eyebrow">${drop.duplicate?'ANOTHER FOR YOUR COLLECTION':'ADDED TO YOUR COLLECTION'}</p><h3>${rewardSet?.name??reward.name}</h3><p>${reward.description}</p>${rewardSet?`<p class="reward-set-note">${drop.items?.length??6} cosmetics · All four factions</p>`:drop.kind?`<p class="reward-set-note">${NAMES[drop.kind]} only · All four faction colors</p>`:''}<div class="case-reward-facts"><span>${drop.duplicate?'Tradable duplicate':'New discovery'}</span><span>Reward secured</span></div><div class="reward-actions"><button type="button" class="button primary" data-equip>Equip now</button><button type="button" class="button" data-store>Store</button><button type="button" class="button" data-recycle ${!drop.duplicate?'disabled':''} title="${drop.duplicate?'Recycle this duplicate copy':'Only duplicate copies can be recycled'}">Recycle${drop.duplicate?' · '+(drop.refund??duplicateRefund(reward))+' coins':''}</button><button type="button" class="button case-open-another" data-another disabled>Checking next case…</button></div><p class="case-action-note">${drop.duplicate?'Store keeps a tradable copy. Recycling exchanges this copy for coins.':'Your first copy is kept. Only duplicates can be recycled.'}</p><p class="form-error" role="alert" hidden></p></div>`
   let actionBusy=false
   const error=(cause:unknown)=>{const el=result.querySelector<HTMLElement>('.form-error')!;el.textContent=cause instanceof Error?cause.message:'Could not finish this action';el.hidden=false}
   const accept=(data:RewardReply)=>{renderAccount(data.profile);onChange?.(data)}
   const perform=async(action:()=>Promise<void>)=>{if(actionBusy)return;actionBusy=true;const buttons=result.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');buttons.forEach(b=>b.disabled=true);button.disabled=true;try{await action()}catch(cause){error(cause);buttons.forEach(b=>b.disabled=false)}finally{actionBusy=false;button.disabled=false}}
   const keep=async()=>{const latest=await api<Economy>('/economy');const owned=latest.wallet.inventory.find(o=>o.uid===drop.uid);if(owned?.pending)accept(await api<RewardReply>('/economy/duplicate',{uid:drop.uid,refund:false}));return latest}
   result.querySelector<HTMLButtonElement>('[data-store]')!.onclick=()=>void perform(async()=>{await keep();dialog!.close()})
   result.querySelector<HTMLButtonElement>('[data-equip]')!.onclick=()=>void perform(async()=>{
    await keep()
    const data=rewardSet?await api<RewardReply>('/economy/equip-collection',{setId:rewardSet.id}):await api<RewardReply>('/economy/equip',{slot:reward.type==='skin'?(drop.kind??'K'):reward.type==='shape'?(drop.kind?'shape-'+drop.kind:'shape'):reward.type,uid:drop.uid})
    accept(data);dialog!.close()
   })
   result.querySelector<HTMLButtonElement>('[data-recycle]')!.onclick=()=>void perform(async()=>{
    const latest=await api<Economy>('/economy');if(latest.wallet.inventory.some(o=>o.uid===drop.uid))accept(await api<RewardReply>('/economy/duplicate',{uid:drop.uid,refund:true}));dialog!.close()
   })
   const another=result.querySelector<HTMLButtonElement>('[data-another]')!
   void api<Economy>('/economy').then(latest=>{
    const offer=latest.caseOffers.find(o=>o.id===crateId)
    another.textContent=offer?'Open another · '+offer.price.toLocaleString()+' coins':'Case out of rotation'
    another.disabled=!openAnother||!offer||latest.wallet.coins<offer.price
    another.title=offer&&latest.wallet.coins<offer.price?'Not enough coins':''
    if(offer&&openAnother)another.onclick=()=>void perform(async()=>{await keep();const next=await openAnother(offer,latest.month);accept(next);dialog!.close();void revealDrop(next.drop!,'crate',tier,onChange,crateId,boxFinish,openAnother)})
   }).catch(()=>{another.textContent='Open another unavailable'})
  }
  result.hidden=false;button.textContent='Close';button.onclick=()=>dialog!.close()
  result.querySelector<HTMLButtonElement>('[data-done]')?.addEventListener('click',()=>dialog!.close())
  for(const refund of [false,true])result.querySelector<HTMLButtonElement>(refund?'[data-refund]':'[data-keep]')?.addEventListener('click',async()=>{
   const buttons=result.querySelectorAll<HTMLButtonElement>('button');buttons.forEach(b=>b.disabled=true)
   try{const data=await api<RewardReply>('/economy/duplicate',{uid:drop.uid,refund});renderAccount(data.profile);onChange?.(data);dialog!.close()}catch(cause){const error=result.querySelector<HTMLElement>('.form-error')!;error.textContent=cause instanceof Error?cause.message:'Could not save choice';error.hidden=false;buttons.forEach(b=>b.disabled=false)}
  })
  if(dialog.open)result.querySelector<HTMLButtonElement>('button')?.focus()
 }finally{running=false;cancelAnimationFrame(ticker);animations.forEach(a=>a.cancel())}
}
export async function initDailySpin(){
 const host=document.getElementById('daily-spin');if(!host)return
 let state:Economy|undefined
 host.innerHTML=`<button type="button" class="spin-thumb" aria-label="Preview daily wheel">${wheelSVG(state?.spinRewards??SPIN_REWARDS)}<span class="spin-thumb-caption">FORTUNE<br>FAVORS YOU.</span><i>✦</i><span class="spin-orbit"></span></button><div class="daily-spin-copy"><strong>DAILY SPIN</strong><small>Free every day · Netherlands time</small></div><div class="daily-spin-actions"><button type="button" class="spin-now">SPIN NOW</button><button type="button" class="spin-again" hidden>${icon('coin')}<span>Spin again · ${PAID_SPIN_PRICE} coins</span></button></div><p class="spin-error form-error" role="alert" hidden></p>`
 const button=host.querySelector<HTMLButtonElement>('.spin-now')!,again=host.querySelector<HTMLButtonElement>('.spin-again')!,error=host.querySelector<HTMLElement>('.spin-error')!
 let busy=false,freeRequest=requestId(),paidRequest=requestId(),clockOffset=0
 const render=()=>{if(!state)return;const ready=state.spinReady||Date.now()+clockOffset>=state.reset;button.classList.toggle('used',!ready);host.classList.toggle('spin-cooldown',!ready);button.textContent=busy?'Spinning…':ready?'SPIN NOW':`Next free spin · ${countdown(state.reset,Date.now()+clockOffset)}`;button.disabled=busy||!ready;again.hidden=ready;again.disabled=busy||state.wallet.coins<state.paidSpinPrice;again.title=again.disabled?`You need ${state.paidSpinPrice} coins for another spin`:'';again.querySelector('span')!.textContent=`Spin again · ${state.paidSpinPrice} coins`}
 const refresh=async()=>{state=await api<Economy>('/economy');clockOffset=state.now-Date.now();const thumb=host.querySelector('.spin-thumb svg');if(thumb)thumb.outerHTML=wheelSVG(state.spinRewards);render()}
 await refresh().catch(()=>{error.textContent='Daily spin is unavailable. Try again shortly.';error.hidden=false;button.disabled=true})
 const play=async(paid:boolean)=>{
  if(busy)return;busy=true;render();error.hidden=true
  try{const data=await api<RewardReply>(paid?'/economy/spin-again':'/economy/spin',{requestId:paid?paidRequest:freeRequest,expectedDay:state?.spinDay});state=data;clockOffset=data.now-Date.now();if(paid)paidRequest=requestId();else freeRequest=requestId();renderAccount(data.profile);await revealDrop(data.drop!,'spin',0,next=>{state=next})}catch(cause){error.textContent=cause instanceof Error?cause.message:'Spin failed. Try again.';error.hidden=false;await refresh().catch(()=>{});if(!paid&&state&&!state.spinReady)freeRequest=requestId()}finally{busy=false;render()}
 }
 host.querySelector<HTMLButtonElement>('.spin-thumb')!.onclick=()=>{
  const preview=document.createElement('dialog');preview.className='transaction-dialog wheel-preview-dialog'
  preview.innerHTML=`<p class="eyebrow">A LITTLE LUCK, EVERY DAY</p><h2>Your turn of fortune.</h2><div class="wheel-preview-art">${wheelSVG(state?.spinRewards??SPIN_REWARDS)}</div><p>25 rewards: 10 fixed, five daily, five weekly and five seasonal. Coins, individual cosmetics, complete Sets and unopened cases. Free every day at Netherlands midnight.</p><div class="actions"><button class="button" type="button" data-close>Maybe later</button><button class="button primary" type="button" data-play>${state?.spinReady?'Take free spin':'See next spin'}</button></div>`
  document.body.append(preview);preview.showModal();preview.onclose=()=>preview.remove();preview.querySelector<HTMLButtonElement>('[data-close]')!.onclick=()=>preview.close();preview.querySelector<HTMLButtonElement>('[data-play]')!.onclick=()=>{preview.close();if(state&&(state.spinReady||Date.now()+clockOffset>=state.reset))void play(false);else button.focus()}
 }
 button.onclick=()=>host.querySelector<HTMLButtonElement>('.spin-thumb')!.click()
 again.onclick=()=>{
  if(!state||busy)return
  const confirmation=document.createElement('dialog');confirmation.className='transaction-dialog spin-confirm'
  confirmation.innerHTML=`<span class="confirm-wheel">${wheelSVG(state?.spinRewards??SPIN_REWARDS)}</span><h2>Another turn of fortune?</h2><p>Spend <strong>${state.paidSpinPrice} coins</strong> for another spin with the same reward odds. Your next free spin still resets at Netherlands midnight.</p><p class="confirm-balance">Balance · ${state.wallet.coins.toLocaleString()} coins</p><div class="actions"><button type="button" class="button" data-cancel>Cancel</button><button type="button" class="button primary" data-spin-confirm>${icon('coin')}Spin · ${state.paidSpinPrice}</button></div>`
  document.body.append(confirmation);confirmation.showModal();confirmation.onclose=()=>confirmation.remove();confirmation.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick=()=>confirmation.close();confirmation.querySelector<HTMLButtonElement>('[data-spin-confirm]')!.onclick=()=>{confirmation.close();void play(true)}
 }
 window.setInterval(render,1000)
}
