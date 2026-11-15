import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {chromium} from 'playwright'
import worker from '../.cloudflare/worker.mjs'
import{newSession,encode,SAVE_KEY}from'../src/session.ts'
import{initialState,boardBounds}from'../src/model.ts'
import{resolveRound}from'../src/resolve.ts'
import{legalMoves}from'../src/moves.ts'
async function fixture(t){const http=createServer(async(req,res)=>{const r=await worker.fetch(new Request('http://localhost'+req.url));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()))});await new Promise(r=>http.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,args:['--no-sandbox']});t.after(async()=>{await browser.close();await new Promise(r=>{http.close(r);http.closeAllConnections()})});return {browser,base:'http://127.0.0.1:'+http.address().port}}
async function clickSquare(page,x,y,count){const box=await page.locator('#scene').boundingBox(),scale=Number((await page.locator('#scale').innerText()).replace('%',''))/100,view=await page.locator('#scene').getAttribute('data-view'),bounds=boardBounds(initialState(count));const dx=(x+.5-(bounds.minX+bounds.maxX+1)/2)*32,dy=(y+.5-(bounds.minY+bounds.maxY+1)/2)*32-2;await page.locator('#scene').click({position:{x:box.width/2+(dx+(view==='angled'?.16:0)*dy)*scale,y:box.height/2+dy*(view==='angled'?.82:1)*scale}})}

test('2.5D room supports accurate moves for every board size, top-down preferences, and compact phone/tablet layouts',async t=>{
 const{browser,base}=await fixture(t),page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/me',r=>r.fulfill({json:{user:null}}))
 for(const count of[2,3,4]){
  await page.goto(`${base}/chess/?local=1&players=${count}&movement=live`);await page.getByRole('button',{name:'Use top-down view'}).waitFor();assert.equal(await page.locator('#scene').getAttribute('data-view'),'angled')
  assert.equal(await page.locator('#factions .faction').count(),count)
  await page.getByRole('button',{name:'Focus player',exact:true}).click();await clickSquare(page,4,count===2?10:13,count);await page.locator('#selection-info').getByText('Knight',{exact:true}).waitFor();await clickSquare(page,5,count===2?8:11,count)
  assert.equal(await page.locator('.order-list li').count(),1);assert.match(await page.locator('.board-navigator').innerText(),/Queued/)
  const overlap=await page.evaluate(()=>{const a=document.querySelector('#viewport').getBoundingClientRect(),b=document.querySelector('#sidebar').getBoundingClientRect();return a.right>b.left});assert.equal(overlap,false)
  await page.screenshot({path:`/tmp/chess-room-${count}-desktop.png`})
 }
 await page.getByRole('button',{name:'Use top-down view'}).click();assert.equal(await page.locator('#scene').getAttribute('data-view'),'flat');await page.reload();assert.equal(await page.locator('#scene').getAttribute('data-view'),'flat');if(await page.locator('[data-dialog=ready]').isVisible())await page.locator('[data-dialog=ready]').click();await page.getByRole('button',{name:'Use angled 2.5D view'}).click()
 for(const [width,height]of[[768,1024],[390,844],[320,760],[844,390]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  assert.equal(await page.locator('#mode-label').isVisible(),true)
  const tools=await page.locator('.map-tools').boundingBox();assert.ok(tools.x>=0&&tools.x+tools.width<=width+1);assert.ok(tools.y+tools.height<=height)
  if(height>520){await page.locator('#panel-handle').click();assert.equal(await page.locator('#panel-handle').getAttribute('aria-expanded'),'true');await page.locator('#panel-handle').click()}
  await page.locator('.layer-control summary').click();await page.getByRole('button',{name:'Temporal Rifts',exact:true}).click();await page.keyboard.press('Escape');assert.equal(await page.locator('.layer-control').getAttribute('open'),null)
  await page.screenshot({path:`/tmp/chess-room-${width}x${height}.png`})
 }
 assert.deepEqual(errors,[])
})

test('angled multiverse navigator supports a compulsory board and an optional future order without changing saved rules',async t=>{
 const{browser,base}=await fixture(t),context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'}),page=await context.newPage(),s=newSession(2,'live'),at=(x,y,t=0,u=0)=>({x,y,t,u})
 const move=(state,a,b)=>{const m=legalMoves(state,a,b)[0];assert.ok(m);return {player:m.player,from:m.from,to:m.to,route:m.route}}
 for(const specs of[[[at(4,10),at(5,8)],[at(4,3),at(5,5)]],[[at(5,8,1),at(7,8,0)],[at(5,5,1),at(6,7,1)]]]){const state=s.frames.at(-1),orders=specs.map(([a,b])=>move(state,a,b)),r=resolveRound(state,orders);assert.deepEqual(r.rejected,[]);s.frames.push(r.state);s.results.push(r);s.journal.push(orders)}
 await context.addInitScript(([key,save])=>localStorage.setItem(key,save),[SAVE_KEY+'/live/2',encode(s)])
 await page.goto(base+'/chess/?local=1&players=2&movement=live');await page.locator('.board-chip').nth(1).waitFor();assert.equal(await page.locator('.board-chip.required').count(),1)
 await page.locator('.board-chip').filter({hasText:'U1'}).click();await clickSquare(page,6,9,2);await clickSquare(page,6,8,2)
 await page.locator('.board-chip').filter({hasText:'U0'}).click();await clickSquare(page,7,9,2);await clickSquare(page,7,8,2)
 assert.equal(await page.locator('.order-list li').count(),2);assert.equal(await page.locator('.board-chip.queued').count(),2)
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE_KEY+'/live/2');assert.equal(saved.draft.length,2)
 await page.screenshot({path:'/tmp/chess-room-multiverse.png'})
})

