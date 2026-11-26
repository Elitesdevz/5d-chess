import {shopCounter} from './civic-venues.ts'
import {BAR} from './bar-menu.ts'
import {CREDIT_ADVISOR,FINANCIAL_ADVISOR,PUBLIC_DICE,site,type WorldZone} from './model.ts'
import {BUILDINGS,homeZone,residentialAt,residentialSite} from './residential.ts'

type Worker={name:string;x:number;z:number}
const worker=(name:string,x:number,z:number):Worker=>({name,x,z})
export const armoryClerk=worker('Mara · Armory clerk',shopCounter.x+.42,shopCounter.z-.78)
export const bankStaff=[worker('Lender',-2.9,-2.72),worker('Cashier',2.9,-2.71),worker('Reserve clerk',7.4,-1.32),worker('Credit advisor',CREDIT_ADVISOR.x,CREDIT_ADVISOR.z-1.88)]
export const exchangeStaff=[worker('Receptionist',.65,-3.11),worker('Financial advisor',FINANCIAL_ADVISOR.x,FINANCIAL_ADVISOR.z-1.82)]
export const hotelStaff=[worker('Hotel concierge',-6.08,-7.08),worker('Lottery clerk',5.74,-7.09)]
export const casinoStaff=[worker('Ivory dealer',-5.35,-4.9),worker('Obsidian dealer',4.65,-4.9),worker('Rift dealer',-.35,.61),worker('Dice dealer',PUBLIC_DICE.x,PUBLIC_DICE.z-1.5),worker('Bartender',BAR.x,8.07)]
export const floorStaff=[worker('West trader',-2.7,-2.38),worker('East trader',2.7,-2.38)]
export const housingClerk=worker('Housing clerk',4.65,-.82)
export const staffId=(zone:string,i:number)=>'staff:'+zone+':'+i
export function serviceStaff(zone:WorldZone){
  const home=residentialAt(zone)
  const team=zone==='gunshop'?[armoryClerk]:zone==='hotel'?hotelStaff:zone==='bank'?bankStaff:zone==='exchange'?exchangeStaff:zone==='casino'?casinoStaff:
    zone.startsWith('floor:')?floorStaff:home?.building.block!==undefined&&home.level===0&&!home.stairs?[housingClerk]:[]
  return team.map((p,i)=>({id:staffId(zone,i),name:p.name,zone,...(home?residentialSite(home.building,p.x,p.z):site(zone,p.x,p.z))}))
}

// Fixed staff occupy the same city space for every observer.
export const cityStaff=[
  ...(['hotel','casino','exchange','bank','gunshop'] as const).flatMap(serviceStaff),
  ...BUILDINGS.filter(b=>b.block!==undefined).flatMap(b=>serviceStaff(homeZone(b.id,0))),
]
