import * as T from 'three'
import {box,mesh,v} from './scene/geometry.ts'
import {materials} from './scene/materials.ts'
/** Layered architectural dressing, with baked texture detail instead of expensive postprocessing. */
export function buildSalon(world:T.Scene){
 const m=materials(),wall=new T.MeshStandardMaterial({color:0x15343c,roughness:.86}),velvet=new T.MeshStandardMaterial({color:0x4e2734,roughness:1}),stone=new T.MeshStandardMaterial({color:0x283332,roughness:.4,metalness:.08})
 mesh(new T.PlaneGeometry(16,18),stone,world,[0,0,0]).rotation.x=-Math.PI/2
 box(world,[11,4.7,.2],[0,2.3,-4.7],wall,.02);for(const side of[-1,1])box(world,[.2,4.7,12],[side*5.5,2.3,0],wall,.02)
 box(world,[11,.1,.14],[0,1.05,-4.53],m.brass,.015);box(world,[11,.14,.22],[0,.1,-4.5],m.wood,.02);box(world,[11,.15,.2],[0,4.2,-4.5],m.brass,.02)
 for(let i=-5;i<=5;i++){box(world,[.94,.84,.07],[i, .56,-4.53],m.wood,.02);box(world,[.80,.66,.03],[i,.56,-4.47],m.ebony,.025);box(world,[.025,3.1,.09],[i,2.65,-4.51],m.darkGold,.005)}
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=768;const ctx=canvas.getContext('2d')!,gradient=ctx.createLinearGradient(0,0,0,768);gradient.addColorStop(0,'#142d46');gradient.addColorStop(.6,'#405563');gradient.addColorStop(1,'#10202e');ctx.fillStyle=gradient;ctx.fillRect(0,0,1024,768)
 ctx.fillStyle='#e4dcbd';ctx.beginPath();ctx.arc(760,170,35,0,Math.PI*2);ctx.fill();let seed=421;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
 for(let layer=0;layer<3;layer++)for(let i=0;i<28;i++){const x=i*43-25+layer*11,h=70+random()*270,y=768-h-layer*45;ctx.fillStyle=['#263c4c','#1b2a38','#0d1c27'][layer];ctx.fillRect(x,y,35,h+150);for(let row=0;row<12;row++)for(let col=0;col<3;col++)if(random()>.62){ctx.fillStyle=random()>.6?'#ae9168':'#66818a';ctx.fillRect(x+5+col*9,y+10+row*19,3,6)}}
 const skyline=new T.CanvasTexture(canvas);skyline.colorSpace=T.SRGBColorSpace
 for(const x of[-3.3,0,3.3]){
  const s=new T.Shape();s.moveTo(-.85,0);s.lineTo(.85,0);s.lineTo(.85,1.85);s.quadraticCurveTo(.85,2.7,0,2.85);s.quadraticCurveTo(-.85,2.7,-.85,1.85);s.closePath();const geo=new T.ShapeGeometry(s,32),uv=geo.getAttribute('uv'),pos=geo.getAttribute('position');for(let i=0;i<uv.count;i++)uv.setXY(i,(pos.getX(i)+.85)/1.7,pos.getY(i)/2.85)
  const pane=mesh(geo,new T.MeshStandardMaterial({map:skyline,emissiveMap:skyline,emissive:0xabbfd7,emissiveIntensity:.48,roughness:.35,metalness:.1}),world,[x,1.12,-4.55]);const border=s.getPoints(48).map(p=>v(p.x,p.y,0));border.push(border[0]);mesh(new T.TubeGeometry(new T.CatmullRomCurve3(border),100,.035,8,true),m.brass,world,[x,1.12,-4.48]);box(world,[.028,2.35,.05],[x,2.3,-4.43],m.darkGold,.005);box(world,[1.68,.025,.05],[x,2.6,-4.43],m.darkGold,.005)
  for(const side of[-1,1]){for(let fold=0;fold<4;fold++){const curtain=mesh(new T.CylinderGeometry(.075,.095,3,10),velvet,world,[x+side*(1.03+fold*.08),2.6,-4.32]);curtain.scale.z=.6}box(world,[.40,.06,.14],[x+side*1.15,1.85,-4.25],m.gold,.012)}
 }
 // A patterned runner grounds the table and chairs in the room.
 const carpet=document.createElement('canvas');carpet.width=carpet.height=512;const c=carpet.getContext('2d')!;c.fillStyle='#263c38';c.fillRect(0,0,512,512);for(let i=16;i<60;i+=9){c.strokeStyle=i%2?'#937a4a':'#58675c';c.lineWidth=2;c.strokeRect(i,i,512-i*2,512-i*2)}for(let y=70;y<450;y+=38)for(let x=70;x<450;x+=38){c.strokeStyle='#b49b593b';c.beginPath();c.moveTo(x,y-10);c.lineTo(x+7,y);c.lineTo(x,y+10);c.lineTo(x-7,y);c.closePath();c.stroke()}
 const carpetMap=new T.CanvasTexture(carpet);carpetMap.colorSpace=T.SRGBColorSpace;mesh(new T.PlaneGeometry(5.6,5.3),new T.MeshStandardMaterial({map:carpetMap,roughness:1}),world,[0,.012,0]).rotation.x=-Math.PI/2
 for(const side of[-1,1]){const x=side*3.9;mesh(new T.CylinderGeometry(.025,.04,2.25,16),m.brass,world,[x,1.12,-2.8]);const shade=mesh(new T.CylinderGeometry(.18,.35,.45,32,1,true),new T.MeshStandardMaterial({color:0xead9b5,emissive:0xddbc83,emissiveIntensity:.25,side:T.DoubleSide}),world,[x,2.30,-2.8]);mesh(new T.CylinderGeometry(.20,.22,.06,20),m.darkGold,world,[x,.05,-2.8]);const light=new T.PointLight(0xffce8b,5,5);light.position.set(x,2.14,-2.8);world.add(light)}
 // Chandelier sits behind the playing surface, outside the overhead wheel camera.
 for(const r of[.60,.88]){const ring=mesh(new T.TorusGeometry(r,.024,10,56),m.brass,world,[0,3.2,-2.3]);ring.rotation.x=Math.PI/2}mesh(new T.CylinderGeometry(.018,.018,.95,10),m.darkGold,world,[0,3.72,-2.3]);for(let i=0;i<12;i++){const a=i*Math.PI/6;mesh(new T.CylinderGeometry(.022,.022,.22,8),m.gold,world,[Math.cos(a)*.83,3.05,-2.3+Math.sin(a)*.83]);mesh(new T.SphereGeometry(.045,10,8),new T.MeshStandardMaterial({color:0xffe7bc,emissive:0xffc984,emissiveIntensity:2}),world,[Math.cos(a)*.83,2.91,-2.3+Math.sin(a)*.83])}
 const pendant=new T.PointLight(0xffdfac,10,8);pendant.position.set(0,2.85,-2.3);world.add(pendant)
 const shadow=document.createElement('canvas');shadow.width=shadow.height=64;const sc=shadow.getContext('2d')!,g=sc.createRadialGradient(32,32,2,32,32,32);g.addColorStop(0,'#0009');g.addColorStop(1,'#0000');sc.fillStyle=g;sc.fillRect(0,0,64,64);const map=new T.CanvasTexture(shadow);for(const [x,z,w,d]of[[0,0,4.6,3.3],[-2.4,-.6,1.3,1.1],[2.4,-.7,1.3,1.1]])mesh(new T.PlaneGeometry(w,d),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false}),world,[x,.024,z]).rotation.x=-Math.PI/2
 return m
}
