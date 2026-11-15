import {aiCatalog,aiNeedsPlan,aiDaily} from './ai-games.ts'
import {aiOpponent,aiPrize} from '../src/ai-model.ts'
import {aiAcceptsDraw} from '../src/ai.ts'
import {maintainRoom,maintainGames,resetDeadline,eliminate,finishUpdate} from './game-lifecycle.ts'
import {randomBytes} from 'node:crypto'
import {type Order, type Player, type State, type PlayerCount, type Movement, initialState, playerCount, players, survivors, shuffledPlayers, PLAYERS} from '../src/model.ts'
import {requiredBoards} from '../src/rules.ts'
import {legalMoves, routeKey} from '../src/moves.ts'
import {resolveRound, sourceBudget} from '../src/resolve.ts'
import {wallet} from './economy.ts'
import {startRatings, gameNotices, notify} from './accounts.ts'
import {hash, verify} from './security.ts'
import {fail, string, passwordValue} from './http.ts'
import type {Room, Reply} from './model.ts'
import type {ChessStore, UnitOfWork} from './storage.ts'

const maxGames = 50
function roomAccounts(unit: UnitOfWork, room: Room) {
  return [...new Set(Object.entries(room.seats).filter(([p])=>p!==room.ai?.player).map(([,name])=>name))].map(name => unit.users.get(name!)!).filter(Boolean)
}

function roomView(unit: UnitOfWork, room: Room, viewer: string) {
  const seat = PLAYERS.find(player => room.seats[player] === viewer)
  const active = survivors(room.state)
  return {code: room.code, title: room.title, seats: room.seats, seat, state: room.state,
    journal: room.journal, results: room.results, locked: Object.fromEntries(PLAYERS.map(p => [p, !!room.locked[p]])),
    waiting: Object.keys(room.seats).length < playerCount(room.state), finished: active.length <= 1, created: room.created, ai:room.ai?{id:room.ai.id,nextReward:aiPrize(room.ai.id,aiDaily(unit.users.get(room.owner)!).wins[room.ai.id]??0),thinking:aiNeedsPlan(room),error:room.ai.error,reward:room.ai.reward,drawReply:room.ai.drawReply}:undefined,rated: !room.ai && room.state.movement === 'live' && !!room.rated, deadline:room.deadline,drawOffer:room.drawOffer,endReason:room.endReason,ratingChanges: room.ratingChanges,cosmetics:Object.fromEntries(Object.entries(room.seats).filter(([p])=>p!==room.ai?.player).map(([p,name])=>[p,structuredClone(wallet(unit.users.get(name!)!).loadout)]))}
}
function orders(value: unknown, seat: Player, state: State): Order[] {
  if (!Array.isArray(value) || value.length > (state.movement ? Math.min(512, state.universes.length + 1) : 5)) fail(400, 'Invalid orders')
  const checked: Order[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') fail(400, 'Invalid order')
    const order = raw as Order
    if (order.player !== seat || !order.from || !order.to || !Array.isArray(order.route) ||
      !order.route.every(n => Number.isSafeInteger(n) && n >= 0) ||
      !sourceBudget(state, order.from, checked) ||
      !legalMoves(state, order.from, order.to).some(m => m.player === seat && routeKey(m.route) === routeKey(order.route))) {
      fail(400, 'Illegal order')
    }
    checked.push({player: seat, from: order.from, to: order.to, route: [...order.route]})
  }
  return checked
}

