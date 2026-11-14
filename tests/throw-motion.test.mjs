import test from 'node:test'
import assert from 'node:assert/strict'
import {throwMotion} from '../src/casino/throw-motion.ts'
test('visual throws follow cardinal/diagonal releases and stronger flicks travel higher with more spin',()=>{
 for(const [dx,dy,vx,vy,x,z]of [[220,0,1.2,0,1,0],[-220,0,-1.2,0,-1,0],[0,-220,0,-1.2,0,-1],[0,220,0,1.2,0,1]]){const m=throwMotion(dx,dy,vx,vy);assert.equal(m.x,x);assert.equal(m.z,z)}
 const diagonal=throwMotion(200,-200,1,-1);assert.ok(diagonal.x>0&&diagonal.z<0);assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.z)-1)<1e-9)
 const soft=throwMotion(30,-30,.1,-.1),hard=throwMotion(250,-250,2,-2);for(const key of ['power','lift','turns'])assert.ok(hard[key]>soft[key]);assert.ok(hard.power<=1)
})
test('a final flick overrides the wind-up, while slow drags and keyboard throws remain usable',()=>{
 assert.ok(throwMotion(200,0,-1,0).x<0);assert.ok(throwMotion(-200,0,1,0).x>0);assert.equal(throwMotion(120,0,0,0).x,1);assert.equal(throwMotion(0,-120,0,0).z,-1)
 const keyboard=throwMotion();assert.ok(keyboard.z<-.9);assert.ok(keyboard.power>0);assert.ok(Object.values(keyboard).every(Number.isFinite))
})
