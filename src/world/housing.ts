import {HOMES,homeFacing} from './terrain.ts'
export const RESIDENCES=[
  {name:'Linden Court',x:-53,z:-39},
  {name:'Eastbank Flats',x:54,z:-39},
] as const
export type Tenure='buy'|'rent'|'resident'
export interface Unit {id:string;name:string;x:number;z:number;facing:number;width:number;block?:number;layout:string;tenure:Tenure;price:number}
export const UNITS:Unit[]=[
  ...HOMES.flatMap(([x,z],i)=>i%3===0?[]:[{id:'house-'+i,name:(i+1)+' '+(z>0?'Mill Lane':'Linden Street'),x,z,facing:homeFacing(z),width:6,layout:['Baker’s cottage','Reading room','Artist’s house','Garden cottage'][i%4],tenure:(i%4===0?'resident':i%2?'buy':'rent') as Tenure,price:i%2?2800+i*135:140+i*8}]),
  ...RESIDENCES.flatMap((b,block)=>[4,5,6].map((width,i)=>({
    id:'flat-'+block+'-'+i,name:b.name+' · '+(101+i),x:b.x+[-5.5,-1,4.5][i],z:b.z-1,facing:1,width,block,
    layout:['Studio','Corner study','Family suite'][i],tenure:(i===block?'resident':(i+block)%2?'rent':'buy') as Tenure,price:(i+block)%2?60+width*18:800+width*280,
  }))),
]
export const OFFICES=[{x:-68,z:-22,w:8,d:11,h:19},{x:-69,z:0,w:10,d:12,h:29},{x:-68,z:24,w:9,d:8,h:13},{x:66,z:-20,w:9,d:10,h:17}]
export type Deeds=Record<string,{holder:string;until:number}>
export type HousingView={keys:string[];occupied:string[];expires:Record<string,number>}
export function propertyPoints(){
  return [...UNITS.filter(u=>u.block===undefined&&u.tenure!=='resident').map(u=>({id:'property:'+u.id,label:'View '+u.name,x:u.x+1.15,z:u.z+u.facing*3.65,range:1.55})),
    ...RESIDENCES.map((b,i)=>({id:'property:desk-'+i,label:'Speak to the housing clerk',x:b.x+5.1,z:b.z+3.7,range:1.8}))]
}
export function propertyObstacle(x:number,z:number,keys:readonly string[]){
  if(OFFICES.some(o=>Math.abs(x-o.x)<o.w/2+.15&&Math.abs(z-o.z)<o.d/2+.15))return true
  for(const b of RESIDENCES){
    const dx=Math.abs(x-b.x),dz=z-b.z
    if(dx<7.85&&dz>=-5.1&&dz<=5.1&&(dx>7.32||dz< -4.68||dz>4.66&&dx>1.02))return true
  }
  for(const u of UNITS){
    const localX=x-u.x,dx=Math.abs(localX),dz=(z-u.z)*u.facing
    if(u.block===undefined){
      if(dx<.93&&Math.abs(dz-2.88)<.24&&!keys.includes(u.id))return true
    }else if(dz>=-4&&dz<=3.02&&dx<=u.width/2+.14){
      if(dz< -1.28&&localX< -u.width/2+1.68||Math.abs(dz+.67)<1&&localX>u.width/2-1.43||u.width===6&&Math.abs(dz-.75)<.48&&Math.abs(localX-.2)<1.02)return true
      if(dx>u.width/2-.14||Math.abs(dz-2.9)<.2&&(dx>.76||!keys.includes(u.id)))return true
    }
  }
  return false
}
