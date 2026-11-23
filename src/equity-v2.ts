import type {EquitySymbol,StockSide} from './stock-model.ts'

export const policies={
  CAS:{
    edge:{label:'House edge',options:[0,50,100,150,200,250,300,350,400,450,500]},
    stake:{label:'Maximum stake',options:[100,500,1000,5000,10000,25000,50000,100000]},
    dividends:{label:'Dividend allocation',options:[0,10,20,30,40,50]},
    coverage:{label:'Required payout coverage',options:[100,125,150,175,200]},
    debt:{label:'Maximum corporate debt',options:[0,10,20,30]},
    open:{label:'Gambling operations',options:[1,0]},
    issue:{label:'New share issuance',options:[1,2,3,4,5]},
    buyback:{label:'Share buyback',options:[1,2,3,4,5]},
  },
  BNK:{
    lending:{label:'Maximum capital lent out',options:[20,30,40,50,60]},
    reserve:{label:'Minimum liquid reserve',options:[20,25,30,40,50]},
    rates:{label:'Additional daily interest',options:[0,1,2,3,4]},
    exposure:{label:'Maximum corporate exposure',options:[5,10,15,20]},
    dividends:{label:'Dividend allocation',options:[0,10,20,30,40,50]},
    open:{label:'New lending',options:[1,0]},
    issue:{label:'New share issuance',options:[1,2,3,4,5]},
    buyback:{label:'Share buyback',options:[1,2,3,4,5]},
  },
} as const
export const rescuedPolicies={
  CAS:{edge:300,stake:1000,dividends:0,coverage:200,debt:0,open:1},
  BNK:{lending:20,reserve:50,rates:2,exposure:5,dividends:0,open:1},
}
export const startingPolicies={
  CAS:{edge:200,stake:5000,dividends:25,coverage:125,debt:20,open:1},
  BNK:{lending:50,reserve:25,rates:0,exposure:20,dividends:25,open:1},
}
export const rescueStages=[
  {key:'funding',label:'Share of funding shortfall',options:[100,125,150,200]},
  {key:'term',label:'Repayment term',options:[7,14,21,30]},
  {key:'interest',label:'Daily interest',options:[5,10,15,20,30]},
] as const
export const EQUITY_ORDER_LIMIT=100_000
export type MarketOrder={id:string;holder:string;side:StockSide;price:number;shares:number;at:number}
export type MarketTrade={id:string;buy:string;sell:string;price:number;shares:number;at:number}
export type BallotView={id:string;symbol:EquitySymbol;policy:string;value:number;ends:number;eligible:number;yes:number;no:number;weight:number;choice?:'yes'|'no'}
export interface CompanyView {
  symbol:EquitySymbol;issued:number;inventory:number;privateEquity:number;ownership:{name:string;shares:number}[]
  cash:number;assets:number;liabilities:number;profit:number;losses:number;availableCapital:number
  policies:Record<string,number>; cooldowns:Record<string,number>;supports:Record<string,number>; supported:string[];eligible:number;votingShares:number
  bids:MarketOrder[];asks:MarketOrder[];orders:MarketOrder[];trades:MarketTrade[]
  ballot?:BallotView;rescueBallot?:BallotView;lastBallot?:{policy:string;value:number;passed:boolean;at:number}
  bankruptcy?:{at:number;day7:number;need:number;stage?:{index:number;ends:number;support:Record<string,number>;selected:number[];mine?:number[]};outcome?:string}
  recoveryUntil:number;history:{at:number;kind:string;coins:number;shares?:number}[]
}
