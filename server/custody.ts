import {randomInt} from 'node:crypto'
import {alias,CELL_COUNT,cellPosition,JAIL_MINUTES,PUZZLE_SIZE,type CustodyView} from '../src/world/arcade.ts'
import type {ChessStore,UnitOfWork} from './storage.ts'
import {pack} from './city-inventory.ts'
import {fail} from './http.ts'

type Booking=CustodyView&{user:string;avatar:string}
export type Puzzle={tiles:number[];placed:boolean[]}
const KEY='meridianBookings'
export function roster(store:ChessStore,now:number):Booking[]{
  const list=(store.metadataValue(KEY)??[]) as Booking[]
  return list.filter(b=>b.ends===null||b.ends>now)
}
export function custodyView(b:Booking):CustodyView{
  const {cell,name,ends,noRelease,x,z,yaw}=b
  return {cell,name,ends,noRelease,x,z,yaw}
}
export function book(tx:UnitOfWork,user:string,stars:number,now:number,permanent=false,noRelease=false){
  const account=tx.users.get(user)??fail(404,'Player not found')
  const list=(tx.metadata<Booking[]>(KEY)??[]).filter(b=>b.ends===null||b.ends>now)
  let b=list.find(b=>b.user===user)
  if(b&&!permanent)return b
  if(!b){
    const cell=Array.from({length:CELL_COUNT},(_,i)=>i+1).find(n=>!list.some(b=>b.cell===n))
    if(!cell)return
    b={user,cell,name:alias(cell),avatar:account.wallet?.loadout.icon??'default',ends:null,noRelease:false,...cellPosition(cell)}
    list.push(b)
  }
  if(!permanent&&(!Number.isInteger(stars)||stars<1||stars>5))fail(400,'Invalid wanted level')
  b.ends=permanent?null:now+JAIL_MINUTES[stars]*60000;b.noRelease=noRelease
  tx.putMetadata(KEY,list)
  const p=pack(account);p.stars=0;p.remaining=0
  if(account.cave)account.cave.active=false
  if(permanent&&!account.cellPuzzle){
    const tiles=Array.from({length:PUZZLE_SIZE},(_,i)=>i)
    for(let i=tiles.length-1;i>0;i--){const j=randomInt(i+1);[tiles[i],tiles[j]]=[tiles[j],tiles[i]]}
    account.cellPuzzle={tiles,placed:Array(PUZZLE_SIZE).fill(false)}
  }
  return b
}
export function release(tx:UnitOfWork,user:string){
  const list=tx.metadata<Booking[]>(KEY)??[]
  tx.putMetadata(KEY,list.filter(b=>b.user!==user))
  const a=tx.users.get(user)
  if(a)delete a.cellPuzzle
}
export function cellMove(tx:UnitOfWork,b:Booking,x:unknown,z:unknown,yaw:unknown){
  if(typeof x!=='number'||typeof z!=='number'||typeof yaw!=='number'||![x,z,yaw].every(Number.isFinite))return
  const center=cellPosition(b.cell)
  const list=tx.metadata<Booking[]>(KEY)??[],entry=list.find(e=>e.user===b.user&&e.cell===b.cell)
  if(!entry)return
  const point={x:Math.max(center.x-1.55,Math.min(center.x+1.55,x)),z:Math.max(center.z-1.2,Math.min(center.z+1.2,z)),yaw}
  if(entry.x===point.x&&entry.z===point.z&&entry.yaw===yaw)return
  Object.assign(entry,point)
  Object.assign(b,entry)
  tx.putMetadata(KEY,list)
}
export function puzzleAction(tx:UnitOfWork,b:Booking,data?:Record<string,unknown>){
  const current=tx.metadata<Booking[]>(KEY)?.find(entry=>entry.user===b.user&&entry.cell===b.cell)
  const puzzle=tx.users.get(b.user)?.cellPuzzle
  if(!current||current.ends!==null||!puzzle)fail(403,'The puzzle table is reserved for permanent custody')
  if(data){
    const {piece,target}=data
    if(typeof piece!=='number'||!Number.isInteger(piece)||piece<0||piece>=PUZZLE_SIZE||puzzle.tiles[piece]!==target)fail(409,'That piece does not fit there')
    puzzle.placed[piece]=true
    if(!current.noRelease&&puzzle.placed.every(Boolean)){release(tx,b.user);return {released:true}}
  }
  return {puzzle}
}
// Project only identity-bearing fields. Board coordinates, move colors, item IDs,
// and game codes must still work when a player happens to share their spelling.
const identities=new Set(['user','name','owner','holder','seller','buyer','buy','sell','account','opponents','customer','worker','carrier','playerName','voter','byName','leader'])
const prose=new Set(['title','detail','endReason','bio','text','label','activity','description'])
export function publicView(value:unknown,bookings:Booking[]):unknown{
  if(!bookings.length)return value
  const names=new Map(bookings.map(b=>[b.user,b.name]))
  const escaped=[...names.keys()].sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')
  const pattern=new RegExp('(?<![\\\\p{L}\\\\p{N}_])(?:'+escaped+')(?![\\\\p{L}\\\\p{N}_])','gu')
  function visit(v:unknown,key:string):unknown{
    if(typeof v==='string'){
      if(identities.has(key)||key==='seats')return names.get(v)??v
      if(prose.has(key))return v.replace(pattern,s=>names.get(s)!)
      return v
    }
    if(Array.isArray(v))return v.map(entry=>visit(entry,key))
    if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,item])=>[k,visit(item,key==='seats'?'seats':k)]))
    return v
  }
  return visit(value,'')
}

