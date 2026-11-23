import * as T from 'three'
import {Scenery} from './landscape.ts'
import {HOMES} from './terrain.ts'

const paint=[0xd6b789,0xc9ceaf,0xc18e79,0xc6beae,0x9bb5ab,0xddc299]
const roofs=[0x76534b,0x465e63,0x515461,0x935a48]
const wood=0x76523c,cream=0xebd9b2,iron=0x394b48
export function neighborhood(parent:T.Object3D){
  const props=new Scenery(),windows:T.Matrix4[]=[]
  HOMES.forEach(([cx,cz],i)=>{
    const wall=paint[i%paint.length],roof=roofs[i%roofs.length],accent=[0x477c72,0x7d5662,0x526e80,0x9e734a][i%4]
    const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:number,roll=0)=>props.add('box',cx+x,y,cz+z,w,h,d,color,0,roll)
    const orb=(x:number,y:number,z:number,w:number,h:number,d:number,color:number)=>props.add('crown',cx+x,y,cz+z,w,h,d,color)
    // Window wells cut through the walls. The doorway stays open from street to hearth.
    for(const side of [-1,1]){
      const x=side*1.94
      box(x,.43,2.88,2.12,.86,.16,wall);box(x,2.68,2.88,2.12,.72,.16,wall)
      for(const edge of [-1,1])box(x+edge*.90,1.59,2.88,.32,1.48,.18,wall)
      box(x,1.61,2.89,.055,1.48,.09,cream);box(x,1.72,2.89,1.5,.05,.09,cream)
      box(x,.85,2.97,1.81,.11,.38,cream)
      for(const edge of [-1,1])box(x+edge*.91,1.62,3,.24,1.49,.08,accent)
      windows.push(new T.Matrix4().makeTranslation(cx+x,1.59,cz+2.88))
      box(side*2.97,1.5,0,.17,3,5.78,wall)
      box(side*2.96,2.92,0,.21,.18,5.95,wood)
      box(side*.87,1.19,2.94,.12,2.38,.27,cream)
      box(side*1.58,3.70,0,3.69,.18,6.57,roof,side*-.419)
      box(side*3.22,2.98,0,.12,.19,6.57,wood)
      for(const z of [-2.92,2.92])box(side*2.89,1.55,z,.22,3.1,.22,cream)
      // A projecting planter with a few distinct blooms.
      box(x,.96,3.08,1.12,.24,.34,wood)
      for(let k=0;k<5;k++){orb(x+(k-2)*.205,1.13,3.1,.29,.21,.24,0x536f48);orb(x+(k-2)*.205,1.22,3.13,.12,.10,.12,k%2?0xeabc86:0xba6970)}
    }
    for(const z of [-2.88,2.88]){
      props.add('gable',cx,3.69,cz+z,6,1.40,.17,wall)
      box(0,3.04,z,6.18,.14,.25,cream)
    }
    box(0,1.49,-2.88,5.96,2.99,.18,wall);box(0,2.72,2.89,1.76,.66,.18,wall)
    box(0,.035,0,5.89,.07,5.76,0xa27e61)
    for(let k=0;k<11;k++)box(-2.7+k*.54,.074,0,.014,.006,5.72,wood)
    box(0,.055,3.17,1.81,.11,.51,0xb5a797);box(0,2.41,3.15,2.04,.13,.8,accent)
    box(0,4.43,0,.18,.15,6.59,roof);box(1.57,4.04,-1.69,.57,1.56,.60,0xa57662);box(1.57,4.89,-1.69,.71,.17,.75,cream)
    // Pile rug, seat, work surface, a hanging globe, and four household occupations.
    box(0,.083,.03,2.5,.014,2.92,accent)
    for(const x of [-1.11,1.11])box(x,.094,.03,.055,.01,2.69,cream)
    for(const z of [-1.29,1.35])box(0,.094,z,2.25,.01,.055,cream)
    const bakery=i%4===0,library=i%4===1,studio=i%4===2
    box(-2.25,.32,.30,.99,.51,2.02,wood);box(-2.2,.63,.30,.99,.2,1.99,accent)
    box(-2.71,.83,.30,.16,.70,2.07,accent)
    for(const z of [-.61,1.21])box(-2.25,.76,z,1,.42,.16,wood)
    orb(-2.39,.88,.90,.54,.31,.38,cream)
    box(2.19,.87,-1.47,1.15,.13,1.55,wood)
    for(const dx of [-.44,.44])for(const dz of [-.61,.61])box(2.19+dx,.43,-1.47+dz,.11,.83,.11,wood)
    box(0,.65,-2.52,2.58,1.23,.53,bakery?0x938373:wood)
    for(const y of [1.30,1.94])box(0,y,-2.54,2.81,.09,.58,wood)
    for(let k=0;k<9;k++){
      const x=(k-4)*.276
      if(library||studio)box(x,1.56,-2.47,.19,.34+k%3*.07,.29,[accent,cream,roof,0xa99161][k%4],k%5===0?.12:0)
      else orb(x,1.47,-2.47,.25,.24,.23,bakery?0xdba15b:k%2?0x9cae90:cream)
    }
    if(studio){box(2.15,1.52,-1.60,.84,1.05,.09,cream);box(2.15,1.52,-1.53,.66,.79,.04,accent)}
    else if(bakery){for(let n=0;n<3;n++)orb(2.19,1.05,-1.86+n*.36,.56,.24,.27,0xc68c55)}
    else {box(2.1,.98,-1.41,.52,.06,.42,cream);orb(2.46,1.18,-1.85,.26,.46,.26,accent)}
    box(0,2.92,.09,.045,.53,.045,iron);orb(0,2.57,.09,.38,.35,.38,0xffe9bd)
    box(-2.85,1.98,.43,.08,.82,1.04,wood);box(-2.79,1.98,.43,.03,.65,.86,accent)
  })
  props.finish(parent)
  const pane=new T.InstancedMesh(new T.PlaneGeometry(1.49,1.46),new T.MeshStandardMaterial({color:0xa8cbd0,transparent:true,opacity:.17,depthWrite:false,side:T.DoubleSide}),windows.length)
  windows.forEach((m,i)=>pane.setMatrixAt(i,m));parent.add(pane)
}
