import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {chromium} from 'playwright'
import {ChessStore} from '../server/storage.ts'
import {createApplication} from '../server/application.ts'

test('shop categories filter all offer sections and stay out of other views',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'chess-shop-filter-')),store=new ChessStore(dir),app=createApplication(store),server=createServer(app.handle)
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`
 const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage()
 t.after(async()=>{app.drain();await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections()});store.close();await rm(dir,{recursive:true,force:true})})
 await context.request.post(base+'/api/signup',{data:{username:'ShopTester',password:'p',confirm:'p'}})
 await page.goto(base+'/chess/collection.html#shop');await page.locator('#weekly-cases [data-crate-card]').first().waitFor()
 await page.getByRole('button',{name:'Boxes',exact:true}).click()
 assert.ok(await page.locator('#shop [data-crate-card]:visible').count()>0)
 assert.equal(await page.locator('#shop .featured-card:visible, #etc-pack:visible').count(),0)
 await page.getByRole('button',{name:'Sets',exact:true}).click()
 assert.equal(await page.locator('#shop [data-crate-card]:visible, #shop .featured-card:visible').count(),0)
 assert.equal(await page.locator('#etc-pack:visible').count(),1)
 await page.getByRole('button',{name:'Icons',exact:true}).click()
 assert.equal(await page.locator('#shop [data-crate-card]:visible, #etc-pack:visible').count(),0)
 await page.getByRole('button',{name:'All',exact:true}).first().click()
 assert.ok(await page.locator('#shop [data-crate-card]:visible').count()>0)
 await page.getByRole('link',{name:'Inventory',exact:true}).last().click();await page.locator('#shop-filters').waitFor({state:'hidden'})
 await page.getByRole('link',{name:'Shop',exact:true}).last().click();await page.setViewportSize({width:390,height:844})
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
})
