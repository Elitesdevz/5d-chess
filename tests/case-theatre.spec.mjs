import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {build} from 'esbuild'
import {chromium} from 'playwright'
import {ChessStore} from '../server/storage.ts'
import {createApplication} from '../server/application.ts'
import {grant,grantSet,wallet} from '../server/economy.ts'
import {ITEMS,SETS,RARITIES,duplicateRefund,CRATES,crateTickets} from '../src/collection.ts'
import {caseReel} from '../src/case-reel.ts'
test('reel retains the server winner and samples only eligible weighted rewards',()=>{
 for(const crate of CRATES){const ticket=crateTickets(crate)[0],drop={itemId:ticket.item.id,setId:ticket.setId,kind:ticket.setId?undefined:'N'},r=caseReel(crate,drop,()=>.5);assert.equal(r.cards[r.target].item.id,drop.itemId);assert.equal(r.cards[r.target].setId,drop.setId);assert.ok(r.cards.every(c=>crateTickets(crate).some(t=>t.item.id===c.item.id&&t.setId===c.setId)))}
})
test('case theatre lands accurately, styles every rarity and equips, stores, recycles and opens another using real APIs',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'case-theatre-')),store=new ChessStore(dir),app=createApplication(store)
 const compiled=await build({stdin:{contents:`import {revealDrop,requestId} from './src/rewards.ts';import{api}from'./src/shell.ts';window.openDrop=(drop)=>revealDrop(drop,'crate',0,()=>{},'skin-bronze',0,(offer,month)=>api('/economy/case',{case:offer.id,month,offerKey:offer.key,expectedPrice:offer.price,requestId:requestId()}));`,resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'esm',write:false})
 const server=createServer((req,res)=>{if(req.url==='/harness'){res.setHeader('content-type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/chess/styles.css"><link rel="stylesheet" href="/chess/shell.css"><link rel="stylesheet" href="/chess/collection.css"><script type="module" src="/harness.js"></script>')}else if(req.url==='/harness.js'){res.setHeader('content-type','text/javascript');res.end(compiled.outputFiles[0].contents)}else app.handle(req,res)})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,args:['--no-sandbox']}),context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[]
 t.after(async()=>{app.drain();await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections()});store.close();await rm(dir,{recursive:true,force:true})});page.on('pageerror',e=>errors.push(e.message))
 await context.request.post(base+'/api/signup',{data:{username:'CaseTester',password:'p',confirm:'p'}});store.transaction(u=>wallet(u.users.get('CaseTester')).coins=100000)
 await page.goto(base+'/harness');await page.waitForFunction(()=>!!window.openDrop)
 const drop=(item)=>store.transaction(u=>grant(u.users.get('CaseTester'),item,'crate',Date.now(),'N'))
 const item=ITEMS.find(i=>i.type==='skin'&&i.rarity==='legendary'),first=drop(item)
 await page.evaluate(d=>{void window.openDrop(d)},first);await page.locator('[data-phase=landed]').waitFor({timeout:20000});await page.screenshot({path:'/tmp/case-theatre-reel.png'})
 const alignment=await page.locator('.reel-window').evaluate(el=>{const a=el.querySelector('.winning-card').getBoundingClientRect(),b=el.querySelector('.reel-marker').getBoundingClientRect();return Math.abs((a.left+a.right)/2-(b.left+b.right)/2)});assert.ok(alignment<3)
 await page.locator('.reward-result:visible').waitFor();assert.equal(await page.locator('[data-recycle]').isDisabled(),true);await page.screenshot({path:'/tmp/case-theatre-legendary.png'})
 await page.locator('[data-equip]').click();await page.locator('.reward-dialog').waitFor({state:'hidden'});assert.equal(store.snapshot().users.find(u=>u.name==='CaseTester').wallet.loadout.pieces.N,item.id)
 await page.emulateMedia({reducedMotion:'reduce'})
 const second=drop(item),before=store.snapshot().users.find(u=>u.name==='CaseTester').wallet.coins
 await page.evaluate(d=>{void window.openDrop(d)},second);await page.locator('[data-recycle]:enabled').waitFor();await page.locator('[data-recycle]').click();await page.locator('.reward-dialog').waitFor({state:'hidden'});assert.equal(store.snapshot().users.find(u=>u.name==='CaseTester').wallet.coins,before+duplicateRefund(item))
 for(const rarity of RARITIES){const d=drop(ITEMS.find(i=>i.type==='skin'&&i.rarity===rarity));await page.evaluate(d=>{void window.openDrop(d)},d);await page.locator('.reward-result:visible').waitFor();assert.equal(await page.locator('.reward-dialog').getAttribute('data-rarity'),rarity);await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`/tmp/case-theatre-${rarity}-mobile.png`});await page.locator('[data-store]').click();await page.locator('.reward-dialog').waitFor({state:'hidden'})}
 const next=drop(item);await page.evaluate(d=>{void window.openDrop(d)},next);await page.locator('[data-another]:enabled').waitFor();const coins=store.snapshot().users.find(u=>u.name==='CaseTester').wallet.coins,price=(await(await context.request.get(base+'/api/economy')).json()).caseOffers.find(o=>o.id==='skin-bronze').price
 await page.locator('[data-another]').click();await page.waitForFunction(name=>document.querySelector('.reward-result h3')?.textContent!==name,item.name);await page.locator('[data-store]').click();await page.locator('.reward-dialog').waitFor({state:'hidden'});assert.equal(store.snapshot().users.find(u=>u.name==='CaseTester').wallet.coins,coins-price)
 const set=SETS.find(s=>s.skinId),bundle=store.transaction(u=>grantSet(u.users.get('CaseTester'),set));await page.evaluate(d=>{void window.openDrop(d)},bundle);await page.locator('.reward-result:visible').waitFor();await page.setViewportSize({width:320,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'/tmp/case-theatre-set-mobile.png'});await page.locator('[data-equip]').click();await page.locator('.reward-dialog').waitFor({state:'hidden'});assert.equal(store.snapshot().users.find(u=>u.name==='CaseTester').wallet.loadout.pieces.K,set.skinId);assert.deepEqual(errors,[])
})
