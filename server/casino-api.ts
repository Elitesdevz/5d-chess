import type {Account} from './accounts.ts'
import {profile} from './accounts.ts'
import {casinoBet,casinoView} from './casino.ts'
import {CASINO_OWNER} from '../src/casino-model.ts'
import type {UnitOfWork} from './storage.ts'
import type {Reply} from './model.ts'
import {casState,recordCasinoMargins} from './cas-shares.ts'
import {fail} from './http.ts'

export function casinoApi(unit: UnitOfWork, account: Account, path: string, method: string, data: Record<string, unknown>): Reply | undefined {
  if (path === '/api/casino' && method === 'GET') return {status:200,value:casinoView(account)}
  if (path !== '/api/casino/bet' || method !== 'POST') return
  if(data.game==='roulette')fail(409,'Roulette has moved to the Royal Salon. Refresh to join a table.')
  const owner = unit.findAccount(CASINO_OWNER)
  const accounts = owner && owner !== account ? [account,owner] : [account]
  const before=casinoView(account),now=Date.now()
  const dayState=before.recent.some(round=>round.requestId===data.requestId)?undefined:casState(unit,now)
  const result = casinoBet(account,accounts,data,now)
  if(result.nextSequence!==before.nextSequence)recordCasinoMargins(unit,[result.round],now,dayState)
  for (const target of accounts) if (!unit.findAccount(target.name)) unit.users.add(target.name,target)
  return {status:200,value:{...result,profile:profile(account)}}
}
