import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {chromium} from 'playwright'
import worker from './helpers/healthy-frontend.mjs'
import {initialState} from '../src/model.ts'
async function fixture(t){const server=createServer(async(req,res)=>{const r=await worker.fetch(new Request('http://localhost'+req.url));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()))});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,args:['--no-sandbox']});t.after(async()=>{await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections()})});return {browser,base:'http://127.0.0.1:'+server.address().port}}
test('flat default, full-window canvas, movable island, and guest move/replay preserve zoom',async t=>{
 const {browser,base}=await fixture(t),page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/me',r=>r.fulfill({json:{user:null}}))
 await page.goto(base+'/chess/');await page.getByRole('button',{name:'Start new game'}).waitFor();await page.getByRole('button',{name:'Focus player',exact:true}).click()
 assert.equal(await page.locator('#scene').getAttribute('data-view'),'flat');assert.equal(await page.locator('#factions .match-player').count(),2)
 const area=await page.locator('#viewport').boundingBox(),island=await page.locator('#sidebar').boundingBox();assert.equal(area.width,1440);assert.ok(island.x<area.width&&island.x+island.width<=1440)
 const handle=await page.locator('#panel-handle').boundingBox();await page.mouse.move(handle.x+60,handle.y+20);await page.mouse.down();await page.mouse.move(handle.x+20,handle.y+65);await page.mouse.up();assert.ok((await page.locator('#sidebar').boundingBox()).x<island.x-20)
 await page.getByRole('button',{name:'Focus player',exact:true}).click()
 const square=async(x,y)=>{const scale=Number((await page.locator('#scale').innerText()).replace('%',''))/100,card=await page.locator('.board-roster').boundingBox();await page.locator('#scene').click({position:{x:card.x-area.x+((x-3+.5)*32-256-16)*scale,y:card.y-area.y+(y-3+.5)*32*scale}})}
 await square(4,10);await square(5,8);assert.equal(await page.locator('.order-list li').count(),1)
 const zoom=await page.locator('#scale').innerText();await page.getByRole('button',{name:/Lock orders/}).click();await page.getByRole('button',{name:/Begin next round/}).waitFor();await page.waitForTimeout(100);assert.equal(await page.locator('#scale').innerText(),zoom)
 await page.getByRole('button',{name:'Previous round',exact:true}).click();assert.equal(await page.locator('#scale').innerText(),zoom)
 await page.getByRole('button',{name:'Return to live',exact:true}).click();assert.equal(await page.locator('#scale').innerText(),zoom)
 await page.screenshot({path:'/tmp/chess-islands-desktop.png'})
 for(const width of [768,390,320]){await page.setViewportSize({width,height:844});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`/tmp/chess-islands-${width}.png`})}
 await page.getByRole('button',{name:'Use angled 2.5D view'}).click();await page.reload();assert.equal(await page.locator('#scene').getAttribute('data-view'),'angled');assert.deepEqual(errors,[])
})
test('online header and board attachment show real public identities without server changes',async t=>{
 const{browser,base}=await fixture(t),page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'})
 await page.route('**/api/me',r=>r.fulfill({json:{user:null}}))
 await page.route('**/api/profile?user=*',r=>{const name=new URL(r.request().url()).searchParams.get('user');return r.fulfill({json:{name,rating:name==='Alice'?1428:1590,avatar:'icon-laurel'}})})
 await page.route('**/api/games/TEST',r=>r.fulfill({json:{code:'TEST',title:'Friendly rivalry',seats:{red:'Alice',yellow:'Bob'},seat:'red',state:initialState(2,'live'),results:[],journal:[],locked:{},waiting:false,finished:false,rated:true}}))
 await page.goto(base+'/chess/online.html?code=TEST');await page.locator('#seats').getByText('1,428 Elo',{exact:true}).waitFor();await page.locator('.board-roster').getByText('1,590 Elo',{exact:true}).waitFor();assert.equal(await page.locator('#seats').getByRole('link',{name:'Bob',exact:true}).getAttribute('href'),'/chess/profile.html?user=Bob');await page.screenshot({path:'/tmp/chess-islands-online.png'})
})
