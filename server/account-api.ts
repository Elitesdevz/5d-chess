import type {Account} from './accounts.ts'
import {profile} from './accounts.ts'
import {wallet} from './economy.ts'
import {fail} from './http.ts'
import type {Preferences} from '../src/account-model.ts'
import type {Movement, PlayerCount} from '../src/model.ts'
import type {ChessStore} from './storage.ts'
import type {Reply} from './model.ts'
import {ensureAccount} from './accounts.ts'
import {COMPANIES,type Companies} from './corporate.ts'
import {STOCK_QUOTES} from './stock-quotes.ts'
import {BNK,CAS,fromStockUnits,type StockQuote} from '../src/stock-model.ts'

function netWorthPrices(store:ChessStore){
  const quotes=store.metadataValue(STOCK_QUOTES) as Record<string,StockQuote>|undefined
  const prices=new Map(Object.entries(quotes??{}).map(([symbol,quote])=>[symbol,quote.price]))
  const economy=store.metadataValue(COMPANIES) as Companies|undefined
  if(economy)for(const symbol of [CAS,BNK] as const)prices.set(symbol,fromStockUnits(economy[symbol].price))
  return prices
}

export function accountApi(store: ChessStore, source: Account, path: string, method: string, data: Record<string, unknown>): Reply | undefined {
  const account = ensureAccount(source)
  if (path === '/api/settings' && method === 'POST') {
    if (!['classic','live'].includes(data.movement as string) || ![2,3,4].includes(data.players as number) || typeof data.moveNotifications !== 'boolean') fail(400, 'Invalid settings')
    account.settings = {avatar: wallet(account).loadout.icon, movement: data.movement as Movement, players: data.players as PlayerCount, moveNotifications: data.moveNotifications} satisfies Preferences
    return {status: 200, value: {profile: profile(account)}}
  }
  if (path === '/api/notifications' && method === 'GET') return {status: 200, value: {items: account.notifications, unread: account.notifications.filter(n=>!n.read).length}}
  if (path === '/api/notifications/read' && method === 'POST') {
    if (data.all !== true && (!Array.isArray(data.ids) || data.ids.length>100 || data.ids.some(id=>typeof id!=='string' || !/^[a-f0-9]{24}$/.test(id)))) fail(400, 'Invalid notification selection')
    const ids = new Set((data.ids ?? []) as string[])
    for (const notice of account.notifications) if (data.all === true || ids.has(notice.id)) notice.read = true
    return {status: 200, value: {items: account.notifications, unread: account.notifications.filter(n=>!n.read).length}}
  }
  const moneyRanking=method==='GET'&&/^\/api\/leaderboard\/(coins|net-worth)(\/full)?$/.exec(path)
  if(moneyRanking){
    const netWorth=moneyRanking[1]==='net-worth',field=netWorth?'netWorth':'coins'
    const rows=store.coinLeaderboard(netWorth?netWorthPrices(store):undefined)
    const self=rows.find(row=>row.name===account.name)
    const players=(moneyRanking[2]?rows:rows.slice(0,100)).map(({value,...row})=>({...row,[field]:value}))
    return {status:200,value:{players,me:{name:account.name,[field]:self?.value??wallet(account).coins,rank:self?.rank??null}}}
  }
  if ((path === '/api/leaderboard'||path === '/api/leaderboard/full') && method === 'GET') {
    const rows = store.leaderboard(), self = rows.find(row=>row.name===account.name)!
    return {status: 200, value: {players: path.endsWith('/full')?rows:rows.slice(0,100), me: {name: account.name, rating: self.rating, games: self.games, rank: self.rank}}}
  }
}
