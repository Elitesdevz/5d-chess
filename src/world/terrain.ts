// Shared by the terrain mesh and the authoritative movement simulation.
export const TERRAIN_STEP=2
export const TERRAIN_EXTENT=170
export const HOMES=[
  [-40,-15],[-32,-20],[-22,-21],[22,-22],[32,-19],[42,-15],
  [-42,2],[-27,19],[-17,23],[16,25],[27,19],[42,2],
  [-52,-15],[-55,19],[-45,26],[46,25],[55,18],[55,-16],
  [-25,-36],[-36,-37],[24,-38],[36,-36],[-13,40],[13,40],
] as const
export const CAVE_X=-40,OASIS_X=40,CAVE_MOUTH=73
export function ridgeDistance(x:number,z:number){
  const theta=Math.atan2(z,x)
  return Math.hypot(x,z*.97)-(89+6*Math.sin(theta*3+.8)+4*Math.cos(theta*5))
}
export function terrainVertex(x:number,z:number){
  const radius=Math.hypot(x,z),d=ridgeDistance(x,z)
  const plain=Math.min(1,Math.max(0,(radius-63)/16))*(.85+.48*Math.sin(x*.11)+.35*Math.cos(z*.15))
  const t=Math.max(0,d)
  const ridge=Math.min(t*t*.062,38+8*Math.sin(x*.17)+6*Math.cos(z*.14))
  // Keep both tunnel approaches level through the foot of the ridge.
  const channel=Math.max(Math.min(Math.abs(x-CAVE_X),Math.abs(x-OASIS_X))-5, CAVE_MOUTH-4-z,z-CAVE_MOUTH-18,0)
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
  return height<22&&Math.hypot(terrainHeight(x+.5,z)-terrainHeight(x-.5,z),terrainHeight(x,z+.5)-terrainHeight(x,z-.5))<.91
}
export function houseObstacle(x:number,z:number){
  for(const [cx,cz] of HOMES){
    const dx=x-cx,dz=z-cz,side=Math.abs(dx)
    if(side>3.28||Math.abs(dz)>3.19)continue
    if(side>2.74||dz< -2.65||dz>2.65&&side>.75)return true
    if(dx< -1.46&&dz>-.9&&dz<1.48||dx>1.32&&dz<-.57||dz< -1.93&&side<1.55)return true
  }
  return false
}
