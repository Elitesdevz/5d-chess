import type {WorldView} from '../../src/world/model.ts'

export const CITY_PROTOCOL=1
export type Input=Record<string,unknown>
// Patch arrays replace or delete values. Objects group edits under a shared parent.
type Patch=[]|[unknown]|{[key:string]:Patch}
export interface Frame {now:number;full?:WorldView;changes?:Patch;seq:number;input:number;tickMs:number;projectionMs?:number}
export type Message={type:'hello';epoch:string;protocol:number}|{type:'frame';frame:Frame}|{type:'ack';id:number;status:number;message?:string}
export type ClientMessage={type:'move';seq:number;input:Input}|{type:'command';id:number;epoch:string;action:string;data:Input;seq:number;input:Input}|{type:'sleep';hidden:boolean}

// Ordered WebSocket delivery makes each delta relative to the preceding sent frame.
function changes(before:any,after:any):Patch|undefined{
  if(before===after)return
  if(!before||!after||typeof before!=='object'||typeof after!=='object'||Array.isArray(before)!==Array.isArray(after)||
    Array.isArray(after)&&before.length!==after.length)return [after]
  let patch:{[key:string]:Patch}|undefined
  for(const key of Object.keys(before))if(!Object.hasOwn(after,key))(patch??=Object.create(null))[key]=[]
  for(const key of Object.keys(after)){
    const child=changes(before[key],after[key])
    if(child)(patch??=Object.create(null))[key]=child
  }
  return patch
}
function apply(previous:any,patch:Patch):any{
  if(Array.isArray(patch))return patch[0]
  const copy=Array.isArray(previous)?previous.slice():{...previous}
  for(const [key,child] of Object.entries(patch)){
    if(Array.isArray(child)&&!child.length)delete copy[key]
    else Object.defineProperty(copy,key,{value:apply(previous[key],child),enumerable:true,writable:true,configurable:true})
  }
  return copy
}
export class SnapshotWriter {
  private previous?:WorldView
  private seq=0
  frame(view:WorldView,input=0,tickMs=0):Frame{
    // Several gameplay services expose live objects. Retain an owned wire snapshot.
    // Civilian positions are already in the visible roster. Only targetable civilians
    // need a second entry in the reticle list. Officers and support have their own models.
    const arcade=view.arcade&&{...view.arcade,contacts:view.arcade.contacts.filter(c=>c.inSight||c.kind==='officer'||c.kind==='dog'||c.kind==='helicopter')}
    const current=JSON.parse(JSON.stringify({...view,...(arcade&&{arcade})})) as WorldView
    const frame:Frame={now:view.now,input,tickMs,seq:++this.seq}
    if(!this.previous||this.previous.id!==current.id||Boolean(current.arcade?.custody)!==Boolean(this.previous.arcade?.custody))frame.full=current
    else{
      frame.changes=changes(this.previous,current)??{}
    }
    this.previous=current
    return frame
  }
}
export function applyFrame(previous:WorldView|undefined,frame:Frame):WorldView{
  if(frame.full)return frame.full
  if(!previous||!frame.changes)throw Error('Missing city snapshot')
  return apply(previous,frame.changes) as WorldView
}
