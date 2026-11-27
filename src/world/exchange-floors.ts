import {STOCKS} from '../stock-catalog.ts'
export const FLOOR_LIST:{symbol:string;name:string}[]=[...STOCKS].sort((a,b)=>a.symbol.localeCompare(b.symbol))
FLOOR_LIST.push({symbol:'CAS',name:'The Casino'},{symbol:'BNK',name:'Fifth Dimension Bank'},{symbol:'LOT',name:'Royal Weekly Lottery'},{symbol:'PRI',name:'Meridian Prison'})
export const EXCHANGE_STOREY=6
