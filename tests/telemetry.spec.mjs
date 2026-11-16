import test from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {mkdtemp,rm} from 'node:fs/promises'
import {createServer} from 'node:http'
import {ChessStore} from '../server/storage.ts'
import {createApplication} from '../server/application.ts'
import {UsageStore} from '../server/telemetry.ts'
test('real UI clicks, navigation, balance snapshots and request correlation reach the bounded account record',async t=>{
 const dir=await mkdtemp('/tmp/chess-usage-ui-'),store=new ChessStore(dir),app=createApplication(store),server=createServer(app.handle);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,args:['--no-sandbox']}),ctx=await browser.newContext({reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
 t.after(async()=>{app.drain();await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections()});store.close();await rm(dir,{recursive:true,force:true})})
 await ctx.request.post(base+'/api/signup',{data:{username:'UsageReader',password:'not-to-be-logged',confirm:'not-to-be-logged'}});const began=page.waitForResponse(r=>r.url().endsWith('/api/telemetry')&&r.request().method()==='POST');await page.goto(base+'/chess/lobby.html');await page.locator('.deal-tower[data-ready=true]').waitFor();await began
 await page.getByRole('button',{name:'Local',exact:true}).click();await page.getByRole('button',{name:'Online',exact:true}).click();await page.getByRole('button',{name:'Create game',exact:true}).click();await page.locator('#game-title').fill('secret-text-must-not-be-logged');await page.locator('#game-password').fill('secret-password-must-not-be-logged');await page.locator('#game-players').selectOption('3')
 await page.evaluate(()=>{const square=document.createElement('button');square.dataset.square='A1';square.textContent='Excluded square';document.body.append(square);square.click();square.remove()})
 await page.locator('#make-form').getByRole('button',{name:'Create game',exact:true}).click();await page.waitForURL('**/online.html?code=*');await page.getByRole('link',{name:'Home',exact:true}).click();await page.locator('.deal-tower[data-ready=true]').waitFor();await page.getByRole('link',{name:'Open the shop',exact:true}).click();await page.waitForURL('**/collection.html#shop');await page.waitForTimeout(3400)
 const log=new UsageStore(dir+'/telemetry.sqlite');try{const events=log.events('UsageReader'),clicks=events.filter(e=>e.source==='client'&&e.kind==='click');assert.ok(clicks.some(e=>e.label==='Create game'));assert.ok(clicks.some(e=>e.label==='Open the shop'));assert.ok(events.some(e=>e.kind==='navigation'&&e.page.includes('collection.html')));assert.ok(events.some(e=>e.kind==='balance'&&typeof e.coins==='number'));assert.ok(events.some(e=>e.source==='server'&&e.requestId));assert.doesNotMatch(JSON.stringify(events),/not-to-be-logged|must-not-be-logged|Excluded square/);assert.ok(log.usage('UsageReader').bytes<=10_000_000);assert.deepEqual(errors,[])}finally{log.close()}
})
