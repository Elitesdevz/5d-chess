// Shared by the terrain mesh and the authoritative movement simulation.
export const TERRAIN_STEP=2
export const TERRAIN_EXTENT=170
export const HOMES=[
  [-40,-17],[-32,-20],[-22,-21],[22,-22],[32,-19],[42,-17],
  [-42,2],[-27,19],[-17,23],[16,25],[27,19],[42,2],
  [-52,-17],[-55,19],[-45,26],[46,25],[55,18],[55,-17],
  [-25,-36],[-36,-37],[24,-38],[36,-36],[-13,40],[13,40],
] as const
export const CAVE_X=-40,OASIS_X=40,CAVE_MOUTH=74,OASIS_MOUTH=56
export const passages=[{x:CAVE_X,z:CAVE_MOUTH},{x:OASIS_X,z:OASIS_MOUTH}]
export const tunnelBed=(z:number)=>-Math.min(5.8,Math.max(0,7.7-z)*.56)
export const basinBed=(z:number)=>tunnelBed(z)-Math.min(1.6,Math.max(0,-1.6-z)*.42)
export const poolLevel=-5.05
export const inPool=(x:number,z:number)=>Math.abs(x)<2.2&&z< -1.6
export function ridgeDistance(x:number,z:number){
  const theta=Math.atan2(z,x)
  return Math.hypot(x,z*.97)-(89+6*Math.sin(theta*3+.8)+4*Math.cos(theta*5))
}
export function terrainVertex(x:number,z:number){
  const radius=Math.abs(x)<79&&Math.abs(z)<51?0:Math.hypot(x,z),d=ridgeDistance(x,z)
  const plain=Math.min(1,Math.max(0,(radius-63)/16))*(.85+.48*Math.sin(x*.11)+.35*Math.cos(z*.15))
  const t=Math.max(0,d)
  const ridge=(1-Math.exp(-t*t/1750))*(42+5*Math.sin(x*.055)+5*Math.cos(z*.048))
  // Keep both tunnel approaches level through the foot of the ridge.
  const channel=Math.min(...passages.map(p=>Math.max(Math.abs(x-p.x)-6,p.z-4-z,z-p.z-19,0)))
  return (plain+ridge)*Math.min(1,channel/7)
}
export function terrainHeight(x:number,z:number){
  if(Math.abs(x)+Math.abs(z)<63)return 0
  const step=TERRAIN_STEP,a=Math.floor(x/step)*step,b=Math.floor(z/step)*step
  const u=(x-a)/step,v=(z-b)/step,h=terrainVertex(a,b),end=terrainVertex(a+step,b+step)
  if(u>=v)return h*(1-u)+terrainVertex(a+step,b)*(u-v)+end*v
  return h*(1-v)+terrainVertex(a,b+step)*(v-u)+end*u
}
export function passableLand(x:number,z:number){
  if(ridgeDistance(x,z)<1)return true
  const height=terrainHeight(x,z)
  return ridgeDistance(x,z)<30&&height<22&&Math.hypot(terrainHeight(x+.5,z)-terrainHeight(x-.5,z),terrainHeight(x,z+.5)-terrainHeight(x,z-.5))<.91
}
export const homeFacing=(z:number)=>z===19||z===25||z===26||z===23||z===18?-1:1
export function houseObstacle(x:number,z:number){
  for(const [cx,cz] of HOMES){
    const dx=(x-cx)*homeFacing(cz),dz=(z-cz)*homeFacing(cz),side=Math.abs(dx)
    if(side>3.28||Math.abs(dz)>3.19)continue
    if(side>2.74||dz< -2.65||dz>2.65&&side>.75)return true
    if(dx< -1.46&&dz>-.9&&dz<1.48||dx>1.32&&dz<-.57||dz< -1.93&&side<1.55)return true
  }
  return false
}
export const MARKET=[[-14,18],[14,18]] as const
export const BOULEVARD_TREES=[19,30,39,54] as const
export function townFixture(x:number,z:number){
  if(Math.abs(z-18)<.87&&Math.abs(Math.abs(x)-14)<1.52)return true
  if(Math.abs(z-14.85)<.34&&BOULEVARD_TREES.some(dx=>Math.abs(Math.abs(x)-dx)<.34))return true
  if(Math.abs(Math.abs(x)-6.25)<.64&&(Math.abs(z+3)<2||Math.abs(z-4)<2))return true
  if(Math.abs(x+28)<2.72&&Math.abs(z-55)<3.7||Math.abs(x+5)<8.2&&Math.abs(x)>.93&&Math.abs(z-51)<.23)return true
  return Math.hypot(x+18,z-55)<1.67
}

export function trailDistance(x:number,z:number){
  const mouth=x<0?CAVE_MOUTH:OASIS_MOUTH
  const t=Math.max(0,Math.min(1,(z-36)/(mouth-36)))
  const route=16+24*t+2*Math.sin(t*Math.PI*2)
  return z>32&&z<mouth+1?Math.abs(Math.abs(x)-route):100
}
// Both the renderer and walking simulation use these positions for the tree trunks.
export const VALLEY_TREES:{x:number;z:number;size:number}[]=[]
const treeCells=new Map<string,{x:number;z:number}[]>()
let woodlandSeed=6821
function woodlandRandom(){woodlandSeed=(Math.imul(woodlandSeed,1664525)+1013904223)>>>0;return woodlandSeed/4294967296}
for(let i=0;i<730;i++){
  const x=(woodlandRandom()-.5)*220,z=(woodlandRandom()-.5)*220,size=2.2+woodlandRandom()*3.1
  if(Math.abs(x)<79&&Math.abs(z)<52||Math.abs(x)<24&&z<64&&z>46||passages.some(p=>Math.abs(x-p.x)<7&&z>p.z-4&&z<p.z+21)||trailDistance(x,z)<2||ridgeDistance(x,z)>8)continue
  VALLEY_TREES.push({x,z,size})
  for(let a=Math.floor((x-.32)/6);a<=Math.floor((x+.32)/6);a++)for(let b=Math.floor((z-.32)/6);b<=Math.floor((z+.32)/6);b++){
    const key=a+','+b
    if(!treeCells.has(key))treeCells.set(key,[])
    treeCells.get(key)!.push({x,z})
  }
}
export function treeObstacle(x:number,z:number){
  return treeCells.get(Math.floor(x/6)+','+Math.floor(z/6))?.some(t=>(x-t.x)**2+(z-t.z)**2<.32**2)??false
}
