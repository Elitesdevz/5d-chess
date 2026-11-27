import {shared} from './map-data.ts'
import * as T from 'three'
import {BOULEVARD_TREES,MARKET} from './terrain.ts'

export function groundShadow(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64
  const ctx=canvas.getContext('2d')!
  const shade=ctx.createRadialGradient(32,32,1,32,32,32)
  shade.addColorStop(0,'rgba(41,31,23,.47)');shade.addColorStop(.55,'rgba(41,31,23,.32)');shade.addColorStop(1,'rgba(41,31,23,0)')
  ctx.fillStyle=shade;ctx.fillRect(0,0,64,64)
  return new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1})
}
/** Ground contact and eave shade baked once for the mobile renderer. */
export function contactShade(scene:T.Scene){
  const mat=groundShadow()
  const t=new T.Object3D(),stamps:T.Matrix4[]=[]
  const stamp=(x:number,y:number,z:number,w:number,d:number)=>{
    t.position.set(x,y,z);t.rotation.x=-Math.PI/2;t.scale.set(w,d,1);t.updateMatrix();stamps.push(t.matrix.clone())
  }
  for(const {x,z,facing:f} of shared.houses){
    stamp(x+.41,-.029,z+.40,9.95,9.61)
    stamp(x,.079,z-f*2.51,3.4,1.13);stamp(x-f*2.2,.079,z+f*.3,1.72,2.97);stamp(x+f*2.1,.079,z-f*1.46,1.8,2.2)
  }
  for(const side of [-1,1])for(const x of BOULEVARD_TREES)stamp(side*x+.42,.012,15.22,3.55,2.75)
  for(const [x,z] of MARKET)stamp(x+.41,-.049,z+.40,4.77,2.82)
  stamp(.48,.013,.55,7.87,7.24)
  for(const x of [-6.25,6.25])for(const z of [-3,4])stamp(x+.12,.002,z+.17,2.17,4.84)
  for(const [x,z,w] of [[0,-7,20],[-24,5,21],[24,5,17]])stamp(x,-.002,z+.2,w,3.2)
  stamp(-17.62,-.054,55.3,4.82,4.59)
  const mesh=new T.InstancedMesh(new T.PlaneGeometry(),mat,stamps.length)
  stamps.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));scene.add(mesh)
}
