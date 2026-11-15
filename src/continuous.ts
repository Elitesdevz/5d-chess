import {
  type Board, type Candidate, type Coord, type EnPassant, type Kind, type Outcome, type Piece, type Player, type Resolution, type State, type Travel, type TravelPoint, type Universe,
  activation, boardKey, frontier, getBoard, index, isMain, playerCount, players, present, promotes, sameBoard
} from './model.ts'
import {layoutOf, moveGeometry, squarePoint} from './geometry.ts'
import {requiredBoards} from './rules.ts'

/** Speeds are logical tiles/tick. Zero means instant; display spacing is irrelevant. */
export const SPEEDS: Record<Kind, {normal: number; dimensional: number}> = {
  R: {normal: 3, dimensional: 4}, P: {normal: 3, dimensional: 4},
  B: {normal: 1.5, dimensional: 2}, Q: {normal: 1.5, dimensional: 2},
  K: {normal: 0, dimensional: 0}, N: {normal: 0, dimensional: 0}
}
type Draft = {t: number; cells: (Piece | null)[]; enPassant: EnPassant[]}
interface Segment {space: string; start: number; end: number; a: number[]; b: number[]}
interface Body {segments: Segment[]; piece: Piece; at: Coord; points: TravelPoint[]; alive: boolean; out?: Outcome; trace?: Travel; draft?: Draft}
const EPS = 1e-7
export function travelPosition(points: readonly TravelPoint[], tick: number) {
  let previous = points[0]
  for (const next of points.slice(1)) {
    if (tick < next.tick && next.tick > previous.tick) {
      const p = Math.max(0, (tick - previous.tick) / (next.tick - previous.tick))
      return {x: previous.x + (next.x - previous.x) * p, y: previous.y + (next.y - previous.y) * p}
    }
    previous = next
  }
  return {x: previous.x, y: previous.y}
}
/** Physics uses logical board/connection coordinates, never rendered timeline rows. */
function contact(a: Body, b: Body, end: number): number | undefined {
  let earliest = Infinity
  for (const A of a.segments) for (const B of b.segments) {
    if (A.space !== B.space) continue
    const start = Math.max(A.start, B.start), stop = Math.min(A.end, B.end, end + 1)
    if (stop < start) continue
    const position = (s: Segment, t: number) => s.a.map((v, i) => v + (s.b[i] - v) * (Number.isFinite(s.end) && s.end > s.start ? (t - s.start) / (s.end - s.start) : 0))
    const x = position(A, start).map((v, i) => v - position(B, start)[i])
    const velocity = (s: Segment) => s.a.map((v, i) => Number.isFinite(s.end) && s.end > s.start ? (s.b[i] - v) / (s.end - s.start) : 0)
    const v = velocity(A).map((n, i) => n - velocity(B)[i])
    const c = x.reduce((n, v) => n + v * v, 0) - 17 ** 2
    if (c <= EPS) { earliest = Math.min(earliest, start); continue }
    const speed = v.reduce((n, v) => n + v * v, 0), dot = x.reduce((n, value, i) => n + value * v[i], 0)
    if (speed < EPS) continue
    const d = dot * dot - speed * c
    if (d < 0) continue
    const t = (-dot - Math.sqrt(d)) / speed
    if (t >= -EPS && t <= stop - start + EPS) earliest = Math.min(earliest, start + Math.max(0, t))
  }
  return Number.isFinite(earliest) ? earliest : undefined
}
const local = (c: Coord) => [c.x * 32, c.y * 32, 0, 0]
const boardSpace = (c: Coord) => `board:${c.u}:${c.t}`

