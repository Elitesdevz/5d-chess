import * as T from 'three'
import {passages,CAVE_MOUTH,CAVE_X,OASIS_X,TERRAIN_EXTENT,TERRAIN_STEP,VALLEY_TREES,trailDistance,terrainVertex,terrainHeight,ridgeDistance} from './terrain.ts'

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
    const material=new T.MeshStandardMaterial({roughness:.81,flatShading:true,map:grain()}),color=new T.Color()
    for(const [shape,parts] of this.parts){
      const mesh=new T.InstancedMesh(shapes[shape],material,parts.length)
      parts.forEach((v,i)=>{mesh.setMatrixAt(i,v.matrix);mesh.setColorAt(i,color.setHex(v.color))})
      mesh.computeBoundingSphere();parent.add(mesh)
    }
  }
}
let surface:T.CanvasTexture|undefined
function grain(){
  if(surface)return surface
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128
  const ctx=canvas.getContext('2d')!,pixels=ctx.createImageData(128,128)
  for(let i=0;i<128*128;i++){
    const x=i%128,y=Math.floor(i/128),j=i*4
    const value=239+7*Math.cos(x*.28+2*Math.sin(y*.19))+6*Math.cos(y*.79+x*.65)+3*Math.sin(i*142.73)
    pixels.data[j]=pixels.data[j+1]=pixels.data[j+2]=value;pixels.data[j+3]=255
  }
  ctx.putImageData(pixels,0,0)
  surface=new T.CanvasTexture(canvas);surface.colorSpace=T.SRGBColorSpace
  surface.wrapS=surface.wrapT=T.RepeatWrapping
  return surface
}
function meadow(scene:T.Scene){
  const pos=[],col=[],idx=[],uv=[],color=new T.Color(),snow=new T.Color(0xa5a394),grass=new T.Color(0xa5ad75)
  const extent=TERRAIN_EXTENT,step=TERRAIN_STEP,side=2*extent/step+1
  for(let j=0;j<side;j++)for(let i=0;i<side;i++){
    const x=i*step-extent,z=j*step-extent,h=terrainVertex(x,z),ridge=ridgeDistance(x,z)
    const grain=.5+.5*Math.sin(x*.33+z*.22)*Math.cos(z*.21)
    const slope=Math.hypot(terrainVertex(x+1,z)-terrainVertex(x-1,z),terrainVertex(x,z+1)-terrainVertex(x,z-1))*.5
    color.setHex(h>41+3*Math.sin(z*.14)?0xdadccc:slope>.88?0x847f78:ridge>2?0x718064:0x7e965f)
    color.lerp(h>18?snow:grass,grain*.29)
    if(trailDistance(x,z)<1.9)color.setHex(0xbeab87)
    uv.push(x/3.5,z/3.5);pos.push(x,h-.085,z);col.push(color.r,color.g,color.b)
    if(i<side-1&&j<side-1&&!passages.some(p=>Math.abs(x+1-p.x)<4&&z>=p.z&&z<p.z+16)){const a=j*side+i;idx.push(a,a+side+1,a+1,a,a+side,a+side+1)}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('color',new T.Float32BufferAttribute(col,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals()
  scene.add(new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:1,map:grain()})))
}
export function landscape(scene:T.Scene){
  meadow(scene)
  const woods=new Scenery()
  let seed=41471
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
  for(let i=0;i<4800;i++){
    const x=(random()-.5)*244,z=(random()-.5)*240,h=terrainHeight(x,z)
    if(Math.abs(x)<79&&Math.abs(z)<52||passages.some(p=>Math.abs(x-p.x)<6&&z>p.z-4&&z<p.z+20)||trailDistance(x,z)<2||ridgeDistance(x,z)>8)continue
      woods.add('pine',x,h+.15,z,.21,.43,.17,0x738753,i,.20)
      if(i%3===0)woods.add('stone',x+.08,h+.28,z,.15,.12,.14,i%2?0xf2d495:0xb39abb)
      if(i%23===0)woods.add('stone',x,h+.3,z,1.7,1.1,1.2,0x89897c,i)
  }
  for(const {x,z,size} of VALLEY_TREES){
    const h=terrainHeight(x,z)
    woods.add('post',x,h+size*.28,z,.24,size*.56,.24,0x584635)
    for(let n=0;n<3;n++)woods.add('pine',x,h+size*(.45+n*.21),z,size*(.67-.16*n),size*.64,size*(.67-.16*n),[0x385a49,0x497054,0x63815b][n],x)
  }
  // A mill and hayfields mark the transition from the last street to the basin.
  const mill=new T.Group();mill.position.set(-18,terrainHeight(-18,55),55);scene.add(mill)
  const millwork=new Scenery()
  millwork.add('post',0,2.25,0,3.1,4.5,3.1,0xe1cb9e)
  millwork.add('pine',0,5.1,0,3.9,1.7,3.9,0x715148)
  millwork.add('box',0,.92,1.48,.83,1.84,.14,0x51423c)
  mill.rotation.y=Math.PI*.78
  for(let level=0;level<7;level++)millwork.add('post',0,.37+level*.58,0,3.14,.07,3.14,0xbca888)
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3,x=Math.sin(a),z=Math.cos(a)
    millwork.add('box',1.51*x,2.83,1.51*z,.57,.89,.10,0x56676b,a)
    millwork.add('box',1.58*x,2.82,1.58*z,.051,.83,.10,0xd1b78a,a)
    millwork.add('box',1.58*x,2.80,1.58*z,.53,.056,.10,0xd1b78a,a)
  }
  millwork.add('post',0,2.22,0,3.76,.15,3.76,0x765e45)
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6,mid=a+Math.PI/12
    millwork.add('post',1.78*Math.cos(a),2.48,1.78*Math.sin(a),.08,.54,.08,0x8f7454)
    millwork.add('box',1.73*Math.cos(mid),2.74,1.73*Math.sin(mid),.97,.07,.1,0xa9906a,Math.PI/2-mid)
  }
  millwork.finish(mill)
  const rotor=new T.Group();rotor.position.set(0,3.8,1.71);mill.add(rotor)
  for(let i=0;i<4;i++){
    const blade=new T.Group();blade.rotation.z=i*Math.PI/2;rotor.add(blade)
    const slats=new Scenery();slats.add('box',0,1.54,0,.082,3.2,.12,0x594b3e)
    for(let j=0;j<7;j++)slats.add('box',.25,.82+j*.31,0,.62,.19,.065,0xdccda7)
    slats.finish(blade)
  }
  for(let i=0;i<9;i++){
    const x=-18+(i%3)*1.27,z=59+Math.floor(i/3)*.85
    woods.add('post',x,.47,z,1.08,.92,1.08,0xc6a360)
    woods.add('post',x,.68,z,1.09,.069,1.09,0x96794b)
  }
  // Barn, threshing yard, split-rail fence and parallel planted furrows.
  woods.add('box',-28,1.39,55,5.1,2.77,7,0x985949)
  woods.add('gable',-28,3.33,55,5.59,1.33,7.45,0x555f62)
  woods.add('box',-28,1.14,51.45,2.5,2.28,.1,0x564536)
  for(const side of [-1,1])woods.add('box',-28+side*.61,1.09,51.36,.08,2.3,.08,0xdbbc86,0,side*.48)
  for(let n=0;n<=8;n++){
    woods.add('post',-13+n*2,.55,51,.16,1.1,.16,0x866743)
    if(n<8)for(const y of [.42,.86])woods.add('box',-12+n*2,y,51,2,.11,.12,0xab916b)
  }
  for(let row=0;row<12;row++){
    const x=-12.5+row*1.22
    woods.add('box',x,.015,55.8,.97,.1,8,0x886a48)
    for(let j=0;j<18;j++){
      const z=52+j*.43
      woods.add('post',x,.37,z,.07,.71,.07,0xa5a25a)
      woods.add('crown',x,.78,z,.19,.42,.16,0xd5b45e,0,.12)
    }
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
