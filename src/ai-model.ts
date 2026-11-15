import type {Kind} from './model.ts'
export const AI_OPPONENTS = [
  {id:'pip',name:'Pip',rank:1,difficulty:'Easy',title:'The Apprentice',style:'Curious openings, loose defences. A friendly place to learn.',reward:60,piece:'N',color:'#bdcf8d'},
  {id:'brass',name:'Brass',rank:2,difficulty:'Casual',title:'The Brawler',style:'Fast rooks, advancing pawns and fearless trades.',reward:100,piece:'R',color:'#dda174'},
  {id:'iris',name:'Iris',rank:3,difficulty:'Medium',title:'The Sentinel',style:'Patient development, king safety and timely interceptions.',reward:160,piece:'B',color:'#8ebfd0'},
  {id:'vesper',name:'Vesper',rank:4,difficulty:'Hard',title:'The Timekeeper',style:'Historical king hunts and threats across timelines.',reward:240,piece:'Q',color:'#b7a0dd'},
  {id:'orion',name:'Orion',rank:5,difficulty:'Expert',title:'The Strategist',style:'Weighs competing plans and prepares for your strongest replies.',reward:360,piece:'K',color:'#e4cb82'},
] as const satisfies readonly {id:string;name:string;rank:number;difficulty:string;title:string;style:string;reward:number;piece:Kind;color:string}[]
export type AiId = typeof AI_OPPONENTS[number]['id']
export const aiOpponent = (id:unknown) => AI_OPPONENTS.find(bot=>bot.id===id)
export const aiPrize = (id:AiId,wins:number) => Math.floor(aiOpponent(id)!.reward * [1,.5,.25,.1][Math.min(3,Math.max(0,Math.floor(wins)))])
export interface AiDaily {day:string;wins:Partial<Record<AiId,number>>}
export interface AiReward {coins:number;day:string;win:number}
