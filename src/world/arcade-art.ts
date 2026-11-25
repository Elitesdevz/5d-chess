import * as T from 'three'
import {Scenery} from './landscape.ts'
import {cellPosition,CELL_COUNT,entrances,origins,type Contact} from './arcade.ts'
import type {Letter} from './residential-art.ts'

export function arcadeBuildings(scene:T.Scene,label:Letter){
  const props=new Scenery(20)
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:number)=>props.add('box',x,y,z,w,h,d,c)
  const stone=0x758789,trim=0xd2c6a9,blue=0x304b62,wood=0x996f47
  const shop=entrances.gunshop
  box(shop.x,1.45,shop.z-3.4,5.4,2.9,4.4,blue)
  box(shop.x,2.95,shop.z-3.4,5.7,.23,4.7,trim)
  box(shop.x,.99,shop.z-1.16,1.04,1.98,.08,0x324047)
  for(const side of [-1,1])box(shop.x+side*1.62,1.4,shop.z-1.14,1.42,1.1,.08,0x9ac8cb)
  label(scene,'ARCADE GUN SHOP',[4.5,.45],[shop.x,2.58,shop.z-1.09],'#ffe8a9','#263c51')
  const g=origins.gunshop.x,m=origins.station.x
  for(const [x,w,back,front] of [[g,8,-4.1,4.1],[m,13,-84.7,5.2]]){
    const length=front-back,mid=(back+front)/2
    box(x,-.1,mid,w,.2,length,0xb5afa1)
    box(x,1.55,back,w,3.1,.18,stone)
    for(const side of [-1,1]){
      box(x+side*w/2,1.55,mid,.18,3.1,length,stone)
      box(x+side*w*.31,1.55,front,w*.38,3.1,.18,stone)
    }
  }
  box(g,.57,-2.48,7.5,1.14,.97,wood)
  label(scene,'PULSE BLASTER  ·  25 CASH',[5,.52],[g,2.28,-3.94],'#f5db9f','#233750')
  for(const offset of [-2.2,0,2.2]){
    box(g+offset,1.65,-3.83,.78,.21,.14,0xffb45b)
    box(g+offset-.13,1.47,-3.83,.21,.28,.14,0x52657d)
  }
  box(m-3.3,.61,-1.65,4.5,1.22,1.45,wood)
  box(m+4,.61,-2.3,2.5,1.22,1.1,blue)
  label(scene,'MERIDIAN POLICE',[4.4,.48],[m-3.2,2.42,-3.96],'#f9efcf','#294152')
  label(scene,'BOOKING',[2.6,.44],[m+4,1.64,-2.42],'#f9efcf','#294152')
  for(let n=1;n<=CELL_COUNT;n++){
    const c=cellPosition(n),side=n%2?-1:1
    box(c.x,1.35,c.z-1.58,4.55,2.7,.12,stone)
    for(let j=-3;j<=3;j++)box(m+side*1.99,1.22,c.z+j*.44,.075,2.44,.075,blue)
    box(m+side*1.99,2.45,c.z,.12,.12,3.2,blue)
    box(c.x+side*1.25,.28,c.z+.42,.92,.4,1.92,wood)
    box(c.x+side*1.25,.54,c.z+.42,.94,.15,1.95,0x61819a)
    box(c.x+side*1.25,.64,c.z-.21,.78,.1,.42,trim)
    props.add('post',c.x+side*.75,.29,c.z-1.08,.5,.52,.62,0xe1e5dd)
    box(c.x+side*.75,.67,c.z-1.36,.52,.55,.19,0xe1e5dd)
    box(c.x-side*.68,.77,c.z+.99,.99,.12,.66,wood)
    box(c.x-side*.68,.36,c.z+.99,.15,.73,.17,wood)
    box(c.x-side*.68,.85,c.z+.99,.69,.035,.44,0x528582)
    const sign=label(scene,String(n).padStart(2,'0'),[.52,.3],[m+side*1.93,2.15,c.z],'#f7f1d8','#2d4350')
    sign.rotation.y=-side*Math.PI/2
  }
  props.finish(scene)
}
export function supportModel(kind:Contact['kind']|'drop'){
  const g=new T.Group(),p=new Scenery(),c=kind==='dog'?0xb38457:0x365971
  if(kind==='drop'){
    p.add('box',0,.22,0,.57,.43,.43,0xb88152)
    for(const x of [-.17,.17])p.add('box',x,.23,0,.072,.45,.45,0xe0b576)
  }else if(kind==='helicopter'){
    p.add('crown',0,0,0,1.6,1.15,2.9,c)
    p.add('box',0,.22,1.86,.25,.28,2,c)
    p.add('box',0,.93,0,4.65,.07,.19,0x30383a)
    p.add('box',0,.93,0,.19,.07,4.65,0x30383a)
  }else{
    p.add('crown',0,.48,0,.43,.54,.95,c);p.add('crown',0,.77,-.47,.37,.43,.4,c)
    for(const x of [-.14,.14])for(const z of [-.28,.28])p.add('box',x,.22,z,.11,.42,.12,c)
  }
  p.finish(g);return g
}

