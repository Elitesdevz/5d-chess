import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {chromium} from 'playwright'
import {ChessStore} from '../server/storage.ts'
import {createApplication} from '../server/application.ts'

test('guest landing plays Pip locally and gates account features',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'chess-guest-')),store=new ChessStore(dir),app=createApplication(store),server=createServer(app.handle)
 await new Promise(r=>server.listen(0,'127.0.0.1',r))
 const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[]
 t.after(async()=>{app.drain();await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections()});store.close();await rm(dir,{recursive:true,force:true})})
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto(`http://127.0.0.1:${server.address().port}/chess/`)
 await page.getByRole('button',{name:'Start new game'}).click()
 await page.getByRole('button',{name:'3 players'}).click()
 assert.equal(await page.getByRole('link',{name:'Log in or sign up'}).getAttribute('href'),'/chess/login.html')
 await page.getByRole('button',{name:'Not now'}).click()
 await page.getByRole('link',{name:'Home',exact:true}).click()
 await page.getByRole('button',{name:'Not now'}).click()
 await page.getByRole('button',{name:'Explore other sections'}).click()
 await page.getByRole('link',{name:'Shop',exact:true}).click()
 await page.getByRole('button',{name:'Not now'}).click()
 await page.getByRole('button',{name:'Focus player'}).click()
 await page.waitForTimeout(150)
 const square=async(x,y)=>{const box=await page.locator('#scene').boundingBox(),scale=Number((await page.locator('#scale').innerText()).replace('%',''))/100;await page.locator('#scene').click({position:{x:box.width/2+((x+.5-7)*32+.16*((y+.5-7)*32-2))*scale,y:box.height/2+((y+.5-7)*32-2)*.82*scale}})}
 await square(4,10);await square(5,8);await page.getByRole('button',{name:'Lock orders'}).click()
 await page.getByRole('button',{name:'Begin next round'}).waitFor()
 assert.equal(await page.locator('.outcome').count(),2)
 await page.getByRole('button',{name:'Begin next round'}).click()
 await page.getByText('Your move',{exact:true}).waitFor()
 await page.reload();await page.getByText('Your move',{exact:true}).waitFor()
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:844})
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  const actions=await page.locator('.header-actions').boundingBox();assert.ok(actions.x>=0&&actions.x+actions.width<=width+1)
  await page.screenshot({path:`/tmp/chess-merged-guest-${width}.png`})
 }
 assert.deepEqual(errors,[])
})
