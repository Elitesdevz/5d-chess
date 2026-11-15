import test from 'node:test'
import assert from 'node:assert/strict'
import {project,unproject,projectedBounds,ANGLED_VIEW,FLAT_VIEW} from '../src/board-view.ts'
test('angled board projection has predictable dimensions and exactly invertible picking across distant timelines',()=>{
 assert.deepEqual(project({x:100,y:200},ANGLED_VIEW),{x:132,y:164})
 const bounds=projectedBounds(448,448,ANGLED_VIEW);assert.ok(Math.abs(bounds.width-519.68)<1e-8);assert.ok(Math.abs(bounds.height-367.36)<1e-8)
 for(const view of[ANGLED_VIEW,FLAT_VIEW])for(const x of[-9000,-224,0,224,6000])for(const y of[-3000,-224,0,224,9000]){
  const p=unproject(project({x,y},view),view);assert.ok(Math.abs(p.x-x)<1e-8);assert.ok(Math.abs(p.y-y)<1e-8)
 }
 assert.deepEqual(project({x:100,y:200},FLAT_VIEW),{x:100,y:200})
})
