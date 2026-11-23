import * as T from 'three'
import {box,cylinder,mesh} from '../casino/scene/geometry.ts'
import {SUPPLIES,GRILLS,type RestaurantView} from './restaurant-model.ts'
import {site} from './model.ts'

export function kitchenTools(scene:T.Scene){
  const group=new T.Group();scene.add(group)
  const steel=new T.MeshStandardMaterial({color:0xb9bab3,metalness:.75,roughness:.31})
  const wood=new T.MeshStandardMaterial({color:0x6c3435})
  const cream=new T.MeshStandardMaterial({color:0xffecca})
  const fries=new T.MeshStandardMaterial({color:0xffc364})
  const dark=new T.MeshStandardMaterial({color:0x3e231c})
  const spatula=new T.Group(),scoop=new T.Group(),cup=new T.Group(),stream=new T.Group()
  group.add(spatula,scoop,cup,stream)
  box(spatula,[.097,.012,.135],[0,0,-.055],steel,.008)
  box(spatula,[.024,.021,.215],[0,.025,.098],steel,.005)
  box(spatula,[.043,.042,.104],[0,.033,.185],wood,.013)
  box(scoop,[.12,.038,.115],[0,0,-.04],steel,.009)
  for(let i=0;i<5;i++)box(scoop,[.015,.018,.059],[(i-2)*.018,.027,-.031+(i%2)*.027],fries,.005)
  box(scoop,[.032,.025,.205],[0,.025,.093],wood,.008)
  mesh(new T.CylinderGeometry(.042,.032,.108,14),cream,cup,[0,.053,0])
  cylinder(cup,.036,.008,[0,.108,0],dark,16)
  cylinder(stream,.004,.16,[0,0,0],dark,7)
  group.visible=false
  const aim=(point:string,view:RestaurantView)=>{
    const fryer=point.endsWith(':fryer'),soda=point.endsWith(':soda')
    const p=fryer?site('kfc',2.99,SUPPLIES.fryer.z):soda?site('kfc',2.94,SUPPLIES.soda.z):site('kfc',GRILLS[view.shift!.slot]-.17,-6.47)
    return {p,fryer,soda}
  }
  const show=(point:string|undefined,view:RestaurantView|undefined,x:number,y:number,filling:boolean)=>{
    group.visible=!!point&&!!view?.shift&&!!view.kitchen
    if(!group.visible)return
    const {p,fryer,soda}=aim(point!,view!)
    group.position.set(p.x,1.16,p.z)
    group.rotation.y=fryer||soda?-Math.PI/2:0
    spatula.visible=!fryer&&!soda;scoop.visible=fryer;cup.visible=soda;stream.visible=soda&&filling
    spatula.position.set(x*.34,Math.max(0,y)*.23,.10+Math.min(0,y)*.1)
    spatula.rotation.z=-x*.42;spatula.rotation.x=y*.77
    scoop.position.set(x*.43,.04+y*.24,.10)
    scoop.rotation.z=-x*.55
    cup.position.set(x*.26,-.07+y*.19,.13)
    stream.position.set(cup.position.x,cup.position.y+.18,cup.position.z)
  }
  return {aim,show}
}
