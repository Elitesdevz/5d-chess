import * as T from 'three'
import type {Rect} from './residential.ts'

const boards=new Map<number,T.MeshStandardMaterial>(),rugs=new Map<number,T.MeshStandardMaterial>()
function paint(w:number,h:number,draw:(c:CanvasRenderingContext2D)=>void){
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h
  draw(canvas.getContext('2d')!)
  const map=new T.CanvasTexture(canvas)
  map.colorSpace=T.SRGBColorSpace;map.anisotropy=4
  return new T.MeshStandardMaterial({map,roughness:.87})
}
function timber(tone:number){
  let mat=boards.get(tone)
  if(mat)return mat
  mat=paint(512,256,c=>{
    c.fillStyle='#'+tone.toString(16).padStart(6,'0');c.fillRect(0,0,512,256)
    for(let row=0;row<12;row++){
      const h=256/12,y=row*h
      for(let i=-1;i<3;i++){
        const x=i*256+(row*91)%256,v=Math.sin(row*17+i*12)
        c.fillStyle=v>0?'rgba(255,231,190,.10)':'rgba(50,28,19,.08)'
        c.fillRect(x,y,256,h)
        c.strokeStyle='#51372059';c.lineWidth=1.4;c.strokeRect(x,y,256,h)
        for(let k=0;k<5;k++){
          const line=y+2+k*3.7
          c.strokeStyle=k%2?'#683e211d':'#ffe2ad2e';c.lineWidth=1
          c.beginPath();c.moveTo(x+2,line);c.bezierCurveTo(x+93,line+3*v,x+132,line-4*v,x+251,line+v);c.stroke()
        }
      }
    }
  })
  mat.map!.wrapS=mat.map!.wrapT=T.RepeatWrapping;boards.set(tone,mat)
  return mat
}
export function parquet(parent:T.Group,r:Rect,tone:number){
  const w=r.r-r.l,d=r.f-r.b,geo=new T.PlaneGeometry(w,d),uv=geo.attributes.uv
  for(let i=0;i<uv.count;i++)uv.setXY(i,(r.l+uv.getX(i)*w)/3.6,(uv.getY(i)*d-r.f)/1.86)
  const floor=new T.Mesh(geo,timber(tone));floor.rotation.x=-Math.PI/2
  floor.position.set((r.l+r.r)/2,.002,(r.b+r.f)/2);parent.add(floor)
}
const schemes=[
  ['#9f654e','#d5ab77','#354f52'],['#48686b','#d5c49e','#824e45'],['#846677','#e2be89','#4a595f'],
  ['#657556','#dcca9d','#865640'],['#405a6b','#dfb382','#9d6157'],
]
export function wovenRug(parent:T.Group,variant:number,x:number,z:number,width:number,depth:number,yaw:number){
  const key=variant%schemes.length
  let mat=rugs.get(key)
  if(!mat){
    mat=paint(384,256,c=>{
      const [ground,undyed,accent]=schemes[key]
      c.fillStyle=ground;c.fillRect(0,0,384,256)
      for(const [inset,line,color] of [[6,3,undyed],[14,6,accent],[21,2,undyed]] as const){
        c.strokeStyle=color;c.lineWidth=line;c.strokeRect(inset,inset,384-2*inset,256-2*inset)
      }
      const diamond=(x:number,y:number,w:number,h:number,color:string)=>{
        c.fillStyle=color;c.beginPath();c.moveTo(x-w,y);c.lineTo(x,y-h);c.lineTo(x+w,y);c.lineTo(x,y+h);c.fill()
      }
      for(const x of [76,192,308]){
        diamond(x,128,49,71,undyed);diamond(x,128,41,59,accent);diamond(x,128,22,35,ground);diamond(x,128,10,14,undyed)
      }
      for(let x=34;x<357;x+=18)for(const y of [32,224])diamond(x,y,4,6,undyed)
      c.fillStyle='#eee1ca18';for(let y=0;y<256;y+=3)c.fillRect(0,y,384,1)
    })
    rugs.set(key,mat)
  }
  const mesh=new T.Mesh(new T.PlaneGeometry(width,depth),mat)
  mesh.rotation.set(-Math.PI/2,yaw,0,'YXZ');mesh.position.set(x,.038,z);parent.add(mesh)
}
