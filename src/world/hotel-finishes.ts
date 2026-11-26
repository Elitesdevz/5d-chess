import * as T from 'three'
import {parquet} from './domestic-finishes.ts'

// Screen-printed travel posters, drawn once per palette for the guest floors.
const prints=new Map<number,T.MeshBasicMaterial>()
const colors=[
  ['#dbc398','#b47959','#446e69','#283e44'],
  ['#ecd6af','#c88965','#977368','#374c58'],
  ['#d8ceb0','#cb9f69','#517b7b','#2d4b58'],
  ['#f2d3a3','#da905f','#698475','#264957'],
  ['#f2dcaf','#c4a566','#807087','#353747'],
]
export function travelPrint(parent:T.Object3D,variant:number,x:number,y:number,z:number,w:number,h:number,reverse=false){
  let material=prints.get(variant)
  if(!material){
    const canvas=document.createElement('canvas');canvas.width=384;canvas.height=256
    const c=canvas.getContext('2d')!,[sky,sun,land,ink]=colors[variant%colors.length]
    c.fillStyle=sky;c.fillRect(0,0,384,256)
    c.fillStyle=sun;c.beginPath();c.arc(92+variant*32,93,48,0,Math.PI*2);c.fill()
    for(let band=0;band<3;band++){
      c.fillStyle=[land,ink,sun][band];c.beginPath();c.moveTo(0,256)
      for(let i=0;i<=12;i++)c.lineTo(i*32,142+band*30+28*Math.sin(i*.65+variant+band*1.3)-12*Math.cos(i*1.6))
      c.lineTo(384,256);c.fill()
    }
    c.strokeStyle=sky;c.lineWidth=2
    for(let i=0;i<7;i++){c.beginPath();c.moveTo(18+i*32,210+i%3*6);c.lineTo(49+i*32,210+i%3*6);c.stroke()}
    c.lineWidth=5;c.strokeRect(8,8,368,240)
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace
    material=new T.MeshBasicMaterial({map});prints.set(variant,material)
  }
  const art=new T.Mesh(new T.PlaneGeometry(w,h),material)
  art.position.set(x,y,z);art.rotation.y=reverse?Math.PI:0;parent.add(art)
}

// Light refracts into narrow moving bands on the submerged mosaic. Separate
// the surface and basin so the steps and lane markings remain visible.
export function bathWater(parent:T.Object3D){
  const time={value:0},disturbance={value:new T.Vector3(0,0,-20)}
  const vertex=`
    varying vec2 bathUv;
    varying vec3 worldPoint;
    void main(){
      bathUv=uv;
      vec4 p=modelMatrix*vec4(position,1.);
      worldPoint=p.xyz;
      gl_Position=projectionMatrix*viewMatrix*p;
    }`
  const waves=`
    uniform float t;
    varying vec2 bathUv;
    varying vec3 worldPoint;
    float swell(vec2 p){
      return sin(p.x*4.5+p.y*1.8+t*1.18)*.42+
             sin(p.x*1.7-p.y*5.4-t*.93)*.27+
             sin(p.y*9.+sin(p.x*3.+t*.63))*.13;
    }`
  function sheet(y:number,fragment:string,order:number){
    const mat=new T.ShaderMaterial({uniforms:{t:time,stepAt:disturbance},vertexShader:vertex,
      fragmentShader:waves+fragment,transparent:true,depthWrite:false,side:T.DoubleSide})
    const surface=new T.Mesh(new T.PlaneGeometry(4.94,9.78),mat)
    surface.rotation.x=-Math.PI/2;surface.position.set(5.975,y,-17);surface.renderOrder=order;parent.add(surface)
  }
  sheet(-1.163,`
    void main(){
      vec2 p=bathUv*vec2(4.94,9.78);
      float v=swell(p*1.5)+.17*sin(p.y*8.+swell(p)*3.);
      float lace=pow(max(0.,1.-abs(v)*2.6),4.);
      gl_FragColor=vec4(.65,1.,.83,lace*.55);
      #include <colorspace_fragment>
    }`,1)
  sheet(-.12,`
    uniform vec3 stepAt;
    void main(){
      vec2 p=bathUv*vec2(4.94,9.78);
      float crest=swell(p);
      vec3 eye=normalize(cameraPosition-worldPoint);
      float angle=pow(1.-abs(eye.y),2.);
      float d=distance(worldPoint.xz,stepAt.xy),age=t-stepAt.z;
      float ring=sin(29.*(d-age*1.2))*exp(-7.*abs(d-age*1.2))*exp(-age*1.8);
      float glint=smoothstep(.64,.88,crest+ring*.38);
      vec3 color=mix(vec3(.017,.34,.37),vec3(.25,.72,.68),angle+.16*crest);
      color+=vec3(.68,.84,.76)*(glint*.56+max(ring,0.)*.18);
      gl_FragColor=vec4(color,.44+angle*.36);
      #include <colorspace_fragment>
    }`,2)
  let lastX=Infinity,lastZ=Infinity,origin:number|undefined
  return (now:number,x:number,z:number,inside:boolean,reduced:boolean)=>{
    if(reduced)return
    origin??=now
    time.value=(now-origin)/1000
    if(!inside){lastX=Infinity;return}
    if(Math.hypot(x-lastX,z-lastZ)>.68){
      disturbance.value.set(x,z,time.value);lastX=x;lastZ=z
    }
  }
}

