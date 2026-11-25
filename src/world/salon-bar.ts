import * as T from 'three'
import {box,cylinder,mesh} from '../casino/scene/geometry.ts'
import {casinoStaff} from './service-staff.ts'
import {CityGuest} from './guest.ts'
import {batchStatic} from '../casino/scene/static-batch.ts'
import {BAR, BAR_COUNTER, BAR_STOOLS,DRINKS,type BarService} from './bar-menu.ts'

export function salonBar(room:T.Object3D){
  const bar=new T.Group();room.add(bar)
  const m=(color:number,metalness=0)=>new T.MeshStandardMaterial({color,metalness,roughness:.42})
  const brass=m(0xa58653,.62),wood=m(0x382627),red=m(0x6d3d4a),tile=m(0x294243),lamp=new T.MeshBasicMaterial({color:0xffd58d})
  const glass=new T.MeshStandardMaterial({color:0xe1e8d4,transparent:true,opacity:.42,roughness:.19,depthWrite:false})
  const bottles=[m(0x8a5440),m(0x526852),m(0x547477),m(0x75474c)]
  const {x,z}=BAR_COUNTER
  box(bar,[7.1,.91,.73],[x,.47,z],wood,.055);box(bar,[7.24,.095,.92],[x,.979,z],brass,.035)
  for(let i=-10;i<=10;i++)box(bar,[.045,.68,.07],[x+i*.315,.51,z-.37],brass,.009)
  box(bar,[7.21,2.8,.19],[x,1.53,8.68],tile,.05)
  for(const y of [1.22,1.76,2.30]){
    box(bar,[6.77,.06,.43],[x,y,8.42],brass,.022)
    box(bar,[6.55,.026,.08],[x,y+.14,8.31],lamp,.01)
    for(let i=-8;i<=8;i++){
      const h=.18+(i*i%5)*.022,u=x+i*.35
      cylinder(bar,.069,h,[u,y+h/2+.03,8.45],bottles[(i+8)%4],10)
      cylinder(bar,.033,.056,[u,y+h+.052,8.45],brass,10)
    }
  }
  for(const s of BAR_STOOLS){
    cylinder(bar,.22,.05,[s.x,.031,s.z],brass,16);cylinder(bar,.045,.54,[s.x,.3,s.z],brass,12)
    cylinder(bar,.24,.075,[s.x,.60,s.z],red,20)
  }
  for(const u of [-8.9,-7,-5,-3.53]){
    cylinder(bar,.028,1.07,[u,3.79,7.23],brass,14)
    mesh(new T.CylinderGeometry(.13,.28,.24,16),red,bar,[u,3.20,7.23])
    cylinder(bar,.27,.019,[u,3.07,7.23],lamp,20)
  }
  // Brass foot rail and a backlit fan of champagne flutes over the central shelf.
  const rail=cylinder(bar,.045,6.7,[x,.27,z-.63],brass,12)
  rail.rotation.z=Math.PI/2
  for(const dx of [-2.85,-1.42,0,1.42,2.85]){
    box(bar,[.055,.07,.36],[x+dx,.27,z-.49],brass,.014)
    cylinder(bar,.087,.023,[x+dx,2.49,8.23],brass,12)
    cylinder(bar,.016,.15,[x+dx,2.42,8.23],brass,12)
    mesh(new T.ConeGeometry(.083,.13,12),glass,bar,[x+dx,2.3,8.23])
  }
  for(let n=-4;n<=4;n++){
    const blade=box(bar,[.07,1.25,.05],[x+n*.24,3.06-Math.abs(n)*.052,8.51],lamp,.012)
    blade.rotation.z=-n*.16
  }
  batchStatic(bar)
  const bartender=new CityGuest(room,casinoStaff[4].x,casinoStaff[4].z,0xb47d60,0x394951,true,3)
  bartender.root.rotation.y=Math.PI*2
  const drink=new T.Group();bar.add(drink)
  mesh(new T.CylinderGeometry(.075,.059,.22,18),glass,drink,[0,.11,0])
  const liquid=cylinder(drink,.061,.13,[0,.087,0],m(0xb47742),18)
  const shaker=mesh(new T.CylinderGeometry(.056,.042,.22,12),brass,bar,[BAR.x,1.17,7.22])
  const tick=(order:BarService|undefined,now:number)=>{
    const mixing=!!order&&now<order.ready
    bartender.pose(now,mixing?.7:0)
    drink.visible=!!order&&now>=order.ready-570
    shaker.visible=mixing&&now<order!.ready-570
    shaker.position.y=1.34+Math.sin(now*.021)*.17
    shaker.rotation.z=Math.sin(now*.015)*.7
    if(order){
      (liquid.material as T.MeshStandardMaterial).color.setHex(DRINKS.find(d=>d.id===order.drink)?.color??0xb47742)
      const p=T.MathUtils.clamp((now-order.ready+570)/570,0,1)
      drink.position.set(BAR.x,1.03,7.53-.64*p)
    }
  }
  return {tick,bartender}
}
