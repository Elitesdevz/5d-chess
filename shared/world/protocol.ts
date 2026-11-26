import type {WorldView} from '../../src/world/model.ts'

export const CITY_PROTOCOL=1
export type Input=Record<string,unknown>
type Path=(number|string)[]
type Change=[Path,unknown?]
export interface Frame {now:number;full?:WorldView;changes?:Change[];seq:number;input:number;tickMs:number}
export type Message={type:'hello';epoch:string;protocol:number}|{type:'frame';frame:Frame}|{type:'ack';id:number;status:number;message?:string}
export type ClientMessage={type:'move';seq:number;input:Input}|{type:'command';id:number;epoch:string;action:string;data:Input;seq:number;input:Input}|{type:'sleep';hidden:boolean}

// Ordered WebSocket delivery makes each delta relative to the preceding sent frame.
// An omitted tuple value removes an object property. Array length changes replace the array.
function changes(before:any,after:any,path:Path,out:Change[]){
  if(before===after)return
  if(before&&after&&typeof before==='object'&&typeof after==='object'&&Array.isArray(before)===Array.isArray(after)){
    if(Array.isArray(after)&&before.length!==after.length){out.push([path,after]);return}
    for(const key of Object.keys(before))if(!Object.hasOwn(after,key))out.push([[...path,key]])
    for(const key of Object.keys(after)){
      if(before[key]!==after[key])changes(before[key],after[key],[...path,Array.isArray(after)?Number(key):key],out)
    }
  }else out.push([path,after])
}
export class SnapshotWriter {
  private previous?:WorldView
  private seq=0
  frame(view:WorldView,input=0,tickMs=0):Frame{
    // Several gameplay services expose live objects. Retain an owned wire snapshot.
    const current=JSON.parse(JSON.stringify(view)) as WorldView
    const frame:Frame={now:view.now,input,tickMs,seq:++this.seq}
    if(!this.previous||this.previous.id!==current.id||Boolean(current.arcade?.custody)!==Boolean(this.previous.arcade?.custody))frame.full=current
    else{
      const patch:Change[]=[]
      changes(this.previous,current,[],patch)
      frame.changes=patch
    }
    this.previous=current
    return frame
  }
}
export function applyFrame(previous:WorldView|undefined,frame:Frame):WorldView{
  if(frame.full)return frame.full
  if(!previous||!frame.changes)throw Error('Missing city snapshot')
  // Copy only changed branches. The renderer still owns the preceding view.
  const root={...previous},copies=new WeakSet<object>([root])
  for(const [path,value] of frame.changes){
    let obj:any=root
    for(const key of path.slice(0,-1)){
      const child=obj[key]
      if(!copies.has(child)){obj[key]=Array.isArray(child)?[...child]:{...child};copies.add(obj[key])}
      obj=obj[key]
    }
    const key=path[path.length-1]
    if(value===undefined)delete obj[key];else obj[key]=value
  }
  return root
}
