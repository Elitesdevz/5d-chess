export const rankingModes={
  elo:{label:'Elo',title:'Elo leaderboard',caption:'All modes · All player counts',summary:'Your Elo',path:'/leaderboard',field:'rating'},
  coins:{label:'Coins',title:'Coin leaderboard',caption:'Ranked by coin balance',summary:'Your coins',path:'/leaderboard/coins',field:'coins'},
  'net-worth':{label:'Net Worth',title:'Net worth leaderboard',caption:'Wallet coins + current share value',summary:'Your net worth',path:'/leaderboard/net-worth',field:'netWorth'},
} as const

export type RankingMode=keyof typeof rankingModes
export type RankingValue={rating?:number;coins?:number;netWorth?:number;rank:number|null}
export type RankedPlayer=RankingValue&{name:string;avatar:string;frame?:string;games?:number;rank:number}
export interface RankingPage {players:RankedPlayer[];me:RankingValue}
const coinFormat=new Intl.NumberFormat('en',{maximumFractionDigits:0})

export function rankingMode(value:string|null):RankingMode{
  return value==='coins'||value==='net-worth'?value:'elo'
}
export function rankingValue(row:RankingValue,mode:RankingMode){
  const value=row[rankingModes[mode].field]??0
  return mode==='elo'?String(value):coinFormat.format(value)
}
export function rankingHref(mode:RankingMode){
  return '/chess/leaderboard.html'+(mode==='elo'?'':'?mode='+mode)
}
