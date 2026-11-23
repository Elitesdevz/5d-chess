import * as T from 'three'
import {CAVE_MOUTH,CAVE_X,OASIS_X,TERRAIN_EXTENT,TERRAIN_STEP,terrainVertex,terrainHeight,ridgeDistance} from './terrain.ts'

const profile=new T.Shape()
profile.moveTo(-.5,-.5);profile.lineTo(.5,-.5);profile.lineTo(0,.5);profile.closePath()
const shapes={
  gable:new T.ExtrudeGeometry(profile,{depth:1,bevelEnabled:false}).translate(0,0,-.5),
  box:new T.BoxGeometry(1,1,1),stone:new T.IcosahedronGeometry(.5,0),
  crown:new T.IcosahedronGeometry(.5,1),pine:new T.ConeGeometry(.5,1,8),post:new T.CylinderGeometry(.5,.5,1,12),
}
type Shape=keyof typeof shapes
/** Bake repeated props into one instanced draw per shape, retaining individual paint colors. */
export class Scenery{
  private parts=new Map<Shape,{matrix:T.Matrix4;color:number}[]>()
  private transform=new T.Object3D()
  add(shape:Shape,x:number,y:number,z:number,w:number,h:number,d:number,color:number,yaw=0,roll=0){
    const t=this.transform;t.position.set(x,y,z);t.scale.set(w,h,d);t.rotation.set(0,yaw,roll,'YXZ');t.updateMatrix()
    let parts=this.parts.get(shape)
    if(!parts){parts=[];this.parts.set(shape,parts)}
    parts.push({matrix:t.matrix.clone(),color})
  }
  finish(parent:T.Object3D){
    const material=new T.MeshStandardMaterial({roughness:.81,flatShading:true}),color=new T.Color()
    for(const [shape,parts] of this.parts){
      const mesh=new T.InstancedMesh(shapes[shape],material,parts.length)
      parts.forEach((v,i)=>{mesh.setMatrixAt(i,v.matrix);mesh.setColorAt(i,color.setHex(v.color))})
      mesh.computeBoundingSphere();parent.add(mesh)
    }
  }
}
function trail(x:number,z:number){
  const toCave=Math.abs(Math.abs(x)-(16+24*Math.min(1,Math.max(0,(z-36)/37))+2*Math.sin(z*.16)))
  return z>32&&z<CAVE_MOUTH+1?toCave:100
}
function meadow(scene:T.Scene){
  const pos=[],col=[],idx=[],color=new T.Color()
  const extent=TERRAIN_EXTENT,step=TERRAIN_STEP,side=2*extent/step+1
  for(let j=0;j<side;j++)for(let i=0;i<side;i++){
    const x=i*step-extent,z=j*step-extent,h=terrainVertex(x,z),ridge=ridgeDistance(x,z)
    const grain=.5+.5*Math.sin(x*.33+z*.22)*Math.cos(z*.21)
    const slope=Math.hypot(terrainVertex(x+1,z)-terrainVertex(x-1,z),terrainVertex(x,z+1)-terrainVertex(x,z-1))*.5
    color.setHex(h>33+4*Math.sin(z*.21)?0xdadccc:slope>.88?0x877f74:ridge>2?0x718064:0x7e965f)
    color.lerp(new T.Color(h>18?0xa5a394:0xa5ad75),grain*.29)
    if(trail(x,z)<1.9)color.setHex(0xbeab87)
    pos.push(x,h-.085,z);col.push(color.r,color.g,color.b)
    if(i<side-1&&j<side-1){const a=j*side+i;idx.push(a,a+side+1,a+1,a,a+side,a+side+1)}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('color',new T.Float32BufferAttribute(col,3));geo.setIndex(idx);geo.computeVertexNormals()
  scene.add(new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:1})))
}
export function landscape(scene:T.Scene){
  meadow(scene)
  const woods=new Scenery()
  let seed=41471
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
  for(let i=0;i<4800;i++){
    const x=(random()-.5)*244,z=(random()-.5)*240,h=terrainHeight(x,z)
    if(Math.abs(x)<63&&Math.abs(z)<48||Math.abs(Math.abs(x)-40)<6&&z>68&&z<94||trail(x,z)<2||ridgeDistance(x,z)>8)continue
    if(i%8===0){
      const size=2.2+random()*3.1
      woods.add('post',x,h+size*.28,z,.22,size*.56,.22,0x584635)
      for(let n=0;n<3;n++)woods.add('pine',x,h+size*(.45+n*.21),z,size*(.67-.16*n),size*.64,size*(.67-.16*n),[0x385a49,0x497054,0x63815b][n],i)
    }else{
      woods.add('pine',x,h+.15,z,.21,.43,.17,0x738753,i,.20)
      if(i%3===0)woods.add('stone',x+.08,h+.28,z,.15,.12,.14,i%2?0xf2d495:0xb39abb)
      if(i%23===0)woods.add('stone',x,h+.3,z,1.7,1.1,1.2,0x89897c,i)
    }
  }
  for(const cx of [CAVE_X,OASIS_X])for(let n=0;n<48;n++){
    const side=n%2?1:-1,z=CAVE_MOUTH+1+random()*18,x=cx+side*(4.1+random()*3.8)
    woods.add('crown',x,terrainHeight(x,z)+.6,z,3.6+random()*2,4+random()*3,4.6,0x756f60,random()*6)
  }
  // A mill and hayfields mark the transition from the last street to the basin.
  const mill=new T.Group();mill.position.set(-18,terrainHeight(-18,55),55);scene.add(mill)
  const millwork=new Scenery()
  millwork.add('post',0,2.25,0,3.1,4.5,3.1,0xe1cb9e)
  millwork.add('pine',0,5.1,0,3.9,1.7,3.9,0x715148)
  millwork.add('box',0,.92,1.48,.83,1.84,.14,0x51423c)
  millwork.finish(mill)
  const rotor=new T.Group();rotor.position.set(0,3.8,1.71);mill.add(rotor)
  for(let i=0;i<4;i++){
    const blade=new T.Group();blade.rotation.z=i*Math.PI/2;rotor.add(blade)
    const slats=new Scenery();slats.add('box',0,1.54,0,.082,3.2,.12,0x594b3e)
    for(let j=0;j<7;j++)slats.add('box',.25,.82+j*.31,0,.62,.19,.065,0xdccda7)
    slats.finish(blade)
  }
  for(let i=0;i<130;i++){
    const x=-10+(i%13)*1.02,z=52+Math.floor(i/13)*.54
    woods.add('crown',x,.27,z,1.15,.69,.56,i%5?0xbfaa59:0xd1b968)
  }
  woods.finish(scene)
  const flock=new T.Group();scene.add(flock)
  const birds=new Scenery()
  for(let i=0;i<9;i++)for(const wing of [-1,1])birds.add('box',(i-4)*1.1+wing*.23,i%3*.23,Math.abs(i-4)*.7,.52,.055,.16,0x45494d,0,wing*.28)
  birds.finish(flock)
  return (time:number)=>{
    rotor.rotation.z=(time/9600)%(Math.PI*2)
    const angle=(time/37000)%(Math.PI*2)
    flock.position.set(42*Math.cos(angle),17+Math.sin(angle*3)*2,-15+30*Math.sin(angle));flock.rotation.y=-angle
  }
}
