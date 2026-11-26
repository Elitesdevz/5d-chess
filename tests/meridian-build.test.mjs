import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {compile} from '../world/meridian/compile.ts'
import {meridian} from '../world/meridian/source.ts'
import {shared} from '../src/world/map-data.ts'
import {visual} from '../src/world/map-visual.ts'
import {cityRoute} from '../server/city-life.ts'
import {outdoorWalkable,groundZone} from '../src/world/model.ts'
import {CityWorlds} from '../server/world.ts'
import {ChessStore} from '../server/storage.ts'
import {RouletteHall} from '../server/roulette-hall.ts'
const json=file=>JSON.parse(readFileSync(file,'utf8'))
const release=json('.meridian/manifest.json')
test('clean Meridian build pins its seed, shared and visual bytes across Pi and frontend',()=>{
  assert.equal(meridian.seed,6821)
  assert.equal(release.version,'33d4f2b89da4897620764735bd81d1c2d798b6e7a6d4744db4ab2e3ba8f2a31d')
  const output=compile()
  for(const [key,data] of Object.entries({shared,visual})){
    const bytes=Buffer.from(JSON.stringify(output[key])),section=release.sections[key]
    assert.deepEqual(JSON.parse(bytes),data)
    assert.equal(createHash('sha256').update(bytes).digest('hex'),section.sha256)
    for(const root of ['dist','.cloudflare/static']){
      assert.deepEqual(readFileSync(root+'/chess/maps/meridian/'+section.file),bytes)
      assert.deepEqual(json(root+'/chess/maps/meridian/manifest.json'),release)
    }
  }
  const different=structuredClone(meridian);different.seed++
  const other=compile(different)
  assert.notDeepEqual(other.visual.facades,visual.facades)
  assert.notDeepEqual(other.shared.woodland,shared.woodland)
  assert.deepEqual(other.shared.lots,shared.lots)
})
test('one frontage edit carries the existing armory, sign-bearing facade, threshold, paths and furniture',()=>{
  const source=structuredClone(meridian)
  source.shop.frontage.along+=1
  const next=compile(source)
  const values=m=>[m.civic.origins.gunshop,...m.entrances.filter(e=>e.id==='gunshop'),
    ...m.paths.find(p=>p.id==='gunshop').points,m.props.find(p=>p.id==='frontage-gunshop-lamp'),m.lots.find(p=>p.id==='gunshop')]
  values(next.shared).forEach((p,i)=>{assert.ok(Math.abs(p.x-values(shared)[i].x-1)<1e-8);assert.equal(p.z,values(shared)[i].z)})
  assert.equal(next.shared.civic.front.gunshop.z,shared.civic.front.gunshop.z)
  assert.notDeepEqual(next.visual.inlays,visual.inlays)
  assert.deepEqual(next.shared.units,shared.units)
  assert.deepEqual(next.shared.civic.cells,shared.civic.cells)
  assert.deepEqual(next.shared.civic.shopCounter,shared.civic.shopCounter)
})
test('corrupt edits identify the parcel, street, exclusion or occupied footprint',()=>{
  function rejects(change,reason){const s=structuredClone(meridian);change(s);assert.throws(()=>compile(s),reason)}
  rejects(s=>s.shop.frontage.street='typo',/gunshop: unknown frontage street typo/)
  rejects(s=>s.shop.frontage.along+=2,/block-2: footprint overlaps gunshop/)
  rejects(s=>s.keepClear[0].w=-1,/clock-square: keep-clear dimensions/)
  rejects(s=>s.streets[0].b.z++,/boulevard: expected.*axis-aligned/)
  rejects(s=>s.apartments[2].id='block-1',/duplicate.*block-1/)
  const s=structuredClone(meridian);s.houses.reverse();s.apartments.reverse()
  assert.deepEqual(compile(s).shared.units,shared.units)
})
test('the two seats on every rendered bench and the directory signs have reachable approaches',()=>{
  for(const bench of shared.props.filter(p=>p.kind==='bench')){
    const seats=shared.seats.filter(s=>s.pose.id.startsWith(bench.id+'-'))
    assert.equal(seats.length,2,bench.id)
    for(const s of seats){
      assert.equal(outdoorWalkable(s.x,s.z),true,s.id)
      assert.equal(groundZone(s.x,s.z),'city')
      assert.ok(cityRoute(shared.spawn,s).length,s.id)
    }
  }
  for(const d of shared.directory){
    const approach={x:d.x,z:d.z+.9}
    assert.ok(outdoorWalkable(approach.x,approach.z)&&cityRoute(shared.spawn,approach).length,d.title)
    assert.equal(d.nearby.length,4);assert.ok(d.nearby.every(p=>p.metres>=0))
  }
})
test('the authority range-checks the board, seats two players and rejects taking an occupied seat',t=>{
  const store=new ChessStore('.',{memory:true}),hall=new RouletteHall(store),world=new CityWorlds(store,hall)
  hall.stop();t.after(()=>store.close())
  const names=['Bench A','Bench B'];let now=Date.now()
  store.transaction(tx=>{for(const name of names)tx.users.add(name,{name,hash:'',salt:'',wallet:{coins:77,starterGranted:true,inventory:[],loadout:{icon:'default',pieces:{}}}})})
  const act=(name,op,data={})=>world.update(name,op,{scene:true,...data},now+=400)
  const move=(name,goal)=>{
    let view=act(name,'presence')
    for(const p of cityRoute(view.you,goal)){
      for(let i=0;i<100&&Math.hypot(p.x-view.you.x,p.z-view.you.z)>.12;i++)view=act(name,'presence',{world:view.id,zone:'city',...p,yaw:0})
    }
    assert.ok(Math.hypot(goal.x-view.you.x,goal.z-view.you.z)<.16)
    return view
  }
  const board=shared.directory.find(d=>d.id==='directory:clock-directory'),target={target:board.id}
  act(names[0],'presence')
  assert.throws(()=>act(names[0],'use',target),/closer/)
  const before=move(names[0],{x:board.x,z:board.z+.9}),read=act(names[0],'use',target)
  assert.equal(read.interaction,board.id);assert.deepEqual(read.you,before.you)
  const seats=shared.seats.filter(p=>p.id.includes('frontage-hotel'))
  for(const name of names)move(name,seats[0])
  assert.equal(act(names[0],'use',{target:seats[0].id}).you.homePose.id,seats[0].pose.id)
  assert.throws(()=>act(names[1],'use',{target:seats[0].id}),/occupied/)
  move(names[1],seats[1]);assert.equal(act(names[1],'use',{target:seats[1].id}).you.homePose.id,seats[1].pose.id)
  for(const [i,name] of names.entries()){
    const standing=act(name,'stand-scenery')
    assert.equal(standing.you.homePose,undefined)
    assert.equal(standing.you.x,seats[i].exit.x);assert.equal(standing.you.z,seats[i].exit.z)
  }
})
