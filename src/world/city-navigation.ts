import {CROSSINGS,distance,onRoad,point,PREVIEW_BOUNDS,STREETS,type Point} from './city-plan.ts'
import {distSegment,pathClearance} from './urban-layout.ts'

type Cell=Point&{g:number;f:number;prior?:Cell}
class SearchQueue {
  nodes:Cell[]=[]
  push(v:Cell){
    let i=this.nodes.push(v)-1
    while(i){
      const parent=(i-1)>>1
      if(this.nodes[parent].f<=v.f)break
      this.nodes[i]=this.nodes[parent];i=parent
    }
    this.nodes[i]=v
  }
  pop(){
    const top=this.nodes[0],v=this.nodes.pop()
    if(this.nodes.length&&v){
      let i=0
      while(i*2+1<this.nodes.length){
        let child=i*2+1
        if(this.nodes[child+1]?.f<this.nodes[child].f)child++
        if(this.nodes[child].f>=v.f)break
        this.nodes[i]=this.nodes[child];i=child
      }
      this.nodes[i]=v
    }
    return top
  }
}
const directions=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
function cellNear(p:Point,step:number,valid:(p:Point)=>boolean){
  const sx=Math.round(p.x/step),sz=Math.round(p.z/step)
  let result:Point|undefined,best=Infinity
  for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++){
    const v=point(sx+i,sz+j),world=point(v.x*step,v.z*step),d=distance(p,world)
    if(d<best&&valid(world)){result=v;best=d}
  }
  return result
}
export function findPath(from:Point,to:Point,step:number,valid:(p:Point)=>boolean,weight:(p:Point)=>number=()=>1,limit=3500){
  const a=cellNear(from,step,valid),b=cellNear(to,step,valid)
  if(!a||!b)return []
  const queue=new SearchQueue(),scores=new Map<string,number>()
  queue.push({...a,g:0,f:distance(a,b)})
  scores.set(a.x+','+a.z,0)
  for(let i=0;i<limit&&queue.nodes.length;i++){
    const v=queue.pop()!,hash=v.x+','+v.z
    if(v.g!==scores.get(hash))continue
    if(v.x===b.x&&v.z===b.z){
      const path:Point[]=[]
      for(let node:Cell|undefined=v;node;node=node.prior)path.unshift(point(node.x*step,node.z*step))
      const simplified=path.filter((p,i)=>i===0||i===path.length-1||(p.x-path[i-1].x)!==(path[i+1].x-p.x)||(p.z-path[i-1].z)!==(path[i+1].z-p.z))
      if(distance(simplified.at(-1)!,to)>.05)simplified.push(to)
      return simplified
    }
    for(const [dx,dz] of directions){
      const x=v.x+dx,z=v.z+dz,p=point(x*step,z*step)
      if(!valid(p)||dx&&dz&&(!valid(point(x*step,v.z*step))||!valid(point(v.x*step,z*step))))continue
      const g=v.g+Math.hypot(dx,dz)*weight(p),key=x+','+z
      if(g>=(scores.get(key)??Infinity))continue
      scores.set(key,g)
      queue.push({x,z,g,f:g+Math.hypot(x-b.x,z-b.z),prior:v})
    }
  }
  return []
}
const outdoorWeights=new Map<string,number>()
export function pedestrianCost(p:Point){
  const id=p.x+','+p.z,cached=outdoorWeights.get(id)
  if(cached!==undefined)return cached
  const nearCross=CROSSINGS.some(c=>Math.abs(p.x-c.x)<(c.axis==='x'?c.width/2+.8:1.54)&&Math.abs(p.z-c.z)<(c.axis==='z'?c.width/2+.8:1.54))
  const pavement=STREETS.some(s=>s.walk>0&&distSegment(p,s.a,s.b)<s.width/2+s.walk+.25&&!onRoad(p,.05))
  const cost=onRoad(p)?nearCross?1.15:9:pavement||pathClearance(p,.45)?1:2.2
  outdoorWeights.set(id,cost)
  return cost
}
export const cityGridBounds=(p:Point)=>p.x>=PREVIEW_BOUNDS.west-1&&p.x<=PREVIEW_BOUNDS.east+1&&p.z>=PREVIEW_BOUNDS.north&&p.z<=PREVIEW_BOUNDS.south+2
