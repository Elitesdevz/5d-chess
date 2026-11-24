import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import test from 'node:test'
import {chromium} from 'playwright'
import {createApplication} from '../server/application.ts'
import {cityRoute} from '../server/city-life.ts'
import {ChessStore} from '../server/storage.ts'
import {distance,point} from '../src/world/city-plan.ts'

test('two browser sessions can walk into the civic quarter and observe the same city', {timeout:165_000},async()=>{
  const clock=Date.now
  let now=Math.floor(clock()/3600000)*3600000+14*150000
  Date.now=()=>now
  const store=new ChessStore('.',{memory:true}),app=createApplication(store),server=createServer(app.handle)
  await new Promise(r=>server.listen(0,'127.0.0.1',r))
  let browser
  try{
    const base='http://127.0.0.1:'+server.address().port
    browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
    const desktop=await browser.newContext({viewport:{width:920,height:620},reducedMotion:'reduce'})
    const phone=await browser.newContext({viewport:{width:390,height:740},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce'})
    async function signIn(context,username){
      const response=await context.request.post(base+'/api/signup',{data:{username,password:'fixture',confirm:'fixture'}})
      assert.equal(response.status(),201)
    }
    await signIn(desktop,'CityWalker')
    await signIn(phone,'CityVisitor')
    async function presence(context,data={}){
      const response=await context.request.post(base+'/api/world/presence',{data:{scene:true,...data}})
      assert.ok(response.ok(),await response.text())
      return response.json()
    }
    let view=await presence(desktop)
    const destination=point(23.25,-70.9),route=cityRoute(view.you,destination)
    assert.ok(route.length>5)
    for(const p of route){
      for(let i=0;i<96&&distance(view.you,p)>.19;i++){
        now+=680
        view=await presence(desktop,{world:view.id,...p,yaw:0})
      }
      assert.ok(distance(view.you,p)<.48,JSON.stringify({p,at:view.you}))
    }
    assert.ok(distance(view.you,destination)<.24)
    assert.ok(view.traffic.vehicles.some(v=>v.speed>.1))
    const page=await desktop.newPage(),errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    await page.goto(base+'/chess/world.html')
    const canvas=page.locator('#world-canvas[data-zone="city"]')
    await canvas.waitFor({timeout:48_000})
    assert.ok(await canvas.isVisible())
    const start=view.you.z
    const tick=setInterval(()=>now+=120,120)
    try{
      await page.evaluate(()=>new Promise(resolve=>{
        window.dispatchEvent(new KeyboardEvent('keydown',{key:'w'}))
        setTimeout(()=>{window.dispatchEvent(new KeyboardEvent('keyup',{key:'w'}));resolve()},530)
      }))
      for(let i=0;i<12;i++){
        view=await presence(desktop)
        if(view.you.z<start-.18)break
        await page.waitForTimeout(210)
      }
      assert.ok(view.you.z<start-.18,'keyboard movement reaches the park path')
    }finally{clearInterval(tick)}
    await page.close()

    const guest=await presence(phone)
    assert.equal(guest.id,view.id)
    assert.deepEqual(guest.traffic,(await presence(desktop)).traffic)
    assert.ok(guest.residents.length>3)
    assert.ok(guest.residents.every(n=>typeof n.activity==='string'&&n.home.length>0))
    const mobile=await phone.newPage()
    mobile.on('pageerror',e=>errors.push(e.message))
    await mobile.goto(base+'/chess/world.html')
    await mobile.locator('#world-canvas[data-zone="city"]').waitFor({timeout:48_000})
    assert.equal(await mobile.evaluate(()=>document.querySelector('#city-world').dataset.flat),undefined)
    assert.deepEqual(errors,[])
  }finally{
    Date.now=clock
    await browser?.close()
    server.closeAllConnections()
    await new Promise(r=>server.close(r));app.close?.();store.close()
  }
})
