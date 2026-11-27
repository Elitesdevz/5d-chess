import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {chromium} from 'playwright'
import {ChessStore} from '../server/storage.ts'
import {createApplication} from '../server/application.ts'
import {ensureAccount} from '../server/accounts.ts'
import {hash} from '../server/security.ts'
import {join} from 'node:path'
import {mkdir} from 'node:fs/promises'

test('Master sees hi once on return; coin displays round without changing the wallet',async t=>{
 const store=new ChessStore('.',{memory:true})
 store.transaction(u=>{
  for(const name of ['DIMA','Master'])u.users.add(name,ensureAccount({name,salt:'fixture',hash:hash('p','fixture'),wallet:{starterGranted:true,coins:123.7891,inventory:[],loadout:{icon:'default',pieces:{}}}}))
 })
 const app=createApplication(store),server=createServer(app.handle)
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 const browser=await chromium.launch({headless:true}),context=await browser.newContext(),page=await context.newPage()
 t.after(async()=>{app.drain();await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));store.close()})
 const base=`http://127.0.0.1:${server.address().port}`
 await context.request.post(base+'/api/login',{data:{username:'Master',password:'p'}})
 await page.goto(base+'/chess/?local=1&players=2')
 const warning=page.locator('#notification-popover')
 await warning.waitFor({state:'visible'})
 assert.equal(await warning.locator('.popover-notice strong').first().textContent(),'Warning')
 assert.equal(await warning.locator('.popover-notice small').first().textContent(),'hi')
 await page.waitForFunction(async()=>!(await (await fetch('/api/notifications')).json()).items.some(n=>n.kind==='warning'&&!n.read))
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900})
  assert.equal(await page.locator('[data-coins]').first().textContent(),'124')
  const box=await warning.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width)
  if(process.env.ACCOUNT_UPDATES_CAPTURE_DIR){await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));await mkdir(process.env.ACCOUNT_UPDATES_CAPTURE_DIR,{recursive:true});await page.screenshot({path:join(process.env.ACCOUNT_UPDATES_CAPTURE_DIR,`warning-${width}.png`)})}
 }
 await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/notifications')),page.reload()]);await page.locator('.account-profile-link').waitFor()
 assert.equal(await warning.isVisible(),false)
 const master=await (await context.request.get(base+'/api/me')).json()
 assert.equal(master.profile.coins,123.7891)
 await context.request.post(base+'/api/login',{data:{username:'DIMA',password:'p'}})
 await page.goto(base+'/chess/?local=1&players=2');await page.locator('.account-profile-link').waitFor()
 assert.equal(await page.locator('[data-coins]').first().textContent(),'2,124')
 assert.equal(await warning.isVisible(),false)
 assert.equal((await (await context.request.get(base+'/api/me')).json()).profile.coins,2123.7891)
})
