import {riderHeight,SPRINT_SPEED,type WorldPlayer} from './model.ts'
import type {Position} from '../roulette-hall-model.ts'

const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,n))
const angle=(n:number)=>Math.atan2(Math.sin(n),Math.cos(n))
export type PlayerSample=Position&{height:number;zone:WorldPlayer['zone']}
type Snapshot={at:number;player:WorldPlayer}

function stance(p:WorldPlayer){
  if(p.lift)return 'lift:'+p.lift.started+':'+p.lift.to
  if(p.homePose)return 'home:'+p.homePose.id
  if(p.chair)return 'chair:'+p.chair.table+':'+p.chair.index
  if(p.lounge)return 'couch:'+p.lounge.couch+':'+p.lounge.index
  if(p.boardSeat!==undefined)return 'board:'+p.boardSeat
  if(p.barSeat!==undefined)return 'bar:'+p.barSeat
  return p.dining===undefined?'walking':'dining:'+p.dining
}

/** Delayed samples follow server-confirmed motion. Missing packets hold the
 * last position instead of guessing a path through doors, cars or walls. */
export class PlayerMotion {
  private snapshots:Snapshot[]=[]
  private spacing=320
  private sampledAt=-Infinity

  push(player:WorldPlayer,at:number){
    const previous=this.snapshots.at(-1)
    if(previous&&at<previous.at)return
    if(previous){
      const seconds=Math.max(.07,(at-previous.at)/1000)
      const distance=Math.hypot(player.x-previous.player.x,player.z-previous.player.z)
      const stepHeight=Math.abs(riderHeight(player,at)-riderHeight(previous.player,at))
      if(stance(player)!==stance(previous.player)||stepHeight>2.4||distance>Math.min(3,SPRINT_SPEED*seconds+.55)){
        this.snapshots.length=0
        this.sampledAt=-Infinity
      }else if(at===previous.at){
        previous.player=player
        return
      }else if(at-previous.at>=90){
        this.spacing+=.2*(clamp(at-previous.at,160,590)-this.spacing)
      }
    }
    this.snapshots.push({at,player})
    if(this.snapshots.length>7)this.snapshots.shift()
  }

  sample(now:number,out:PlayerSample){
    const latest=this.snapshots.at(-1)
    if(!latest)return
    const delay=clamp(this.spacing+38,240,560)
    this.sampledAt=Math.max(this.sampledAt,now-delay)
    let from=this.snapshots[0],to=from
    for(const snapshot of this.snapshots){
      to=snapshot
      if(snapshot.at>this.sampledAt)break
      from=snapshot
    }
    const first=from.player,last=to.player
    const t=from===to?0:clamp((this.sampledAt-from.at)/(to.at-from.at),0,1)
    out.x=first.x+(last.x-first.x)*t
    out.z=first.z+(last.z-first.z)*t
    out.yaw=first.yaw+angle(last.yaw-first.yaw)*t
    out.zone=first.zone
    // Elevator doors and cabins use current server time and must carry their
    // riders together. Walking heights follow the interpolated stair samples.
    if(latest.player.lift)out.height=riderHeight(latest.player,now)
    else{
      const low=riderHeight(first,from.at),high=riderHeight(last,to.at)
      out.height=low+(high-low)*t
    }
  }
}
