import * as T from 'three'
import {batchStatic} from './scene/static-batch.ts'
import {box,v} from './scene/geometry.ts'
import {label,type Materials} from './scene/materials.ts'
import {casinoCoins} from '../casino-model.ts'

export const CHIP_VALUES=[1,25,100,500,1000] as const
/** Furniture and denomination stacks; wagering and settlement stay in the existing controller. */
export class RouletteConsole {
 readonly root=new T.Group();readonly wallet=new T.Group();readonly wager=new T.Group()
 readonly stakePosition=v(-.38,1.045,.93);readonly returnPosition=v(.30,1.045,.93);readonly spinPosition=v(.92,1.045,.93)
 readonly chipPosition=v(-1.08,1.08,.64)
 private stakeLabel:ReturnType<typeof label>;private returnLabel:ReturnType<typeof label>
 private stackMeshes:T.Mesh[][]=[];private wagerMeshes:T.Mesh[]=[];private textures:ReturnType<typeof label>[]=[]
 private plates:T.Group[]=[];private spinGroup:T.Group;private lastStake=-1;private lastReturn=-1;private lastCoins=-1
 readonly spin:T.Mesh;readonly chipEdge:T.Mesh
 constructor(world:T.Scene,private m:Materials){
  world.add(this.root);this.wallet.position.set(-.98,1.005,.52);this.wager.position.set(-.67,1.005,.52);this.root.add(this.wallet,this.wager)
  this.chipEdge=box(this.wallet,[.82,.022,.55],[0,.008,0],m.darkGold.clone(),.04)
  box(this.wallet,[.79,.025,.52],[0,.017,0],m.ebony,.035)
  box(this.wager,[.24,.025,.36],[.18,.017,0],m.darkGold,.03)
  box(this.wager,[.22,.026,.34],[.18,.025,0],m.ebony,.025)
  for(let d=0;d<CHIP_VALUES.length;d++){
   const x=-.29+d%3*.28,z=d<3?-.12:.13,stack:T.Mesh[]=[]
   for(let i=0;i<6;i++)stack.push(this.pokerChip(this.wallet,x,.047+i*.021,z,d,i===5))
   this.stackMeshes.push(stack)
  }
  for(let i=0;i<8;i++)this.wagerMeshes.push(this.pokerChip(this.wager,.18,.054+i*.021,0,2,i===7))
  this.stakeLabel=this.plate('AMOUNT BET',this.stakePosition,.60)
  this.returnLabel=this.plate('WIN RETURN',this.returnPosition,.64)
  const spin=this.spinGroup=new T.Group();spin.position.copy(this.spinPosition);this.root.add(spin)
  box(spin,[.47,.035,.31],[0,0,0],m.darkGold.clone(),.035)
  this.spin=box(spin,[.44,.038,.28],[0,.015,0],m.ebony.clone(),.025)
  this.writing(spin,'SPIN',.39,.12,v(0,.036,-.015))
  this.writing(spin,'↻',.16,.055,v(0,.036,.078),'#a89260')
 }
 layout(portrait:boolean){
  this.wallet.position.set(portrait?-.53:-.98,1.005,portrait?.30:.52);this.wallet.scale.setScalar(portrait?.60:1)
  this.wager.position.set(portrait?-.35:-.67,1.005,portrait?.50:.52);this.wager.scale.setScalar(portrait?.60:1)
  this.plates.forEach((plate,i)=>{plate.position.set(portrait?(i===0?-.185:.185):(i===0?-.38:.30),1.045,portrait?.78:.93);plate.scale.setScalar(portrait?.55:1)})
  this.spinPosition.set(portrait?0:.92,1.045,portrait?1.09:.93);this.spinGroup.position.copy(this.spinPosition);this.spinGroup.scale.setScalar(portrait?.85:1)
 }
 private writing(parent:T.Object3D,text:string,w:number,h:number,pos:T.Vector3,color='#edcf90'){
  const inscription=label(text,512,color);this.textures.push(inscription)
  const plane=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:inscription.map,transparent:true,depthWrite:false}));plane.position.copy(pos);plane.rotation.x=-Math.PI/2;parent.add(plane);return inscription
 }
 private plate(title:string,position:T.Vector3,width:number){
  const g=new T.Group();this.plates.push(g);g.position.copy(position);g.rotation.x=.30;this.root.add(g)
  box(g,[width,.028,.28],[0,0,0],this.m.darkGold,.025)
  box(g,[width-.018,.031,.26],[0,.009,0],this.m.ebony,.02)
  this.writing(g,title,width*.84,.055,v(0,.027,-.073),'#b6a678')
  return this.writing(g,'100',width*.86,.115,v(0,.028,.023))
 }
 private pokerChip(parent:T.Group,x:number,y:number,z:number,d:number,top:boolean){
  const colors=[0xded5bb,0x548b7e,0x426e91,0xa75365,0xb98b43],body=new T.Mesh(new T.CylinderGeometry(.102,.102,.019,32),new T.MeshStandardMaterial({color:colors[d],roughness:.38,metalness:.12}));body.position.set(x,y,z);parent.add(body)
  // Ivory edge inserts and concentric inlays make denominations recognisable as real chips.
  for(let j=0;j<8;j++){const a=j*Math.PI/4;const insert=new T.Mesh(new T.BoxGeometry(.035,.020,.008),this.m.ivory);insert.position.set(Math.sin(a)*.098,0,Math.cos(a)*.098);insert.rotation.y=a;body.add(insert)}
  if(top){const ring=new T.Mesh(new T.TorusGeometry(.078,.0025,4,32),this.m.ivory);ring.rotation.x=-Math.PI/2;ring.position.y=.011;body.add(ring);this.writing(body,String(CHIP_VALUES[d]),.13,.065,v(0,.012,0),'#fff2d3')}
  batchStatic(body);return body
 }
 update(coins:number,stake:number,returns:number,busy:boolean,counts:readonly number[]){
  if(stake!==this.lastStake){this.stakeLabel.update(casinoCoins(stake));const count=Math.min(8,Math.max(1,counts.reduce((sum,n)=>sum+n,0)));this.wagerMeshes.forEach((chip,i)=>{chip.visible=i>=8-count;chip.position.y=.054+(i-(8-count))*.021});this.lastStake=stake}
  if(returns!==this.lastReturn){this.returnLabel.update(casinoCoins(returns));this.lastReturn=returns}
  if(coins!==this.lastCoins){this.stackMeshes.forEach((stack,d)=>{const count=Math.min(6,Math.max(0,Math.ceil(coins/CHIP_VALUES[d]/6)));stack.forEach((chip,i)=>{chip.visible=i>=6-count;chip.position.y=.047+(i-(6-count))*.021})});this.lastCoins=coins}
  ;(this.spin.material as T.MeshStandardMaterial).color.setHex(busy?0x080c0d:0x183d30)
 }
 highlight(on:boolean){(this.chipEdge.material as T.MeshStandardMaterial).emissive.setHex(on?0x806333:0)}
 dispose(){this.textures.forEach(t=>t.map.dispose())}
}
