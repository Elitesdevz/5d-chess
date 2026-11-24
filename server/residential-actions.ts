import {aboard,access,DOOR_TRAVEL,homeZone,openLift,residentialAt,residentialSite,type HomePoint,type ResidentialView} from '../src/world/residential.ts'
import {near,riderHeight,type WorldPlayer} from '../src/world/model.ts'
import type {Position} from '../src/roulette-hall-model.ts'

export type Occupant=WorldPlayer&{homeExit?:Position}
export function operateDoor(actor:Occupant,target:HomePoint,keys:readonly string[],state:ResidentialView,people:readonly Occupant[],now:number,open?:boolean){
  const door=target.door!
  if(!access(door.unit,keys))return 'Locked — private residence'
  const stamp=state.doors[door.id]??0
  const desired=open??stamp<=0
  if((stamp>0)===desired)return
  if(stamp&&now-Math.abs(stamp)<DOOR_TRAVEL)return 'Wait for the door to finish moving'
  if(!desired&&people.some(p=>Math.abs(riderHeight(p,now)-riderHeight(actor,now))<1&&near(p,target.x,target.z,.57)))
    return 'Clear the doorway before closing it'
  state.doors[door.id]=desired?now:-now
}
export function occupy(actor:Occupant,target:HomePoint,people:readonly Occupant[]){
  if(!target.pose||!target.exit||people.some(p=>p.homePose?.id===target.pose!.id&&p.zone===actor.zone))return false
  actor.homePose=target.pose
  actor.homeExit={...target.exit,yaw:target.pose.yaw}
  Object.assign(actor,{x:target.pose.x,z:target.pose.z,yaw:target.pose.yaw})
  return true
}
export function stand(actor:Occupant){
  if(!actor.homePose||!actor.homeExit)return false
  Object.assign(actor,actor.homeExit)
  delete actor.homePose;delete actor.homeExit
  return true
}
export function callResidentialLift(actor:Occupant,state:ResidentialView,people:readonly Occupant[],now:number){
  const a=residentialAt(actor.zone)
  if(!a?.building.lift||a.stairs)return 'Visit the elevator first'
  const lift=state.lifts[a.building.id]??={level:0,opened:0}
  if(lift.to!==undefined)return 'Elevator is on its way'
  if(lift.level===a.level)return
  const source=homeZone(a.building.id,lift.level)
  if(people.some(p=>p.zone===source&&aboard(source,p.x,p.z)))return 'Elevator is occupied'
  Object.assign(lift,{to:a.level,started:now+420,ends:now+1200+Math.abs(lift.level-a.level)*310})
}
export function residentialRide(actor:Occupant,to:number,state:ResidentialView,people:readonly Occupant[],now:number){
  const a=residentialAt(actor.zone)
  if(!a?.building.lift||!Number.isInteger(to)||!a.building.levels[to]||!aboard(actor.zone,actor.x,actor.z))return 'Step inside the elevator first'
  const lift=state.lifts[a.building.id]??={level:0,opened:0}
  if(!openLift(lift,a.level,now))return 'Wait for the elevator to arrive'
  if(to===a.level)return
  const started=now+420,ends=started+780+Math.abs(to-a.level)*310
  Object.assign(lift,{to,started,ends})
  const target=homeZone(a.building.id,to),exit=residentialSite(a.building,a.building.lift.x,1.73)
  for(const p of people)if(p.zone===actor.zone&&aboard(p.zone,p.x,p.z)){
    p.lift={to:target,started,ends};p.yaw=Math.atan2(p.x-exit.x,p.z-exit.z)
  }
}
export function settleResidentialLifts(state:ResidentialView,people:readonly Occupant[],now:number){
  for(const lift of Object.values(state.lifts))if(lift.to!==undefined&&now>=lift.ends!+220){
    lift.level=lift.to;lift.opened=lift.ends!+220
    delete lift.to;delete lift.started;delete lift.ends
  }
  for(const actor of people)if(actor.lift&&residentialAt(actor.lift.to)&&now>=actor.lift.ends){
    actor.zone=actor.lift.to;actor.lift=undefined
  }
}
