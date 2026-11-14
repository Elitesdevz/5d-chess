import * as T from 'three'
import {v} from './geometry.ts'
/** One bounded sparkle draw, eight coins and a soft ring; no persistent particles. */
export class WinGold{
 private root=new T.Group();private sparks:T.Points;private coins:T.InstancedMesh;private ring:T.Mesh;private began=-Infinity;private matrix=new T.Matrix4();private rotation=new T.Quaternion()
 constructor(world:T.Scene,coin:T.BufferGeometry){
  world.add(this.root);const positions=new Float32Array(48*3),geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3))
  this.sparks=new T.Points(geometry,new T.PointsMaterial({color:0xffd87b,size:.019,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending}));this.root.add(this.sparks)
  this.coins=new T.InstancedMesh(coin,new T.MeshStandardMaterial({color:0xffce64,emissive:0xb16c12,emissiveIntensity:.45,metalness:.8,roughness:.25,transparent:true}),8);this.coins.instanceMatrix.setUsage(T.DynamicDrawUsage);this.root.add(this.coins)
  this.ring=new T.Mesh(new T.TorusGeometry(.12,.003,6,48),new T.MeshBasicMaterial({color:0xffd88a,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));this.ring.rotation.x=-Math.PI/2;this.root.add(this.ring);this.root.position.set(-.70,.95,.57);this.root.visible=false
 }
 start(now:number){this.began=now;this.root.visible=true}
 update(now:number,reduced:boolean){
  const p=(now-this.began)/(reduced?700:2900);this.root.visible=p>=0&&p<1;if(!this.root.visible)return
  const fade=Math.sin(Math.PI*Math.max(0,p))
  this.coins.visible=this.sparks.visible=!reduced;this.ring.scale.setScalar(1+p*2.5);(this.ring.material as T.MeshBasicMaterial).opacity=fade*(reduced?.32:.65)
  const positions=this.sparks.geometry.getAttribute('position') as T.BufferAttribute
  for(let i=0;i<48;i++){const a=i*2.399,delay=(i%7)*.025,q=Math.max(0,(p-delay)/(1-delay)),radius=(.07+(i%5)*.023)*Math.sin(q*Math.PI/2);positions.setXYZ(i,Math.cos(a)*radius,Math.max(0,q*(.9+(i%4)*.12)-q*q*.65),Math.sin(a)*radius)}positions.needsUpdate=true;(this.sparks.material as T.PointsMaterial).opacity=fade*.9
  for(let i=0;i<8;i++){const a=i*2.399,r=.05+p*.19;this.rotation.setFromEuler(new T.Euler(p*7+i,a+p*4,p*3));this.matrix.compose(v(Math.cos(a)*r,Math.sin(p*Math.PI)*(.20+i*.018),Math.sin(a)*r),this.rotation,v(.65,.65,.65));this.coins.setMatrixAt(i,this.matrix)}this.coins.instanceMatrix.needsUpdate=true;(this.coins.material as T.MeshStandardMaterial).opacity=fade
 }
 get active(){return this.root.visible}
}
