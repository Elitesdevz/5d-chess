import * as T from 'three'
import {Scenery} from './landscape.ts'
import {OFFICES} from './housing.ts'

export function district(scene:T.Scene){
  const props=new Scenery()
  const brick=0xaa795e,stone=0xc8bb9e,steel=0x435965,glass=0x729ca5
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:number)=>props.add('box',x,y,z,w,h,d,c)
  for(const [i,o] of OFFICES.entries()){
    const {x,z,w,d,h}=o
    box(x,h/2,z,w,h,d,[steel,0x516b6a,brick,0x646775][i])
    box(x,h+.43,z,w*.82,.85,d*.86,steel)
    for(let y=2;y<h-1;y+=2.65){
      for(const side of [-1,1]){
        for(let k=-1;k<=1;k++)box(x+k*w*.29,y,z+side*d*.503,w*.23,1.54,.08,glass)
        for(let k=-2;k<=2;k++)box(x+side*w*.505,y,z+k*d*.18,.09,1.55,d*.13,glass)
      }
      box(x,y-1,z,w+.26,.17,d+.25,stone)
    }
    box(x+w/2+.47,2.35,z,1.13,.19,3.75,steel)
    box(x+w/2+.07,1.12,z,.16,2.24,2.84,steel)
    for(const dz of [-.62,.62])box(x+w/2+.18,1.14,z+dz,.07,2.05,1.12,glass)
  }
  props.finish(scene)
}
