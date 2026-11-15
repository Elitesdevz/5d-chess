import {aiOpponent,type AiId,type AiReward} from './ai-model.ts'
import {profileHref} from './profile-model.ts'
import {type Loadout} from './collection.ts'
import {setCosmetics} from './art.ts'
import {initShell,refreshAccount} from './shell.ts'
import {requiredBoards,optionalAllowance} from './rules.ts'
import {awareness, nextPlayable, threatSquares} from './awareness.ts'
import {initMatchUI, setMatchHeader, collapseControls,updateMatchUI,updateSelectionInfo} from './ui.ts'
import {Scene} from './scene.ts'
import {COLORS, NAMES, pieceIcon} from './art.ts'
import {type Candidate, type Coord, type Order, type Player, type Resolution, type State,
  coordKey, coordName, frontier, getUniverse, initialState, isMain, moveBudget, pieceAt, playerCount, players, present, survivors, turnOrder, boardTurn} from './model.ts'
import {legalMoves, routeKey} from './moves.ts'
import {sourceBudget} from './resolve.ts'

type Room = {code: string; title: string; seats: Partial<Record<Player, string>>; seat?: Player;
  state: State; results: Resolution[]; journal: Order[][]; locked: Record<Player, boolean>;
  waiting: boolean; finished: boolean; ai?:{id:AiId;nextReward:number;thinking:boolean;error?:string;reward?:AiReward;drawReply?:string};rated?:boolean; deadline?:number;drawOffer?:{by:Player;accepted:Player[]};endReason?:string;cosmetics?:Partial<Record<Player,Loadout>>}
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const code = new URLSearchParams(location.search).get('code')?.toUpperCase()
if (!code || !/^[A-Z]{4}$/.test(code)) location.replace('/chess/lobby.html')
let room: Room | undefined
let frame: number | null = null
let selected: Coord | undefined
let choices: Candidate[] = []
let hover: Candidate | undefined
let routes: Candidate[] = []
let routeIndex = 0
let draft: Candidate[] = []
let caption = ''
let first = true
let loading = false
let submitting = false
let animation: {outcomes: Resolution["outcomes"]; started: number; duration: number; result: State; travel?: Resolution['travel']; ticks?: number} | undefined
const names: Record<Player, string> = {red:'Red',blue:'Blue',yellow:'Yellow',green:'Green'}
let opening = initialState()
const scene = new Scene(element<HTMLCanvasElement>('scene'), opening, {
  pick,
  hover(c) {
    if (routes.length) return
    hover = c ? choices.find(m => coordKey(m.to) === coordKey(c)) : undefined
    sync()
  },
  scale(n) { element('scale').textContent = `${Math.round(n * 100)}%` },
  describe(c) {
    if (!room) return
    const piece = pieceAt(shown(), c)
    const owner = boardTurn(shown(), getUniverse(shown(), c.u)!, c.t)
    caption = `${coordName(c, shown())}${owner ? ` · ${names[owner]} to move` : ''}${piece ? ` · ${names[piece.player]} ${NAMES[piece.kind]}` : ''}`
    element('map-caption').textContent = caption
  },
  rift(a, b, from) { element('map-caption').textContent = `Rift U${a} ↔ U${b} · from round ${from}` }
})
function shown() { return frame === null ? room!.state : frame === 0 ? opening : room!.results[frame - 1].state }
const canPlan = () => !!room && frame === null && !animation && !room.waiting && !room.finished &&
  !!room.seat && (room.state.movement !== 'classic' || room.state.turn === room.seat) && survivors(room.state).includes(room.seat) && !room.locked[room.seat]
