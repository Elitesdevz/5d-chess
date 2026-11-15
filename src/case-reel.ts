import {type Crate,type Drop,type Collectible,crateTickets,itemById} from './collection.ts'
import {KINDS,type Kind} from './model.ts'
export interface ReelReward {item:Collectible;kind?:Kind;setId?:string}
/** Decorative cards use the real pool weights; the purchased outcome is never drawn here. */
export function caseReel(crate:Crate,drop:Drop,random= Math.random){
 const tickets=crateTickets(crate),total=tickets.reduce((n,t)=>n+t.weight,0),target=42
 const cards:ReelReward[]=Array.from({length:50},()=>{
  let n=random()*total;const t=tickets.find(t=>(n-=t.weight)<0)??tickets[tickets.length-1]
  return {item:t.item,setId:t.setId,kind:!t.setId&&['skin','shape'].includes(t.item.type)?KINDS[Math.min(5,Math.floor(random()*6))]:undefined}
 })
 cards[target]={item:itemById(drop.itemId!)!,kind:drop.kind,setId:drop.setId}
 return {cards,target}
}
