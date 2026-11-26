import {ridgeDistance,trailOffset,urbanGround,railInfluence} from '../../src/world/geo.ts'
import type {MeridianSource} from './source.ts'
export function woodland(s:MeridianSource){
  const {cave,oasis}=s.rooms
  const CAVE_MOUTH=cave.z-7.7,OASIS_MOUTH=oasis.z-7.7
  const passages=[{x:cave.x,z:CAVE_MOUTH},{x:oasis.x,z:OASIS_MOUTH}]
  const trailDistance=(x:number,z:number)=>trailOffset(x,z,CAVE_MOUTH,OASIS_MOUTH)
  const VALLEY_TREES:{x:number;z:number;size:number}[]=[]
  let woodlandSeed=s.seed
  function woodlandRandom(){woodlandSeed=(Math.imul(woodlandSeed,1664525)+1013904223)>>>0;return woodlandSeed/4294967296}
  for(let i=0;i<730;i++){
    const x=(woodlandRandom()-.5)*220,z=(woodlandRandom()-.5)*220,size=2.2+woodlandRandom()*3.1
    if(urbanGround(x,z)||railInfluence(x,z,s.rail.z)>.18||Math.abs(x)<24&&z<64&&z>46||passages.some(p=>Math.abs(x-p.x)<7&&z>p.z-4&&z<p.z+21)||trailDistance(x,z)<2||ridgeDistance(x,z)>8)continue
    VALLEY_TREES.push({x,z,size})
  }
  return VALLEY_TREES
}
