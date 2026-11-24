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
  const cars=Array.from({length:6},(_,i)=>{
    const car=new T.Group(),p=new Scenery(),paint=[0x4e7477,0xb48159,0x54647c,0xaa5350,0xc4baa0,0x455854][i]
    p.add('box',0,.51,0,1.39,.52,2.97,paint)
    p.add('box',0,.97,-.12,1.20,.55,1.56,0x354c57)
    p.add('box',0,1.27,-.12,1.25,.09,1.58,paint)
    for(const side of [-1,1]){
      for(const dz of [-.91,.91])p.add('box',side*.65,.25,dz,.22,.49,.5,0x272c2f)
      p.add('box',side*.48,.58,1.49,.27,.14,.04,0xffe5b2)
      p.add('box',side*.51,.61,-1.49,.22,.13,.04,0xab4140)
    }
    p.finish(car);scene.add(car);return car
  })
  const route=new T.CurvePath<T.Vector3>(),corners=[[-61.75,12],[73.25,12],[73.25,30],[-61.75,30]]
  const point=(x:number,z:number)=>new T.Vector3(x,0,z)
  corners.forEach(([x,z],i)=>{
    const next=corners[(i+1)%4],after=corners[(i+2)%4],start=point(x,z),end=point(...next as [number,number])
    const dir=end.clone().sub(start).normalize(),out=point(...after as [number,number]).sub(end).normalize()
    route.add(new T.LineCurve3(start.addScaledVector(dir,1.7),end.clone().addScaledVector(dir,-1.7)))
    route.add(new T.QuadraticBezierCurve3(end.clone().addScaledVector(dir,-1.7),end,end.clone().addScaledVector(out,1.7)))
  })
  return {tick(time:number){
    cars.forEach((car,i)=>{const t=(time/63000+i/cars.length)%1,pos=route.getPoint(t),dir=route.getTangent(t);car.position.copy(pos);car.rotation.y=Math.atan2(dir.x,dir.z)})
  }}
}
