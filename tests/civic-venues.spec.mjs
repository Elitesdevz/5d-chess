import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {createServer} from 'node:http'
import {createApplication} from '../server/application.ts'
import {ChessStore} from '../server/storage.ts'
import {at,cells,entrances,insideDoor,stair} from '../src/world/civic-venues.ts'
import {browserWalker,observeCity} from './civic-controls.mjs'

for(const flat of [true,false])test('walk from Clock Square through both Civic Avenue venues with '+(flat?'2D keyboard':'3D touch controls'),{timeout:520000},async()=>{
  const store=new ChessStore('.',{memory:true}),app=createApplication(store),server=createServer(app.handle)
  await new Promise(r=>server.listen(0,'127.0.0.1',r))
  let browser
  try{
    const base='http://127.0.0.1:'+server.address().port
    browser=await chromium.launch({args:['--no-sandbox',...(flat?['--disable-webgl']:['--use-angle=swiftshader','--enable-unsafe-swiftshader'])]})
    const context=await browser.newContext(flat?{viewport:{width:960,height:600}}:{viewport:{width:480,height:540},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce'})
    const page=await context.newPage(),errors=[],travel=[]
    await observeCity(page)
    page.on('pageerror',e=>errors.push(e.message))
    page.on('request',req=>{if(req.url().endsWith('/world/teleport'))travel.push(req.postDataJSON()?.to)})
    await context.request.post(base+'/api/signup',{data:{username:'Civic visitor',password:'fixture',confirm:'fixture'}})
    await page.goto(base+'/chess/lobby.html')
    await page.getByRole('link',{name:'City',exact:true}).first().click()
    const zone=z=>page.locator('#world-canvas[data-zone="'+z+'"]').waitFor({timeout:60000})
    await zone('city')
    assert.equal(await page.locator('#city-world').getAttribute('data-flat'),flat?'true':null)
    const v=await page.evaluate(()=>window.walkObservation.view.you)
    assert.deepEqual([v.x,v.z],[0,8])
    const {walk,outside,use}=browserWalker(page,!flat)
    await outside(entrances.station);await use('enter-station');await zone('station')
    await walk(at('station',-4.45,.39));await use('desk')
    await page.getByRole('heading',{name:'Meridian Police front desk'}).waitFor()
    await page.getByRole('button',{name:'Close',exact:true}).click()
    for(let n=1;n<=5;n++){
      await walk(at('station',stair.up,0),at('station',stair.up,2.90),at('station',stair.down,2.90),at('station',stair.down,stair.start+.12))
      await use('gallery-up');await zone('precinct:'+n)
    }
    await walk(at('station',cells[49].x,0))
    for(let n=5;n>0;n--){
      await walk(at('station',stair.down,stair.start-.53));await use('gallery-down');await zone(n===1?'station':'precinct:'+(n-1))
      await walk(at('station',stair.down,2.90),at('station',stair.up,2.90),at('station',stair.up,0))
    }
    for(const id of ['station','gunshop']){
      if(id==='gunshop'){
        await outside(entrances.gunshop);await use('enter-gunshop');await zone('gunshop')
        await walk(at(id,0,-1.22));await use('counter')
        await page.getByRole('button',{name:/Buy Pistol for 25 cash/}).waitFor()
        await page.getByRole('button',{name:'Close',exact:true}).click()
      }
      const p=insideDoor(id);await walk(at(id,p.x,p.z));await use('exit-venue');await zone('city')
      const pos=await page.evaluate(()=>window.walkObservation.view.you)
      assert.ok(Math.hypot(pos.x-entrances[id].x,pos.z-entrances[id].z)<.36)
    }
    assert.ok(travel.every(to=>to==='city'));assert.deepEqual(errors,[])
  }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));app.drain();store.close()}
})
