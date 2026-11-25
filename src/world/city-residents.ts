import {PLACES} from './city-plan.ts'
import {UNITS,type Deeds} from './housing.ts'
import type {WorldPlayer} from './model.ts'
export const CITY_DAY_MS=3600000
export const RESIDENT_NAMES=['Amira','Arthur','Aya','Bram','Carmen','Cian','Dalia','Dion','Elio','Eva','Farah','Felix','Greta','Hana','Hugo','Inez','Iris','Isak','Jade','Jules','June','Kai','Lena','Leonie','Lotte','Marlowe','Milo','Nadia','Nico','Noor','Otis','Rafi','Rosa','Saskia','Theo','Vera']
const occupations=[
  ['Town clerk','hall'],['Financial analyst','bank'],['Broker','exchange'],['Hotel employee','hotel'],['Baker','bakery'],
  ['Bookseller','books'],['Hospital employee','hospital'],['Police clerk','police'],['Fire station mechanic','fire'],
  ['Grocer','market'],['Railway employee','station-plaza'],['Student','school'],['Retired resident','gardens'],
  ['Freelancer','square'],['Barber','barber'],['Restaurant employee','kfc'],['Florist','florist'],['Office worker','office']
] as const
const lunches=['cafe','kfc','bakery','square','gardens','restaurant','station-plaza']
const leisure=['gardens','square','mill-green','restaurant','cafe','station-plaza','books','hotel']
export type Resident={id:string;name:string;home:string;address:string;occupation:string;work:string;lunch:string;leisure:string;speed:number;departure:number;shift:number;style:number;household:number}
export type ResidentView=WorldPlayer&{id:string;occupation:string;activity:string;destination:string;style:number;home:string}
const available=UNITS.filter(u=>u.tenure==='resident'&&(u.block!==undefined||Number(u.id.slice(6))%3!==0))
export function assignResidents(deeds:Deeds,now:number):Resident[]{
  const homes=available.filter(u=>!deeds[u.id]||!!deeds[u.id].until&&deeds[u.id].until<=now)
  if(!homes.length)return []
  return RESIDENT_NAMES.map((name,i)=>{
    const home=homes[i%homes.length],job=occupations[i%occupations.length]
    return {id:'resident-'+i,name,home:home.id,address:home.name,occupation:job[0],work:job[1],lunch:lunches[(i*5+1)%lunches.length],
      leisure:leisure[(i*3+2)%leisure.length],speed:1.38+(i%7)*.067,departure:6.65+(i%11)*.27,shift:6.8+(i%5)*.44,style:i,household:Math.floor(i/homes.length)}
  })
}
export function routine(r:Resident,now:number,cycle=CITY_DAY_MS){
  const hour=((now%cycle+cycle)%cycle)/cycle*24
  const finish=r.departure+r.shift
  if(hour<5.9+(r.style%5)*.17||hour>21.25+(r.style%8)*.23)return {activity:'Sleeping',id:'home',rest:true}
  if(hour<r.departure||hour>=finish+3.05)return {activity:'At home',id:'home',rest:false}
  if(hour>11.35+r.style%11*.114&&hour<13.2+r.style%6*.17)return {activity:'Lunch break',id:r.lunch,rest:false}
  if(hour<finish)return {activity:r.occupation,id:r.work,rest:false}
  return {activity:'Free time',id:r.leisure,rest:false}
}
export const scheduledPlace=(id:string)=>PLACES.find(p=>p.id===id)
