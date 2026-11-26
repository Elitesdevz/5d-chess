import * as T from 'three'
import {FLEET,type VehicleKind} from './city-plan.ts'

type Section=[z:number,halfWidth:number,base:number,shoulder:number,top:number,roofWidth:number]
const sheetMetal=new T.MeshStandardMaterial({vertexColors:true,roughness:.37,metalness:.18,flatShading:true})
/** Sweep body panels through cross sections, narrowing the nose and lifting the sills over each wheel. */
function panels(parent:T.Group,sections:Section[],paint:number,window=false){
  const vertices:number[]=[],colors:number[]=[],indices:number[]=[]
  const tint=new T.Color(paint),shade=new T.Color()
  for(const [z,w,b,shoulder,top,r] of sections){
    for(const [x,y,lum] of [[-w*.94,b,.64],[-w,shoulder,.90],[-r,top,1.12],[r,top,1.12],[w,shoulder,.90],[w*.94,b,.64]]){
      vertices.push(x,y,z);shade.copy(tint).multiplyScalar(lum);colors.push(shade.r,shade.g,shade.b)
    }
  }
  for(let i=0;i<sections.length-1;i++)for(let j=0;j<6;j++){
    const a=i*6+j,b=i*6+(j+1)%6
    indices.push(a,a+6,b,b,a+6,b+6)
  }
  const end=vertices.length/3-6
  for(let j=1;j<5;j++)indices.push(0,j,j+1,end,end+j+1,end+j)
  const geo=new T.BufferGeometry()
  geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3))
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals()
  const body=new T.Mesh(geo,sheetMetal);parent.add(body)
  if(window)body.name='Glazing'
}
export function coachwork(g:T.Group,kind:VehicleKind,paint:number,commercial:boolean){
  const {w,length:l,height:h}=FLEET[kind]
  const shoulder=commercial?.78:kind==='suv'?.88:.77
  const profile:Section[]=[]
  for(const [fraction,width,y] of [[-.49,.86,-.09],[-.435,.96,-.015],[-.32,1,0],[-.26,1,0],[-.16,.998,0],[.15,1,0],[.26,1,.01],[.32,1,0],[.43,.94,-.06],[.49,.84,-.14]]){
    const arch=Math.abs(Math.abs(fraction)-.3)<.065
    const base=arch?.53:.32
    profile.push([l*fraction,w*width/2,base,shoulder-.12+y,shoulder+y,w*width*.46])
  }
  panels(g,profile,paint)
  if(commercial)return
  const wagon=kind==='wagon'||kind==='suv'||kind==='hatch'
  const rear=wagon?-.42:-.34,roofRear=wagon?-.33:-.21
  const roofFront=kind==='hatch'?.105:.09
  panels(g,[
    [rear*l,w*.443,shoulder-.03,shoulder,shoulder+.024,w*.43],
    [roofRear*l,w*.46,shoulder-.024,shoulder+.044,h-.075,w*.387],
    [roofFront*l,w*.461,shoulder-.024,shoulder+.047,h-.059,w*.372],
    [.263*l,w*.427,shoulder-.026,shoulder+.014,shoulder+.046,w*.403],
  ],0x405965,true)
  panels(g,[
    [(roofRear-.020)*l,w*.38,h-.10,h-.072,h-.048,w*.35],
    [(roofRear+.055)*l,w*.397,h-.073,h-.031,h,w*.35],
    [(roofFront-.015)*l,w*.382,h-.067,h-.028,h-.005,w*.34],
    [(roofFront+.026)*l,w*.36,h-.088,h-.063,h-.050,w*.32],
  ],paint)
  // Follow the slope of the glass with painted windscreen frames and door pillars.
  const beam=(a:T.Vector3,b:T.Vector3,width:number,tone:number)=>{
    const length=a.distanceTo(b),mesh=new T.Mesh(new T.BoxGeometry(width,width,length),sheetMetal)
    const c=new T.Color(tone)
    const attr=mesh.geometry.attributes.position
    mesh.geometry.setAttribute('color',new T.Float32BufferAttribute(Array.from({length:attr.count},()=>[c.r,c.g,c.b]).flat(),3))
    mesh.position.copy(a).lerp(b,.5);mesh.lookAt(b);g.add(mesh)
  }
  for(const s of [-1,1]){
    const at=(width:number,y:number,z:number)=>new T.Vector3(s*w*width,y,l*z)
    beam(at(.427,shoulder+.026,.263),at(.377,h-.051,roofFront),.048,paint)
    beam(at(.444,shoulder+.018,rear),at(.389,h-.056,roofRear),.066,paint)
    beam(at(.46,shoulder+.012,-.075),at(.392,h-.065,-.085),.061,0x303b3c)
    beam(at(.446,shoulder+.015,rear),at(.433,shoulder+.03,.263),.031,0xb0bab6)
  }
}
