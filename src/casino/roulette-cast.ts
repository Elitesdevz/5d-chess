import * as T from 'three'
import {Arm} from './scene/rig.ts'
import {materials,type Materials} from './scene/materials.ts'
import {box,mesh,limb,v} from './scene/geometry.ts'
/** Jointed, clothed club guests. Shared articulated hands with the first-person player. */
export class ClubGuest{
 readonly root=new T.Group();readonly left:Arm;readonly right:Arm;readonly head=new T.Group();private blink:T.Mesh[]=[];private restY=1.64;private baseZ:number
 constructor(scene:T.Scene,x:number,z:number,skin:number,suit:number,private dealer=false,style=0){
  this.baseZ=z;scene.add(this.root);this.root.position.set(x,0,z);this.root.rotation.y=dealer?0:-Math.atan2(x,3.5)
  const m=materials();m.skin.color.setHex(skin);m.sleeve.color.setHex(suit);m.shirt.color.setHex(0xeee6d4);m.robe.color.setHex(suit);m.glove.color.setHex(skin)
  const cloth=m.sleeve,face=m.skin
  box(this.root,[.46,.52,.27],[0,1.08,0],cloth,.075);box(this.root,[.34,.16,.26],[0,.75,0],m.trousers,.055)
  for(const side of[-1,1]){
   const lapel=box(this.root,[.115,.34,.035],[side*.105,1.16,.147],dealer?m.ebony:m.sleeve,.008);lapel.rotation.z=side*.25
   const collar=box(this.root,[.10,.09,.03],[side*.055,1.35,.16],m.shirt,.008);collar.rotation.z=side*.35
   if(!dealer){limb(this.root,v(side*.13,.73,0),v(side*.15,.5,.28),.09,m.trousers);limb(this.root,v(side*.15,.5,.28),v(side*.16,.12,.28),.065,m.trousers);box(this.root,[.15,.09,.28],[side*.16,.07,.35],m.leather,.03)}
   else{limb(this.root,v(side*.12,.73,0),v(side*.13,.12,0),.075,m.trousers);box(this.root,[.15,.09,.28],[side*.13,.07,.07],m.leather,.025)}
  }
  box(this.root,[.17,.36,.027],[0,1.16,.158],m.shirt,.01)
  const tie=box(this.root,[.04,.24,.025],[0,1.19,.19],dealer?m.darkGold:m.ink,.005);tie.rotation.z=style?.06:0
  for(let i=0;i<4;i++)mesh(new T.SphereGeometry(.009,8,6),m.gold,this.root,[.05,1.04+i*.066,.183])
  const neck=mesh(new T.CylinderGeometry(.062,.075,.11,16),face,this.root,[0,1.40,0]);this.head.position.set(0,this.restY,0);this.root.add(this.head)
  const skull=mesh(new T.SphereGeometry(1,28,22),face,this.head);skull.scale.set(.145,.195,.14)
  for(const side of[-1,1]){
   const ear=mesh(new T.SphereGeometry(.034,12,10),face,this.head,[side*.144,-.013,0]);ear.scale.set(.5,1,.65)
   const white=mesh(new T.SphereGeometry(1,14,10),m.shirt,this.head,[side*.054,.031,.123]);white.scale.set(.033,.014,.012);this.blink.push(white)
   const iris=mesh(new T.SphereGeometry(.010,12,8),m.ink,this.head,[side*.054,.03,.135]);this.blink.push(iris)
   const brow=box(this.head,[.058,.012,.014],[side*.055,.064,.124],m.leather,.003);brow.rotation.z=side*.09
  }
  const nose=mesh(new T.SphereGeometry(1,14,12),face,this.head,[0,.002,.144]);nose.scale.set(.027,.046,.035)
  const mouth=box(this.head,[.062,.007,.009],[0,-.075,.128],new T.MeshStandardMaterial({color:0x80554d,roughness:.9}),.003)
  const hair=mesh(new T.SphereGeometry(1,26,16,0,Math.PI*2,0,Math.PI*.48),new T.MeshStandardMaterial({color:style===1?0x342620:style===2?0x9e8b71:0x252524,roughness:.9}),this.head,[0,.035,-.016]);hair.scale.set(.151,.181,.145);hair.rotation.x=-.12
  if(style===1){for(const side of[-1,1]){const glasses=mesh(new T.TorusGeometry(.039,.003,6,20),m.darkGold,this.head,[side*.056,.032,.143]);glasses.scale.y=.66}box(this.head,[.035,.004,.006],[0,.032,.145],m.darkGold,.001)}
  if(dealer){box(this.root,[.105,.045,.012],[.13,1.22,.165],m.brass,.005);for(const side of[-1,1]){const bow=box(this.root,[.065,.035,.03],[side*.035,1.32,.193],m.ebony,.008);bow.rotation.z=side*.2}}
  this.left=new Arm(this.root,m,true);this.right=new Arm(this.root,m,false)
  if(!dealer){box(this.root,[.54,.12,.50],[0,.65,-.04],m.leather,.05);box(this.root,[.54,.62,.1],[0,.99,-.26],m.leather,.06);for(const side of[-1,1])limb(this.root,v(side*.23,.6,-.2),v(side*.26,.04,-.22),.022,m.brass)}
 }
 pose(now:number,lean=0,left=v(-.25,1.04,.27),right=v(.25,1.04,.27),curl=.18,world=false){
  this.root.position.z=this.baseZ+(this.dealer?lean*.43:0);this.root.updateMatrixWorld(true)
  if(world){left=this.root.worldToLocal(left.clone());right=this.root.worldToLocal(right.clone())}
  this.head.position.y=this.restY+Math.sin(now*.0013)*.003;this.head.rotation.y=Math.sin(now*.0004)*.045;this.head.rotation.x=.025+lean*.09
  const blink=Math.sin(now*.00025)> .994?.08:1;this.blink.forEach((eye,i)=>eye.scale.y=(i%2?1:.014)*blink)
  this.left.pose(v(-.23,1.30,lean*.23),left,v(-.6,1,0),curl);this.right.pose(v(.23,1.30,lean*.23),right,v(.6,1,0),curl)
 }
}
