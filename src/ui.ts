import {COLORS,NAMES,pieceIcon} from './art.ts'
import {type Player,type State,type Order,type Coord,type Candidate,frontier,present,boardKey,coordName,pieceAt,boardTurn} from './model.ts'
import {requiredBoards} from './rules.ts'
import type {Scene} from './scene.ts'

export function setMatchHeader(player:Player|undefined,summary:string){
 const panel=document.getElementById('sidebar')!;panel.style.setProperty('--faction',player?COLORS[player]:'#bdbdbd')
 document.getElementById('faction-label')!.textContent=player?player[0].toUpperCase()+player.slice(1):'Match'
 document.getElementById('mobile-summary')!.textContent=summary
}
export function updateSelectionInfo(s:State,selected?:Coord,move?:Candidate){
 const host=document.getElementById('selection-info');if(!host)return
 const p=selected&&pieceAt(s,selected);host.hidden=!p
 if(!p||!selected)return
 const speed=p.kind==='K'||p.kind==='N'?'Instant arrival':p.kind==='R'||p.kind==='P'?'Fast · 3 tiles/tick':'Measured · 1.5 tiles/tick'
 const geometry={R:'One axis',B:'Two equal axes',Q:'Up to four equal axes',N:'Two and one',P:'Forward movement',K:'One step per axis'}[p.kind]
 const warning=move?.capture&&s.movement==='live'&&!move.enPassant?'Capture · Stops on contact; opposing movers can trade':move?.enPassant?'En passant · Adjacent pawn removed':move?.castle?'Castle · King and rook together':move?.branch?'Historical arrival · Creates a new branch':move?.needsVacancy?'Friendly arrival · Departure required':''
 host.innerHTML=`<span class="selection-piece">${pieceIcon(p.kind,p.player,32)}</span><div><strong>${NAMES[p.kind]}</strong><span>${coordName(selected,s)} · ${s.movement==='live'?speed:geometry}</span></div>`
 if(warning){const note=document.createElement('p');note.className='';note.textContent=warning;host.append(note)}
}
export function updateMatchUI(scene:Scene,s:State,player:Player|undefined,orders:readonly Order[]){
 const nav=document.getElementById('board-navigator');if(!nav)return
 document.body.dataset.players=String(s.playerCount??4)
 document.body.dataset.phase=document.getElementById('phase')?.textContent?.toLowerCase()??''
 document.body.dataset.multiverse=String(s.universes.length>1||s.universes[0].boards.length>1)
 nav.hidden=document.body.dataset.multiverse==='false'
 const required=new Set(player?requiredBoards(s,player).map(boardKey):[]),used=new Set(orders.map(o=>boardKey(o.from)))
 nav.replaceChildren(...[...s.universes].sort((a,b)=>Number(b.active)-Number(a.active)||frontier(a).t-frontier(b).t||a.id-b.id).map(u=>{
  const b=frontier(u),key=boardKey({u:u.id,t:b.t}),button=document.createElement('button'),owner=boardTurn(s,u),main=u.active&&b.t===present(s)
  const status=used.has(key)?'Queued':required.has(key)?'Needs move':main?'Present':u.active?'Future':'Optional'
  button.className='board-chip'+(required.has(key)&&!used.has(key)?' required':'')+(used.has(key)?' queued':'')
  button.type='button';button.style.setProperty('--board-color',owner?COLORS[owner]:u.creator?COLORS[u.creator]:'#adc692')
  button.innerHTML=`<i></i><b>${s.universes.length===1?'Main board':'U'+u.id} <small>· T${b.t}</small></b><span>${status}</span>`
  button.title=`Universe ${u.id}, time ${b.t}${owner?', '+owner+' to move':''} · ${status}`;button.onclick=()=>scene.focusBoard(u.id,b.t)
  return button
 }))
 document.querySelectorAll<HTMLElement>('[data-capture-legend]').forEach(el=>el.textContent='Capture')
}
/** Docked on desktop, expandable planning sheet on mobile. */
export function initMatchUI(scene?:Scene){
 const panel=document.getElementById('sidebar')!,handle=document.getElementById('panel-handle')!,mobile=matchMedia('(max-width:1000px) and (min-height:521px), (max-width:599px)')
 const reset=()=>{panel.style.removeProperty('left');panel.style.removeProperty('top');panel.style.removeProperty('right');if(!mobile.matches){panel.classList.remove('mobile-open');handle.setAttribute('aria-expanded','false')}}
 window.addEventListener('resize',reset)
 const layers=document.querySelector<HTMLDetailsElement>('.layer-control')
 layers?.addEventListener('toggle',()=>{if(!layers.open)return;const r=layers.querySelector('summary')!.getBoundingClientRect(),menu=layers.querySelector<HTMLElement>('.overlays')!;menu.style.left=Math.max(8,Math.min(innerWidth-178,r.right-170))+'px';menu.style.bottom=Math.max(8,innerHeight-r.top+8)+'px'})
 window.addEventListener('resize',()=>{if(layers)layers.open=false})
 handle.addEventListener('click',()=>{if(!mobile.matches)return;handle.setAttribute('aria-expanded',String(panel.classList.toggle('mobile-open')))})
 if(scene){
  const button=document.getElementById('perspective-toggle')!
  const refresh=()=>{const angled=scene.getPerspective();button.setAttribute('aria-pressed',String(angled));button.setAttribute('aria-label',angled?'Use top-down view':'Use angled 2.5D view');button.innerHTML=angled?'◇ <span>2.5D</span>':'▦ <span>Top view</span>'}
  refresh();button.onclick=()=>{scene.setPerspective(!scene.getPerspective());refresh()}
  const canvas=document.getElementById('scene')!;let w=0,h=0
  new ResizeObserver(()=>{const r=canvas.getBoundingClientRect();if(Math.abs(w-r.width)>2||Math.abs(h-r.height)>2){w=r.width;h=r.height;requestAnimationFrame(()=>innerWidth<=1000?scene.focusPlayer(undefined,false):scene.fit())}}).observe(canvas)
 }
 document.addEventListener('click',event=>{for(const menu of document.querySelectorAll<HTMLDetailsElement>('.match-menu,.layer-control,.match-explore'))if(!menu.contains(event.target as Node)||(event.target as Element).closest('.match-menu-items button,.match-explore-links a'))menu.open=false})
 document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;for(const menu of document.querySelectorAll<HTMLDetailsElement>('.match-menu[open],.layer-control[open],.match-explore[open]')){menu.open=false;menu.querySelector<HTMLElement>('summary')?.focus()}})
}
export function collapseControls(){
 if(!matchMedia('(max-width:1000px) and (min-height:521px), (max-width:599px)').matches)return
 document.getElementById('sidebar')?.classList.remove('mobile-open');document.getElementById('panel-handle')?.setAttribute('aria-expanded','false')
}