type FloorFinish='parquet'|'salon'|'arcade'|'terrazzo'
const surfaces=new Map<FloorFinish,T.MeshStandardMaterial>()
function surface(kind:FloorFinish){
  const existing=surfaces.get(kind)
  if(existing)return existing
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256
  const c=canvas.getContext('2d')!
  let seed=7345
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)
  if(kind==='terrazzo'){
    c.fillStyle='#cbbfa7';c.fillRect(0,0,256,256)
    for(let i=0;i<1500;i++){
      const x=random()*256,y=random()*256,r=1+random()*4
      c.fillStyle=['#a98f75','#e2d4b8','#9eaba1','#ede5cb','#ad9c88'][i%5]
      c.beginPath();c.moveTo(x,y);c.lineTo(x+r*1.3,y-r*.4);c.lineTo(x+r*.6,y+r);c.fill()
    }
    c.strokeStyle='#988c7a';c.lineWidth=2;c.strokeRect(0,0,256,256)
  }else{
    const arcade=kind==='arcade'
    c.fillStyle=arcade?'#343844':'#643f49';c.fillRect(0,0,256,256)
    for(let row=-1;row<5;row++)for(let col=-1;col<3;col++){
      const x=col*128+(row%2)*64,y=row*64
      c.fillStyle=arcade?'#414754':'#704953';c.strokeStyle=arcade?'#677067':'#947261';c.lineWidth=1.8
      c.beginPath();c.moveTo(x-64,y+64);c.quadraticCurveTo(x-51,y+15,x,y)
      c.quadraticCurveTo(x+51,y+15,x+64,y+64);c.closePath();c.fill();c.stroke()
      for(let k=-2;k<=2;k++){c.beginPath();c.moveTo(x,y+59);c.lineTo(x+k*15,y+10+Math.abs(k)*8);c.stroke()}
    }
    for(let i=0;i<6500;i++){
      c.fillStyle=i%2?'#e2cfaa18':'#161c291c';c.fillRect(random()*256,random()*256,1,2)
    }
  }
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=4
  const mat=new T.MeshStandardMaterial({map,roughness:kind==='terrazzo'?.52:.88})
  surfaces.set(kind,mat);return mat
}
export function finishFloor(parent:T.Object3D,kind:FloorFinish,x:number,y:number,z:number,w:number,d:number,tile:number){
  if(kind==='parquet'){
    parquet(parent,{l:x-w/2,r:x+w/2,b:z-d/2,f:z+d/2},0xb49777,y)
    return
  }
  const geometry=new T.PlaneGeometry(w,d),uv=geometry.attributes.uv
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w/tile,uv.getY(i)*d/tile)
  const floor=new T.Mesh(geometry,surface(kind))
  floor.rotation.x=-Math.PI/2;floor.position.set(x,y,z);parent.add(floor)
}
