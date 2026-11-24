import * as T from 'three'
import {Scenery} from './landscape.ts'
import {OFFICES,RESIDENCES,UNITS,type HousingView} from './housing.ts'
import {ClubGuest} from '../casino/roulette-cast.ts'

type Letter=(g:T.Object3D,title:string,size:[number,number],position:number[],color?:string,backdrop?:string)=>T.Object3D
export function district(scene:T.Scene,letter:Letter){
  const props=new Scenery()
  const brick=0xaa795e,stone=0xc8bb9e,steel=0x435965,glass=0x729ca5,wood=0x705043
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
  const doors=new Map<string,T.Mesh>(),doorMat=new T.MeshStandardMaterial({color:wood})
  const clerks:ClubGuest[]=[]
  for(const [i,b] of RESIDENCES.entries()){
    const {x,z}=b
    box(x,.035,z,15.45,.07,10,stone)
    box(x,1.63,z-5,15.5,3.26,.19,brick)
    for(const side of [-1,1]){
      box(x+side*7.65,1.63,z,.2,3.26,10,brick)
      box(x+side*4.45,1.64,z+4.91,6.68,3.28,.18,brick)
    }
    box(x,5.87,z,15.5,5.3,10.04,i?0xa9ae98:brick)
    for(const y of [4.75,7.18])for(const side of [-1,1]){
      for(let n=-3;n<=3;n++)box(x+n*2.04,y,z+side*5.06,1.36,1.37,.13,glass)
      for(let n=-2;n<=2;n++)box(x+side*7.79,y,z+n*1.89,.12,1.31,1.1,glass)
      box(x,y-.8,z+side*5.12,15.7,.16,.32,stone)
    }
    box(x,8.62,z,15.85,.23,10.42,steel)
    letter(scene,b.name,[4,.46],[x,2.95,z+5.04],'#fff1d4','#3b4c4b')
    box(x+5.1,.54,z+3.15,2.07,1.08,.63,wood)
    clerks.push(new ClubGuest(scene,x+5.11,z+2.67,0xaa795d,steel,true))
  }
  const signs=new Map<string,T.Object3D>()
  for(const u of UNITS){
    const {x,z,width:w}=u
    if(u.block!==undefined){
      for(const side of [-1,1]){
        box(x+side*(w/4+.42),1.59,z+2.9,w/2-.84,3.18,.15,stone)
        box(x+side*w/2,1.6,z-.55,.13,3.2,7,stone)
      }
      box(x,2.72,z+2.9,1.7,.92,.16,stone)
      letter(scene,u.name.split(' · ')[1],[.67,.24],[x,2.54,z+3.01],'#fff2d4','#50483c')
      box(x-w/2+.86,.34,z-2.55,1.39,.65,2.2,wood)
      box(x-w/2+.86,.75,z-2.5,1.39,.19,1.89,[0x729388,0xbe8f72,0x778aa4][w-4])
      box(x-w/2+.86,.84,z-3.38,1.16,.18,.45,0xf0e4c9)
      box(x+w/2-.7,.84,z-.67,1.15,.1,1.72,wood)
      for(const dz of [-.66,.66])box(x+w/2-.7,.42,z-.67+dz,.55,.84,.12,steel)
      if(w>=5)box(x,.97,z-3.72,1.39,1.94,.45,wood)
      if(w===6){box(x+.2,.49,z+.75,1.73,.58,.72,0x607e70);box(x+.2,.83,z+.45,1.73,.5,.14,0x607e70)}
    }else if(u.tenure!=='resident'){
      const sx=x+1.15,sz=z+u.facing*3.65
      box(sx,.76,sz,.085,1.52,.085,wood)
      const sign=letter(scene,u.tenure==='rent'?'FOR RENT':'FOR SALE',[1.48,.5],[sx,1.45,sz+u.facing*.055],'#fff4dd',u.tenure==='rent'?'#375769':'#784e3f')
      sign.rotation.y=u.facing<0?Math.PI:0;signs.set(u.id,sign)
    }
    const door=new T.Mesh(new T.BoxGeometry(1.67,2.22,.12),doorMat)
    door.position.set(x,1.11,z+2.9*u.facing);scene.add(door);doors.set(u.id,door)
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
  return {update(h?:HousingView){
    for(const [id,d] of doors)d.visible=!h?.keys.includes(id)
    for(const [id,sign] of signs)sign.visible=!h?.occupied.includes(id)
  },tick(time:number){
    cars.forEach((car,i)=>{const t=(time/63000+i/cars.length)%1,pos=route.getPoint(t),dir=route.getTangent(t);car.position.copy(pos);car.rotation.y=Math.atan2(dir.x,dir.z)})
    clerks.forEach(actor=>actor.pose(time))
  }}
}