export function gameApi(store: ChessStore, unit: UnitOfWork, me: string, path: string, method: string, data: Record<string, unknown>): Reply | undefined {
  if (!path.startsWith('/api/games')) return
  if(path==='/api/games/ai'&&method==='GET')return {status:200,value:aiCatalog(store,unit.users.get(me)!)}
  if (path === '/api/games' && method === 'GET') {maintainGames(store,unit);unit.flush(); return {status: 200, value: {available: store.availableRooms(), mine: store.memberRooms(me), limit: maxGames}}}
  if (path === '/api/games' && method === 'POST') {
    const bot=data.ai===undefined?undefined:aiOpponent(data.ai)
    if(data.ai!==undefined&&!bot)fail(400,'Choose an AI opponent')
    if(bot){const existing=store.activeAiRooms(me).find(r=>r.ai===bot.id);if(existing)return {status:200,value:roomView(unit,unit.rooms.get(existing.code)!,me)}}
    const title = string(data.title || (bot?`${bot.name} · AI duel`:`${me}'s game`), 'game name', 60)
    const password = passwordValue(data.password, true)
    if (data.playerCount !== undefined && ![2, 3, 4].includes(data.playerCount as number)) fail(400, 'Invalid player count')
    const count = (data.playerCount ?? (bot?2:4)) as PlayerCount
    if (data.movement !== undefined && !['classic', 'live'].includes(data.movement as string)) fail(400, 'Invalid movement mode')
    const movement = (data.movement??(bot?'live':undefined)) as Movement | undefined
    if(bot&&count!==2)fail(400,'AI opponents play two-player duels')
    if (data.rated !== undefined && typeof data.rated!=='boolean') fail(400,'Invalid rated setting')

    if(bot&&store.activeAiCount()>=100)fail(409,'AI tables are busy. Try again shortly.')
    if (!bot && store.activeRooms() >= maxGames) fail(409, '50 active games already exist')
    let code = ''
    do { code = Array.from(randomBytes(4), b => String.fromCharCode(65 + b % 26)).join('') }
    while (!!unit.rooms.get(code))
    const salt = password ? randomBytes(16).toString('hex') : undefined
    const room: Room = {code, title, owner: me, password: password && salt ? hash(password, salt) : undefined,
      salt, rated: !bot && movement === 'live', seats: {red: me,...(bot?{yellow:`AI · ${bot.name}${me===`AI · ${bot.name}`?' (opponent)':''}`}:{})},...(bot?{ai:{seed:randomBytes(16).toString('hex'),id:bot.id,player:'yellow' as const}}:{}), state: initialState(count, movement, movement === 'classic' ? shuffledPlayers(count) : undefined), journal: [], results: [], locked: {}, created: Date.now()}
    unit.rooms.add(room.code,room)
    if(bot)resetDeadline(room)
    return {status: 201, value: roomView(unit,room,me)}
  }
  const match = /^\/api\/games\/([A-Z]{4})(?:\/(join|orders|resign|draw))?$/.exec(path)
  if (!match) fail(404, 'Not found')
  const room = unit.rooms.get(match[1]) ?? fail(404, 'Game not found')
  if(room.ai&&room.owner!==me)fail(403,'This is a single-player AI duel')
  maintainRoom(unit,room)
  if (match[2] === 'join' && method === 'POST') {
    if(room.ai&&room.owner!==me)fail(403,'This is a single-player AI duel')
    if (Object.values(room.seats).includes(me)) return {status: 200, value: roomView(unit,room,me)}
    if (Object.keys(room.seats).length >= playerCount(room.state)) fail(409, 'Game is full')
    if (room.password && (!room.salt || typeof data.password !== 'string' || !verify(data.password, room.salt, room.password))) fail(403, 'Incorrect game password')
    const seat = players(room.state).find(p => !room.seats[p])!
    const existing=Object.values(room.seats)
    room.seats[seat] = me
    startRatings(room,roomAccounts(unit,room))
    if(Object.keys(room.seats).length===playerCount(room.state))resetDeadline(room)
    for(const name of existing){const target=unit.users.get(name!);if(target)notify(target,{kind:'join',code:room.code,title:`${me} joined`,detail:`${room.title}: ${Object.keys(room.seats).length}/${playerCount(room.state)} seats filled.`})}
    if (Object.keys(room.seats).length===playerCount(room.state)) gameNotices(room,roomAccounts(unit,room),me,true)
    return {status: 200, value: roomView(unit,room,me)}
  }
  if (!Object.values(room.seats).includes(me)) fail(403, 'Join this game first')
  if (['resign','draw'].includes(match[2]) && method === 'POST') {
    const seat=PLAYERS.find(p=>room.seats[p]===me)!
    if(Object.keys(room.seats).length<playerCount(room.state))fail(409,'The game has not started')
    if(!survivors(room.state).includes(seat)||survivors(room.state).length<=1)fail(409,'You are not an active player')
    if(match[2]==='resign')eliminate(unit,room,[seat],`${me} resigned`)
    else {
      if(data.action==='offer'){
        if(room.drawOffer)fail(409,'A draw offer is already open')
        room.drawOffer={by:seat,accepted:[seat]}
        if(room.ai){
          if(aiAcceptsDraw(room.state)){room.ai.drawReply='accepted';room.state={...room.state,draw:true,round:room.state.round+1};room.journal.push([]);room.results.push({state:room.state,outcomes:[],rejected:[],eliminated:[]});room.locked={};room.endReason='Draw agreed';finishUpdate(unit,room)}
          else{room.ai.drawReply='declined';delete room.drawOffer}
        }
      }else if(data.action==='accept'){
        if(!room.drawOffer)fail(409,'There is no draw offer')
        if(!room.drawOffer.accepted.includes(seat))room.drawOffer.accepted.push(seat)
        if(survivors(room.state).every(p=>room.drawOffer!.accepted.includes(p))){
          room.state={...room.state,draw:true,round:room.state.round+1}
          room.journal.push([]);room.results.push({state:room.state,outcomes:[],rejected:[],eliminated:[]})
          room.locked={};room.endReason='Draw agreed by all surviving players';finishUpdate(unit,room)
        }
      }else if(data.action==='decline'){delete room.drawOffer}
      else fail(400,'Choose offer, accept or decline')
      gameNotices(room,roomAccounts(unit,room),me,true)
    }
    return {status:200,value:roomView(unit,room,me)}
  }
  if (match[2] === 'orders' && method === 'POST') {
    if (Object.keys(room.seats).length < playerCount(room.state)) fail(409, `Waiting for ${playerCount(room.state)} players`)
    const seat = PLAYERS.find(p => room.seats[p] === me)!
    if (survivors(room.state).length <= 1) fail(409,'This game has finished')
    if (!survivors(room.state).includes(seat)) fail(409, 'Your faction is eliminated')
    if(room.ai&&aiNeedsPlan(room))fail(409,'Your opponent is still planning. Try again shortly.')
    if (room.locked[seat]) fail(409, 'Orders already locked')
    if (room.state.movement === 'classic' && room.state.turn !== seat) fail(409, 'It is another player’s turn')
    if(room.ai)delete room.ai.drawReply
    const checked = orders(data.orders, seat, room.state)
    if (requiredBoards(room.state, seat, checked).length) fail(400, 'Play every required Present board first')
    const alive = survivors(room.state)
    const locks = {...room.locked, [seat]: checked}
    if (room.state.movement === 'classic' || alive.every(p => locks[p])) {
      const batch = room.state.movement === 'classic' ? checked : alive.flatMap(p => locks[p] || [])
      const result = resolveRound(room.state, batch)
      if (result.rejected.length) fail(400, result.rejected[0].reason)
      room.state = result.state
      if(survivors(room.state).length<=1)room.finishedAt??=Date.now()
      room.journal.push(batch)
      room.results.push(result)
      room.locked = {}
      resetDeadline(room)
      finishUpdate(unit,room)
      gameNotices(room,roomAccounts(unit,room),me,true)
    } else {room.locked = locks;gameNotices(room,roomAccounts(unit,room),me,false)}
    return {status: 200, value: roomView(unit,room,me)}
  }
  if (!match[2] && method === 'GET') return {status: 200, value: roomView(unit,room,me)}
  fail(405, 'Method not allowed')
}
