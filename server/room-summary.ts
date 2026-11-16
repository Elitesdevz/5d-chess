import {playerCount, survivors} from '../src/model.ts'
import type {Room} from './model.ts'

export function roomWasRated(room:Room){return !room.ai&&(room.state.movement==='live'&&!!room.rated||!room.state.movement&&!!room.legacyEloBackfill&&!!room.ratingSettled)}
export function roomSummary(room: Room) {
  return {code: room.code, title: room.title, players: Object.keys(room.seats).length,
    maxPlayers: playerCount(room.state), protected: !!room.password, movement: room.state.movement ?? 'legacy',
    ai:room.ai?.id, aiReward:room.ai?.reward?.coins, draw:!!room.state.draw, rated:roomWasRated(room), turn: room.state.turn, round: room.state.round, finished: survivors(room.state).length <= 1}
}
export type RoomSummary = ReturnType<typeof roomSummary>
