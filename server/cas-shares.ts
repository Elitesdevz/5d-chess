import type {Account} from './accounts.ts'

// Keep the legacy keys available for migration and historical exports.
export const CAS_META='casinoShares'
export const portfolio=(account:Account)=>account.stocks??={sequence:0,positions:{},trades:[],dividends:[],dividendsPaid:0}
