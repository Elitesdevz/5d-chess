import {validateLots} from './validate.ts'
import {pedestrianGrid} from './navigation.ts'
import {frontages,facadeFinishes} from './frontages.ts'
import {meridian,type MeridianSource} from './source.ts'
import {resolveParcels,civicParcels} from './parcels.ts'
import {streetDetails} from './details.ts'
import {residences} from './residences.ts'
import {laneNetwork} from './lanes.ts'
import {woodland} from './woodland.ts'
import {paving} from './paving.ts'
import {frontage,distance,type Point} from '../../src/world/geo.ts'

const direction=(from:Point,to:Point)=>['north','northeast','east','southeast','south','southwest','west','northwest'][(Math.round(Math.atan2(to.x-from.x,from.z-to.z)/(Math.PI/4))+8)%8]
export function compile(source:MeridianSource=meridian){
  const s=resolveParcels(source)
  const {streets,circle,landmarks,houses,apartments,offices,market,boulevardTrees,parks,parkFeatures,pond,rail,crossings,parking,rooms,arrivals,spawn}=s
  const civic=civicParcels(s),homes=residences(s),traffic=laneNetwork(streets,circle)
  const detail=streetDetails(s,homes.buildings,civic,traffic.signalHeads)
  const destinations={bank:['Bank',1.8],exchange:['Stock Exchange',1.9],hotel:['Hotel',1.88],kfc:['Krulliversal Fried Chicken',.8]} as const
  const places=[...s.places,...landmarks.map(b=>({id:b.id,name:b.name,...frontage(b)})),
    ...Object.entries(destinations).map(([id,[name,gap]])=>{const room=rooms[id as keyof typeof destinations];return {id,name,x:room.x,z:room.z+room.front+gap}})]
  const directory=[detail.guide,...detail.props].filter(p=>p.kind==='notice'||p.kind==='sign').map(p=>{
    const nearest=[...places,{id:'gunshop',name:'Arcade Armory',...civic.origins.gunshop}].sort((a,b)=>distance(a,p)-distance(b,p)).slice(0,4)
    const road=[...streets].sort((a,b)=>distToStreet(p,a)-distToStreet(p,b))[0]
    return {id:'directory:'+p.id,x:p.x,z:p.z,range:2,label:p.kind==='notice'?'Read local directory':'Read street sign',
      title:p.label??'Local directory',street:p.kind==='sign'&&p.label?p.label:road.name,nearby:nearest.map(n=>({name:n.name,direction:direction(p,n),metres:Math.round(distance(p,n))}))}
  })
  const lots=validateLots(s,civic,homes,detail),navigation=pedestrianGrid(s,detail.paths)
  const shared={lots,navigation,streets,circle,landmarks,houses,apartments,offices,market,boulevardTrees,parks,parkFeatures,pond,rail,crossings,parking,rooms,arrivals,spawn,
    civic,places,...traffic,...homes,...detail,directory,woodland:woodland(source)}
  return {shared,visual:{...paving(streets,circle),inlays:frontages(s,detail),facades:facadeFinishes(s)}}
}
function distToStreet(p:Point,s:{a:Point;b:Point}){
  const clamp=(v:number,a:number,b:number)=>Math.min(Math.max(a,b),Math.max(Math.min(a,b),v))
  return Math.hypot(p.x-clamp(p.x,s.a.x,s.b.x),p.z-clamp(p.z,s.a.z,s.b.z))
}
