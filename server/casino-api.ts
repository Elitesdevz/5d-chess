import type {Account} from './accounts.ts'
import {profile} from './accounts.ts'
import {casinoBet,casinoView,validateBet} from './casino.ts'
import type {UnitOfWork} from './storage.ts'
import type {Reply} from './model.ts'
import {acceptWager,casinoTerms,settleWager} from './casino-finance.ts'
import {fail} from './http.ts'

export function casinoApi(unit: UnitOfWork, account: Account, path: string, method: string, data: Record<string, unknown>): Reply | undefined {
  if(path==='/api/casino/cave'||path==='/api/casino/cave/bet'){
    if(!account.cave?.active)fail(403,'Enter the cave from the city')
    if(path.endsWith('/cave')&&method==='GET')return {status:200,value:casinoView(account,true)}
    if(path.endsWith('/bet')&&method==='POST'&&data.game==='dice')return {status:200,value:{...casinoBet(account,[account],data,Date.now(),undefined,true),profile:profile(account)}}
    return
  }
  const now=Date.now()
  if (path === '/api/casino' && method === 'GET') return {status:200,value:{...casinoView(account),...casinoTerms(unit,now)}}
  if (path !== '/api/casino/bet' || method !== 'POST') return
  if(data.game==='roulette')fail(409,'Roulette has moved to the Royal Salon. Refresh to join a table.')
  const bet=validateBet(data),before=casinoView(account)
  const maximum=before.recent.some(r=>r.requestId===bet.requestId)?undefined:acceptWager(unit,bet,now)
  const result=casinoBet(account,[account],data,now,undefined,false,maximum)
  if(maximum!==undefined)settleWager(unit,result.round,maximum,now)
  return {status:200,value:{...result,...casinoTerms(unit,now),profile:profile(account)}}
}