test('signed-in match header keeps wallet and profiles readable while app navigation stays in Explore',async t=>{
 const{browser,base}=await fixture(t),page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/api/me',r=>r.fulfill({json:{user:'Designer',profile:{name:'Designer',settings:{movement:'live',players:4,avatar:'default',moveNotifications:true},rating:{value:1320,games:8},coins:8240,loadout:{icon:'default',pieces:{}}}}}))
 await page.route('**/api/notifications',r=>r.fulfill({json:{items:[],unread:0}}))
 await page.goto(base+'/chess/?local=1&players=4&movement=live');await page.locator('.header-wallet [data-coins]').getByText('8,240',{exact:true}).waitFor()
 for(const[width,height]of[[1440,960],[390,844],[320,760]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(100)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  const wallet=await page.locator('.header-wallet').boundingBox(),account=await page.locator('#account-area').boundingBox(),nav=await page.locator('.economy-nav').boundingBox(),home=await page.locator('.match-home').boundingBox();assert.ok(wallet.x+wallet.width<=account.x+1);assert.ok(home.x+home.width<=nav.x+1);assert.ok(nav.x+nav.width<=wallet.x+1)
  assert.equal(await page.getByRole('link',{name:'Your player profile',exact:true}).isVisible(),true)
  await page.locator('.match-explore summary').click();assert.equal(await page.getByRole('link',{name:'Inventory',exact:true}).isVisible(),true);await page.keyboard.press('Escape')
  await page.screenshot({path:`/tmp/chess-room-account-${width}.png`})
 }
 assert.deepEqual(errors,[])
})

test('online selection explicitly warns before a suicidal Live king capture',async t=>{
 const{browser,base}=await fixture(t),page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'}),s=initialState(2,'live'),cells=Array(196).fill(null)
 for(const[x,y,player,kind]of[[6,6,'red','K'],[6,5,'yellow','P'],[10,3,'yellow','K']])cells[y*14+x]={player,kind,moved:true}
 s.universes[0].boards[0].cells=cells
 await page.route('**/api/me',r=>r.fulfill({json:{user:null}}))
 await page.route('**/api/games/TEST',r=>r.fulfill({json:{code:'TEST',title:'King safety',seats:{red:'Designer',yellow:'Opponent'},seat:'red',state:s,results:[],journal:[],locked:{},waiting:false,finished:false,rated:true}}))
 await page.goto(base+'/chess/online.html?code=TEST');await page.getByRole('button',{name:'Focus player',exact:true}).click();await clickSquare(page,6,6,2)
 const box=await page.locator('#scene').boundingBox(),scale=Number((await page.locator('#scale').innerText()).replace('%',''))/100,dy=(5+.5-7)*32-2,dx=(6+.5-7)*32
 await page.locator('#scene').hover({position:{x:box.width/2+(dx+.16*dy)*scale,y:box.height/2+dy*.82*scale}})
 await page.getByText('King collision · Your faction would be eliminated',{exact:true}).waitFor()
})

test('angled picking stays aligned after cursor-centred zoom and a physical board pan',async t=>{
 const{browser,base}=await fixture(t),page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'})
 await page.route('**/api/me',r=>r.fulfill({json:{user:null}}));await page.goto(base+'/chess/?local=1&players=2&movement=live');await page.getByRole('button',{name:'Focus player',exact:true}).click()
 const box=await page.locator('#scene').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,-100);await page.waitForTimeout(60)
 const scale=Number((await page.locator('#scale').innerText()).replace('%',''))/100,point=(x,y)=>{const dx=(x+.5-7)*32,dy=(y+.5-7)*32-2;return {x:box.width/2+(dx+.16*dy)*scale+50,y:box.height/2+dy*.82*scale+30}}
 await page.mouse.move(box.x+20,box.y+20);await page.mouse.down();await page.mouse.move(box.x+70,box.y+50);await page.mouse.up()
 await page.locator('#scene').click({position:point(6,9)});await page.locator('#selection-info').getByText('Pawn',{exact:true}).waitFor();await page.locator('#scene').click({position:point(6,8)})
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE_KEY+'/live/2');assert.equal(saved.draft[0].to.x,6);assert.equal(saved.draft[0].to.y,8)
})
