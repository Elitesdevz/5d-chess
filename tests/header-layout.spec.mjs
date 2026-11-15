import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {chromium} from 'playwright'
import {ChessStore} from '../server/storage.ts'
import {createApplication} from '../server/application.ts'

test('signed-in game header keeps wallet and account separate',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'chess-header-')),store=new ChessStore(dir),app=createApplication(store),server=createServer(app.handle)
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`
 const browser=await chromium.launch({headless:true}),context=await browser.newContext(),page=await context.newPage()
 t.after(async()=>{app.drain();await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections()});store.close();await rm(dir,{recursive:true,force:true})})
 await context.request.post(base+'/api/signup',{data:{username:'HeaderTester',password:'p',confirm:'p'}})
 await page.goto(base+'/chess/?local=1&players=2');await page.locator('.account-profile-link').waitFor()
 for(const width of [1440,1100,800,600,390]){
  await page.setViewportSize({width,height:900})
  const wallet=await page.locator('.header-wallet').boundingBox(),account=await page.locator('.account-profile-link').boundingBox()
  assert.ok(wallet && account,`header groups visible at ${width}`)
  assert.ok(wallet.x+wallet.width<=account.x || account.x+account.width<=wallet.x || wallet.y+wallet.height<=account.y || account.y+account.height<=wallet.y,`wallet overlaps account at ${width}`)
 }
})