export function resolveLive(s: State, valid: Candidate[], rejected: Resolution['rejected']): Resolution {
  const outcomes: Outcome[] = valid.map(move => ({move, status: 'applied', captures: []}))
  const drafts = new Map<number, Draft>(), branches: Universe[] = [], rifts = [...s.rifts]
  const clone = (b: Board): Draft => ({t: b.t + 1, cells: b.cells.map(p => p && !s.eliminated.includes(p.player) ? {...p} : null), enPassant: []})
  const advance = (c: Pick<Coord, 'u' | 't'>) => {
    let draft = drafts.get(c.u)
    if (!draft) { draft = clone(getBoard(s, c)!); drafts.set(c.u, draft) }
    return draft
  }
  const groups = Map.groupBy(outcomes.filter(o => o.move.branch), o => boardKey(o.move.to))
  let id = Math.max(...s.universes.map(u => u.id)) + 1
  // Allocate simultaneous branches by destination, never by faction processing order.
  for (const [,group] of [...groups].sort(([a],[b])=>a.localeCompare(b))) {
    const first = group[0].move, board = clone(getBoard(s, first.to)!)
    const owners = players(s).filter(p => group.some(o => o.move.player === p))
    const branch: Universe = {id: id++, parent: first.to.u, divergence: first.to.t, creator: owners[0], owners, created: s.round, active: true, boards: [board]}
    branches.push(branch)
    for (const out of group) {
      out.branch = branch.id
      if (out.move.from.u !== out.move.to.u && !rifts.some(r => r.a === out.move.from.u && r.b === branch.id))
        rifts.push({a: out.move.from.u, b: branch.id, usableFrom: s.round + 1})
    }
  }
  const branchDraft = (out: Outcome | undefined) => branches.find(u => out && u.id === out.branch)?.boards[0] as Draft | undefined
  for (const out of outcomes) {
    for (const leg of out.move.castle ? [out.move, out.move.castle] : [out.move]) advance(leg.from).cells[index(leg.from)] = null
    if (!out.move.branch) advance(out.move.to)
  }
  // A genuinely immobile Present board is exempt, rather than trapping the game forever.
  const required = new Set(players(s).flatMap(p => requiredBoards(s, p)).map(boardKey))
  for (const u of s.universes) if (isMain(u, present(s)) && !required.has(boardKey({u: u.id, t: frontier(u).t}))) advance({u: u.id, t: frontier(u).t})
  const staged: State = {...s, universes: [...s.universes.map(u => drafts.has(u.id) ? {...u, boards: [...u.boards, drafts.get(u.id)!]} : u), ...branches]}
  const layout = layoutOf(staged), bodies: Body[] = [], travel: Travel[] = []
  for (const out of outcomes) {
    const m = out.move, target = branchDraft(out) ?? drafts.get(m.to.u)!
    for (const leg of m.castle ? [m, {...m.castle, path: [m.castle.from, m.castle.to]}] : [m]) {
      const to = {...leg.to, u: out.branch ?? leg.to.u, t: target.t}
      const path = leg.path.map((c, i) => i === leg.path.length - 1 ? to :
        c.u === leg.from.u && c.t === leg.from.t ? {...c, t: drafts.get(c.u)!.t} : c)
      const speeds = SPEEDS[leg.piece.kind]
      const geometry = moveGeometry(staged, {...m, from: path[0], to, path})
      const points: TravelPoint[] = []
      const segments: Segment[] = []
      const dimensional = !sameBoard(m.from, m.to)
      let tick = 0, distance = 0
      for (const [i, segment] of geometry.entries()) {
        if (i) {
          const from = leg.path[i - 1], dest = leg.path[i]
          const a = local(from), b = local(dest)
          let space = boardSpace(to)
          if (dimensional) {
            a[2] = from.t * 32; b[2] = dest.t * 32
            if (from.u === dest.u) space = `time:${from.u}`
            else {
              const low = Math.min(from.u, dest.u), high = Math.max(from.u, dest.u)
              space = `edge:${low}:${high}`
              a[3] = from.u === low ? 0 : 32; b[3] = dest.u === low ? 0 : 32
            }
          }
          const length = Math.hypot(...a.map((v, j) => b[j] - v))
          const speed = dimensional ? speeds.dimensional : speeds.normal
          const start = tick
          distance += length
          if (speed) tick += length / (32 * speed)
          if (tick > start) segments.push({space, start, end: tick, a, b})
        }
        points.push({...segment.point, tick})
      }
      // During dimensional flight only other travellers on the same connection
      // are corporeal. At arrival the unit becomes a normal board occupant.
      segments.push({space: boardSpace(to), start: tick, end: Infinity, a: local(to), b: local(to)})
      const trace: Travel = {piece: leg.piece, from: leg.from, to, points, distance, normalSpeed: speeds.normal, dimensionalSpeed: speeds.dimensional, endTick: tick}
      travel.push(trace)
      bodies.push({piece: leg.piece, at: to, points, segments, alive: true, out, trace, draft: target})
    }
  }
  for (const [u, draft] of [...drafts, ...branches.map(b => [b.id, b.boards[0] as Draft] as const)]) {
    for (let i = 0; i < draft.cells.length; i++) {
      const piece = draft.cells[i]
      if (!piece) continue
      const at = {x: i % 14, y: Math.floor(i / 14), u, t: draft.t}
      bodies.push({piece, at, segments: [{space: boardSpace(at), start: 0, end: Infinity, a: local(at), b: local(at)}], points: [{...squarePoint(staged, at, layout), tick: 0}], alive: true, draft})
    }
  }
  const ticks = Math.max(0, ...travel.map(t => t.endTick)), dead = new Set<Player>()
  const events: {tick: number; a: Body; b: Body}[] = []
  for (let a = 0; a < bodies.length; a++) for (let b = a + 1; b < bodies.length; b++) {
    if ((!bodies[a].out && !bodies[b].out) || (bodies[a].out && bodies[a].out === bodies[b].out)) continue
    const tick = contact(bodies[a], bodies[b], ticks)
    if (tick !== undefined) events.push({tick, a: bodies[a], b: bodies[b]})
  }
  events.sort((a, b) => a.tick - b.tick)
  for (let i = 0; i < events.length;) {
    const tick = events[i].tick, contacts: typeof events = []
    while (i < events.length && Math.abs(events[i].tick - tick) < EPS) { const event = events[i++]; if (event.a.alive && event.b.alive) contacts.push(event) }
    const hit = new Set<Body>()
    for (const {a, b} of contacts) {
      hit.add(a); hit.add(b)
      if (a.out) a.out.captures.push({at: b.at, piece: b.piece})
      if (b.out) b.out.captures.push({at: a.at, piece: a.piece})
    }
    for (const body of hit) {
      body.alive = false
      if (body.piece.kind === 'K') dead.add(body.piece.player)
      if (body.out) body.out.status = 'collided'
      if (body.trace) { body.trace.endTick = tick; body.trace.collision = true }
      else if (body.draft) {
        body.draft.cells[index(body.at)] = null
        travel.push({piece: body.piece, from: body.at, to: body.at, points: body.points, distance: 0, normalSpeed: 0, dimensionalSpeed: 0, endTick: tick, collision: true})
      }
    }
  }
  for (const body of bodies.filter(b => b.alive && b.trace)) {
    const kind = body.piece.kind === 'P' && promotes(body.piece.player, body.at, s) ? 'Q' : body.piece.kind
    body.draft!.cells[index(body.at)] = {...body.piece, moved: true, kind}
    const m = body.out!.move
    if (m.enPassant) {
      const victim = bodies.find(b => !b.out && b.alive && b.draft === body.draft && index(b.at) === index(m.enPassant!))
      if (victim) {victim.alive = false; body.draft!.cells[index(victim.at)] = null; body.out!.captures.push({at: victim.at, piece: victim.piece})}
    }
    if (kind === 'P' && sameBoard(m.from, m.to) && Math.abs(m.from.x - m.to.x) + Math.abs(m.from.y - m.to.y) === 2)
      body.draft!.enPassant.push({square: m.to, crossed: {x: (m.from.x + m.to.x) / 2, y: (m.from.y + m.to.y) / 2}, round: s.round + 1})
  }
  const eliminated = players(s).filter(p => dead.has(p)), allDead = players(s).filter(p => dead.has(p) || s.eliminated.includes(p))
  for (const draft of [...drafts.values(), ...branches.map(b => b.boards[0] as Draft)]) {
    draft.cells = draft.cells.map(p => p && !allDead.includes(p.player) ? p : null)
    draft.enPassant = draft.enPassant.filter(e => draft.cells[index(e.square)]?.kind === 'P')
  }
  // Draft arrays are mutable only inside this transaction. Rebind replaced cells into the staged boards.
  const universes = staged.universes.map(u => {
    const draft = drafts.get(u.id) ?? branchDraft(outcomes.find(o => o.branch === u.id)!)
    return draft ? {...u, boards: [...u.boards.slice(0, -1), draft]} : u
  })
  return {state: {...s, round: s.round + 1, universes: activation(universes, allDead, playerCount(s)), rifts, eliminated: allDead}, outcomes, rejected, eliminated, travel, ticks: Math.max(0, ...travel.map(t => t.endTick))}
}
