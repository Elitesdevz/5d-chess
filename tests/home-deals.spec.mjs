import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp,rm} from 'node:fs/promises'
import {chromium} from 'playwright'
import {ChessStore} from '../server/storage.ts'
import {createApplication} from '../server/application.ts'

async function fixture(t){
 const dir=await mkdtemp('/tmp/home-deals-'),store=new ChessStore(dir),app=createApplication(store),server=createServer(app.handle);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,args:['--no-sandbox']})
 t.after(async()=>{app.drain();await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections()});store.close();await rm(dir,{recursive:true,force:true})});return {base,browser}
}
test('shop sculpture shows twelve real offers, stays compact, and remains usable without motion',async t=>{
 const {base,browser}=await fixture(t),ctx=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await ctx.request.post(base+'/api/signup',{data:{username:'TowerReader',password:'p',confirm:'p'}});const economy=await(await ctx.request.get(base+'/api/economy')).json()
 await page.goto(base+'/chess/lobby.html');await page.locator('.deal-tower[data-ready=true]').waitFor();await page.waitForLoadState('networkidle')
 assert.equal(await page.locator('.deal-tower-structure>.deal-tower-section').count(),5);assert.deepEqual(await page.locator('.deal-tower-header .deal-tower-cap-face').allTextContents(),Array(4).fill('DEALTHE COLLECTION'))
 const ids=await page.locator('[data-offer-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.offerId));assert.equal(ids.length,12);assert.equal(new Set(ids).size,12)
 const available=new Set([...economy.dailyDeals.map(d=>'item:'+d.itemId),...economy.featured.map(id=>'item:'+id),...economy.seasonalItems.map(id=>'item:'+id),...economy.caseOffers.map(c=>'case:'+c.id)]);assert.ok(ids.every(id=>available.has(id)))
 for(const deal of economy.dailyDeals){const face=page.locator(`[data-offer-id="item:${deal.itemId}"]`);assert.match(await face.locator('.deal-tower-price').innerText(),new RegExp(deal.price.toLocaleString()));assert.match(await face.locator('.deal-tower-tag').innerText(),/25%/)}
 assert.equal(await page.locator('.home-deal:not([inert])').count(),3);assert.equal(await page.locator('.deal-tower-pause').isVisible(),false)
 for(let row=0;row<3;row++){const seen=new Set();for(let turn=0;turn<4;turn++){const slot=page.locator(`[data-deal-slot="${row}"]`);seen.add(await slot.locator('.home-deal:not([inert])').getAttribute('data-offer-id'));await page.getByRole('button',{name:`Next product in slot ${row+1}`,exact:true}).click()}assert.equal(seen.size,4)}
 await page.screenshot({path:'/tmp/home-tower-desktop.png',fullPage:true})
 for(const [width,height,maxHeight]of [[1440,960,541],[1280,800,541],[1100,640,480],[768,900,470],[390,844,484],[320,844,484]]){
  await page.setViewportSize({width,height});await page.locator('.home-deals').scrollIntoViewIfNeeded();await page.waitForTimeout(100);const box=await page.locator('.home-deals').boundingBox();assert.ok(box.height>350&&box.height<=maxHeight+2,`compact footprint at ${width}: ${box.height}`)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`no horizontal overflow at ${width}`)
  for(let row=0;row<3;row++){await page.getByRole('button',{name:`Next product in slot ${row+1}`,exact:true}).click();const slot=page.locator(`[data-deal-slot="${row}"]`),face=slot.locator('.home-deal:not([inert])');assert.equal(await face.isVisible(),true);const dimensions=await face.evaluate(el=>({height:el.clientHeight,content:el.scrollHeight}));assert.ok(dimensions.content<=dimensions.height+2,`product content fits at ${width}`)}
  if(width===390||width===1100)await page.screenshot({path:`/tmp/home-tower-${width}.png`,fullPage:true})
 }
 // A refresh must preserve the selected face rather than reset all three sections every minute.
 const front=await page.locator('[data-deal-slot="0"]').getAttribute('data-face');await page.clock.install();await page.clock.fastForward(61000);await page.waitForLoadState('networkidle');assert.equal(await page.locator('[data-deal-slot="0"]').getAttribute('data-face'),front)
 await page.getByRole('link',{name:'Open the shop',exact:true}).click();await page.waitForURL('**/collection.html#shop');await page.locator('#shop').waitFor();assert.deepEqual(errors,[])
})
test('rotors visibly turn at separate times, stop on hover and pause, and resume smoothly',async t=>{
 const {base,browser}=await fixture(t),ctx=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'no-preference'}),page=await ctx.newPage()
 await ctx.request.post(base+'/api/signup',{data:{username:'TowerMotion',password:'p',confirm:'p'}});await page.goto(base+'/chess/lobby.html');await page.locator('.deal-tower[data-ready=true]').waitFor()
 await page.waitForFunction(()=>document.querySelector('[data-deal-slot="0"]').dataset.turning==='true',{},{timeout:10000});await page.waitForTimeout(450)
 const motion=await page.locator('.deal-tower-rotor').evaluateAll(nodes=>nodes.map(n=>({transform:getComputedStyle(n).transform,matrix:new DOMMatrixReadOnly(getComputedStyle(n).transform).m11,animations:n.getAnimations().map(a=>({duration:a.effect.getTiming().duration,state:a.playState}))})))
 assert.ok(motion[0].matrix>.02&&motion[0].matrix<.98,'a genuinely intermediate 3D angle is visible');assert.ok(new Set(motion.map(m=>m.transform)).size>1,'sections turn independently');assert.ok(motion[0].animations[0].duration>=1350)
 await page.screenshot({path:'/tmp/home-tower-turn.png',fullPage:true});await page.getByRole('button',{name:'Pause deals rotation',exact:true}).click();await page.waitForTimeout(100);const frozen=await page.locator('.deal-tower-rotor').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).transform));await page.waitForTimeout(350);assert.deepEqual(await page.locator('.deal-tower-rotor').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).transform)),frozen)
 await page.getByRole('button',{name:'Resume deals rotation',exact:true}).click();await page.waitForTimeout(350);assert.notDeepEqual(await page.locator('.deal-tower-rotor').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).transform)),frozen)
 await page.waitForFunction(()=>document.querySelector('[data-deal-slot="0"]').dataset.turning==='false');await page.locator('[data-deal-slot="0"]').hover();const face=await page.locator('[data-deal-slot="0"]').getAttribute('data-face');await page.waitForTimeout(8500);assert.equal(await page.locator('[data-deal-slot="0"]').getAttribute('data-face'),face)
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.deal-tower-pause').isVisible(),false);assert.equal(await page.locator('.home-deal:not([inert])').count(),3)
})