const preview = () => routes[routeIndex] ?? hover
function sync() {
  if (!room) return
  updateSelectionInfo(shown(),selected,preview())
  const info = canPlan() && room?.seat ? awareness(shown(), room.seat, draft) : undefined
  scene.update({state:shown(), animation, playable: info?.playable, checked: info && threatSquares(info.threats), moves:canPlan() ? choices : [], selected, preview:preview(), queued:draft})
}
function clear() { selected = undefined; choices = []; hover = undefined; routes = []; routeIndex = 0 }
function pick(c?: Coord) {
  if (!canPlan() || !room?.seat) return
  if (c && selected && coordKey(c) !== coordKey(selected)) {
    const matches = choices.filter(m => coordKey(m.to) === coordKey(c))
    if (matches.length === 1) { queue(matches[0]); return }
    if (matches.length > 1) { routes = matches; routeIndex = 0; render(); return }
  }
  const same = !!(c && selected && coordKey(c) === coordKey(selected))
  clear()
  if (c && !same && pieceAt(room.state, c)?.player === room.seat && sourceBudget(room.state, c, draft)) {
    selected = c
    choices = legalMoves(room.state, c)
  }
  render()
}
function queue(move: Candidate) { draft.push(move); clear(); render(); if (room?.seat) nextPlayable(scene, awareness(room.state, room.seat, draft).playable, move.from) }
function message(text: string, problem = false) {
  const box = element('activity')
  box.className = problem ? 'form-error' : 'online-message'
  box.textContent = text
}
function render() {
  if (!room) return
  element('game-code').textContent = room.code
  element('game-title').textContent = room.title
  element('game-title').title = room.title
  document.title = `${room.title} · 5D Chess`
  const seat = room.seat
  const s = shown()
  element('online-mode').textContent = s.movement ? `${room.ai?'AI DUEL · ':''}${s.movement.toUpperCase()} · ${room.rated?'RATED':'UNRATED'}` : 'ONLINE MATCH'
  element('phase').textContent = animation ? 'RESOLVING' : room.finished ? 'FINISHED' : room.waiting ? 'WAITING' : room.ai?.thinking ? 'AI THINKING' : frame !== null ? 'REPLAY' :
    room.state.movement === 'classic' && room.state.turn !== seat ? 'WAITING TURN' : seat && room.locked[seat] ? 'LOCKED' : 'PLANNING'
  setMatchHeader(seat, `${room.code} · ${element('phase').textContent?.toLowerCase()}`)
  element('metrics').textContent = `Present T${present(s)} · ${s.universes.length} universes · ${s.rifts.length} rifts`
  const seats = element('seats')
  seats.replaceChildren(...(room.state.movement === 'classic' ? turnOrder(room.state) : players(room.state)).map(player => {
    const span = document.createElement('span')
    span.style.setProperty('--seat-color',COLORS[player])
    span.className = `${player === seat ? 'self' : ''} ${room!.locked[player] ? 'locked' : ''}`
    if (room!.state.movement === 'classic' && room!.state.turn === player) span.classList.add('turn-owner')
    span.textContent = `${room!.state.movement === 'classic' && room!.state.turn === player ? '▶ ' : ''}${names[player]}: `
    if(room!.seats[player]){const link=document.createElement('a');link.className='player-profile-link';link.href=room!.ai&&player==='yellow'?'/chess/lobby.html#ai':profileHref(room!.seats[player]!);link.textContent=room!.seats[player]!;span.append(link)}else span.append('Open')
    if(room!.locked[player])span.append(' ✓')
    return span
  }))
  const last = room.results.length
  element('history-label').textContent = frame === null ? `${last} rounds resolved` : frame ? `After round ${frame}` : 'Opening position'
  element<HTMLButtonElement>('previous').disabled = !!animation || !last || frame === 0
  element<HTMLButtonElement>('next').disabled = !!animation || frame === null
  element<HTMLButtonElement>('live').disabled = !!animation || frame === null
  const turn = element('turn')
  turn.replaceChildren()
  const head = document.createElement('div')
  head.className = 'turn'
  const title = document.createElement('h3')
  title.textContent = seat ? `${names[seat]} · Your army` : 'Spectating'
  const identity = document.createElement('div')
  identity.append(title)
  if (seat) {
    const icon = document.createElement('div')
    icon.className = 'turn-icon'
    icon.style.setProperty('--faction', COLORS[seat])
    icon.innerHTML = pieceIcon('K', seat, 33)
    const username = document.createElement('a')
    username.className='player-profile-link';username.href=profileHref(room.seats[seat]!);username.textContent = room.seats[seat] || ''
    identity.append(username)
    head.append(icon)
  }
  head.append(identity)
  turn.append(head)
  const panel = element('planning')
  panel.replaceChildren()
  if (room.waiting) {
    const p = document.createElement('p')
    p.className = 'online-message'
    p.textContent = `${Object.keys(room.seats).length}/${playerCount(room.state)} players joined. Share code ${room.code} to fill the remaining seats.`
    panel.append(p)
  } else if (room.finished) {
    const alive = survivors(room.state)
    const p = document.createElement('p')
    p.className = 'online-message'
    p.textContent = alive.length === 1 ? `${names[alive[0]]} wins.` : 'The game ended in a draw.'
    panel.append(p)
  } else if (frame !== null) {
    const p = document.createElement('p'); p.className = 'online-message'; p.textContent = 'Viewing an earlier round.'; panel.append(p)
  } else if (seat && room.locked[seat]) {
    const p = document.createElement('p'); p.className = 'online-message'; p.textContent = 'Orders locked. Waiting for the other players.'; panel.append(p)
  } else if (room.state.movement === 'classic' && room.state.turn !== seat) {
    const p = document.createElement('p'); p.className = 'online-message'; p.textContent = `${names[room.state.turn!]} is playing. Board outlines show each board’s owner.`; panel.append(p)
  } else if (canPlan()) {
    const budget = moveBudget(room.state)
    if(room.state.movement)budget.main=requiredBoards(room.state,seat!).length
    const main = draft.filter(o => isMain(getUniverse(room!.state, o.from.u)!, present(room!.state))).length
    const optional=optionalAllowance(room.state,seat!,draft)
    const count = document.createElement('p')
    count.className = 'budget'
    count.innerHTML = `<span><small>REQUIRED LEFT</small><b>${budget.main-main}<em> / ${budget.main}</em></b></span><span><small>OPTIONAL LEFT</small><b>${optional.left}<em> / ${optional.total}</em></b></span>`
    panel.append(count)
    if(!draft.length&&!routes.length){const empty=document.createElement('div');empty.className='empty';empty.innerHTML='<span>◇</span><p>Select a piece to plan a move.</p>';panel.append(empty)}
    for (const [i, order] of draft.entries()) {
      const row = document.createElement('div'); row.className = 'game-row queued-match-order'
      const label = document.createElement('span'); label.innerHTML=`${pieceIcon(order.piece.kind,seat!,23)}<b>${NAMES[order.piece.kind]}<small>${coordName(order.from,shown())} → ${coordName(order.to,shown())}</small></b>`;label.onclick=()=>scene.focusBoard(order.from.u,order.from.t)
      const remove = document.createElement('button'); remove.className = 'text-button'; remove.textContent = '×';remove.setAttribute('aria-label','Remove order '+(i+1))
      remove.onclick = () => {draft.splice(i, 1); render()}
      row.append(label, remove); panel.append(row)
    }
    if (routes.length) {
      const cycle = document.createElement('button'); cycle.className = 'button'; cycle.textContent = `Cycle route ${routeIndex + 1}/${routes.length}`
      cycle.onclick = () => {routeIndex = (routeIndex + 1) % routes.length; render()}
      const select = document.createElement('button'); select.className = 'button'; select.textContent = 'Queue route'
      select.onclick = () => queue(routes[routeIndex])
      panel.append(cycle, select)
    }
    const lock = document.createElement('button'); lock.className = 'button primary block'; lock.textContent = submitting ? 'Submitting…' : room.state.movement === 'classic' ? 'Submit turn' : draft.length ? 'Lock orders' : seat && requiredBoards(room.state, seat).length ? 'Plan required moves' : 'Lock in a pass'
    lock.disabled = submitting || !!room.ai?.thinking
    lock.onclick = () => {
      if (room?.seat && requiredBoards(room.state, room.seat, draft).length) { message('Play every required Present board before submitting.', true); nextPlayable(scene, requiredBoards(room.state, room.seat, draft)); return }
      if (room?.seat && (awareness(room.state, room.seat, draft).remaining.length || awareness(room.state, room.seat, draft).kingLost)) {
        const dialog = element<HTMLDialogElement>('check-dialog')
        dialog.showModal()
      } else void submit()
    }
    if (seat && (awareness(room.state, seat, draft).remaining.length || awareness(room.state, seat, draft).kingLost)) {
      const warning = document.createElement('p'); warning.className = 'check-notice'; warning.textContent = 'Advisory check: your king is threatened. Review the red highlights.'; panel.append(warning)
    }
    panel.append(lock)
    if (seat && requiredBoards(room.state, seat, draft).length) { const note = document.createElement('p'); note.className = 'required-notice'; note.textContent = `${requiredBoards(room.state, seat, draft).length} Present ${requiredBoards(room.state,seat,draft).length===1?'board still needs':'boards still need'} a move.`; panel.append(note) }
  }
  if(room.ai){
    const bot=aiOpponent(room.ai.id)!,note=document.createElement('p');note.className='online-message ai-match-note'
    note.textContent=room.ai.error??(room.finished?room.ai.reward?`Victory · +${room.ai.reward.coins} coins. Next win today: ${room.ai.nextReward} coins.`:'No coins this time. Every rematch is a fresh chance.':room.ai.thinking?`${bot.name} is planning… You can prepare your moves.`:`${bot.name} · ${bot.difficulty} · ${bot.title}`)
    if(room.ai.reward)note.classList.add('ai-victory');panel.append(note)
    if(room.ai.drawReply){const reply=document.createElement('p');reply.className='online-message';reply.textContent=room.ai.drawReply==='declined'?`${bot.name} declines the draw. There is still a game to play.`:`${bot.name} accepts the draw.`;panel.append(reply)}
    if(room.finished){const again=document.createElement('a');again.className='button primary block';again.href='/chess/lobby.html#ai';again.textContent='Choose your next challenge';panel.append(again)}
  }
  if(!room.waiting&&!room.finished&&seat&&survivors(room.state).includes(seat)){
    const status=document.createElement('p');status.className='online-message'
    if(room.deadline&&!room.ai?.thinking){const hours=Math.max(0,Math.ceil((room.deadline-Date.now())/3_600_000));status.textContent=`${room.locked[seat]?'Orders locked · Round deadline':room.state.movement==='classic'&&room.state.turn!==seat?'Current player’s deadline':'Your order deadline'} in ${hours}h · 48-hour inactivity limit.`;status.title=new Date(room.deadline).toLocaleString();panel.append(status)}
    const actions=document.createElement('div');actions.className='planning-links'
    const add=(label:string,path:string,action?:string)=>{const button=document.createElement('button');button.className='text-button';button.textContent=label;button.disabled=submitting;button.onclick=()=>{if(path==='resign'&&!confirm('Resign this game? Your faction will be eliminated.'))return;void matchAction(path,action)};actions.append(button)}
    if(room.drawOffer){
      const offer=document.createElement('p');offer.className='online-message';offer.textContent=`${room.seats[room.drawOffer.by]} offers a draw · ${room.drawOffer.accepted.length}/${survivors(room.state).length} agreed. Every surviving player must agree.`;panel.append(offer)
      if(!room.drawOffer.accepted.includes(seat))add('Accept draw','draw','accept')
      add(room.drawOffer.by===seat?'Withdraw offer':'Decline draw','draw','decline')
    }else add('Offer draw','draw','offer')
    add('Resign','resign');panel.append(actions)
  }
  updateMatchUI(scene,s,canPlan()?seat:undefined,canPlan()?draft:[])
  sync()
}
async function matchAction(path:string,action?:string){
  if(submitting)return
  submitting=true;render()
  try{
    const response=await fetch(`/api/games/${code}/${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action})}),data=await response.json()
    if(!response.ok)throw Error(data.error||'Could not update match')
    draft=[];clear();applyRoom(data as Room);render();void refreshAccount().catch(()=>{})
  }catch(cause){message(cause instanceof Error?cause.message:'Could not update match',true)}
  finally{submitting=false;render()}
}
function applyRoom(next: Room) {
  const before = room
  room = next
  setCosmetics(next.cosmetics??{})
  if (before && next.results.length > before.results.length) {
    const result = next.results.at(-1)!
    void refreshAccount().catch(()=>{})
    if(!result.outcomes.length){draft=[];clear();frame=null;return}
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 260 : result.travel ? Math.max(1200, Math.min(8000, (result.ticks ?? 0) * 180)) : 1600
    animation = {outcomes: result.outcomes, started: performance.now(), duration, result: next.state, travel: result.travel, ticks: result.ticks}
    requestAnimationFrame(() => scene.fit())
    frame = null
    message('Movement resolving…')
    window.setTimeout(() => {
      animation = undefined; message(''); render()
      if (room?.seat) nextPlayable(scene, awareness(room.state, room.seat, draft).playable)
    }, duration + 30)
  }
}
async function load() {
  if (loading) return
  loading = true
  try {
    const response = await fetch(`/api/games/${code}`)
    if (response.status === 401) { location.replace('/chess/login.html'); return }
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Could not load game')
    const oldRound = room?.state.round
    applyRoom(data as Room)
    opening = initialState(playerCount((data as Room).state))
    if (oldRound && oldRound !== (data as Room).state.round) { draft = []; clear(); frame = null; message(animation ? 'Movement resolving…' : `Round ${oldRound} resolved. Plan the next round.`) }
    render()
    if (first) { first = false; scene.focusPlayer((data as Room).seat) }
  } catch (cause) { message(cause instanceof Error ? cause.message : 'Could not load game', true) }
  finally { loading = false }
}
async function submit() {
  if (!canPlan() || submitting) return
  submitting = true
  render()
  try {
    const response = await fetch(`/api/games/${code}/orders`, {method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({orders:draft.map(({player, from, to, route}) => ({player, from, to, route}))})})
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Could not lock orders')
    collapseControls()
    applyRoom(data as Room)
    draft = []; clear(); if (!animation) message('Orders locked. Waiting for the others.'); render()
  } catch (cause) { message(cause instanceof Error ? cause.message : 'Could not lock orders', true) }
  finally { submitting = false; render() }
}
element<HTMLButtonElement>('previous').onclick = () => { if (!room?.results.length) return; frame = Math.max(0, (frame ?? room.results.length) - 1); clear(); render() }
element<HTMLButtonElement>('next').onclick = () => { if (frame === null || !room) return; frame = frame >= room.results.length ? null : frame + 1; clear(); render() }
element<HTMLButtonElement>('live').onclick = () => { frame = null; clear(); render() }
element('viewport').querySelectorAll<HTMLButtonElement>('[data-camera]').forEach(button => button.onclick = () => {
  switch (button.dataset.camera) {
    case 'minus': scene.zoom(1 / 1.3, undefined, true); break
    case 'plus': scene.zoom(1.3, undefined, true); break
    case 'fit': scene.fit(); break
    case 'focus': scene.focus(); break
    case 'player': scene.focusPlayer(room?.seat); break
    case 'reset': scene.focusPlayer(); break
  }
})
element('viewport').querySelectorAll<HTMLButtonElement>('[data-overlay]').forEach(button => button.onclick = () => {
  const enabled = button.getAttribute('aria-pressed') !== 'true'
  button.setAttribute('aria-pressed', String(enabled))
  scene.setOverlay(button.dataset.overlay!, enabled)
})
void initShell()
initMatchUI(scene)
element('review-check').onclick = () => element<HTMLDialogElement>('check-dialog').close()
element('submit-check').onclick = () => { element<HTMLDialogElement>('check-dialog').close(); void submit() }
void load()
window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 3000)
