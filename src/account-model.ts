import {type Loadout} from './collection.ts'
import {type Movement} from './model.ts'
export const POOLS = ['classic-duel','classic-multi','live-duel','live-multi'] as const
export type RatingPool = typeof POOLS[number]
export interface Preferences {avatar: string; movement: Movement; players: 2|3|4; moveNotifications: boolean}
export interface Rating {value: number; games: number}
export interface Profile {name: string; settings: Preferences; rating: Rating; coins: number; loadout: Loadout}
export interface Notice {id: string; kind: 'join'|'move'|'turn'|'result'|'rating'|'casino'|'warning'; title: string; detail: string; code: string; game?:'dice'|'roulette'; created: number; read: boolean; permanent?: boolean}
export const poolFor = (movement: Movement = 'live', count = 2): RatingPool => `${movement}-${count === 2 ? 'duel' : 'multi'}`

export const noticeUrl=(notice:Notice)=>notice.kind==='warning'?'/chess/lobby.html':notice.kind==='casino'?'/chess/world.html?go=casino':`/chess/online.html?code=${encodeURIComponent(notice.code)}`
