import {observeCity,browserWalker} from './civic-controls.mjs'
import {cellPosition,entrances} from '../src/world/civic-venues.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {chromium} from 'playwright'
import {ChessStore} from '../server/storage.ts'
import {createApplication} from '../server/application.ts'
import {book} from '../server/custody.ts'

test('play the expansion from signup, the city hotbar, and a permanent cell without WebGL', {timeout:240000},async()=>{
  const store=new ChessStore('.',{memory:true}),app=createApplication(store),server=createServer(app.handle)
  await new Promise(r=>server.listen(0,'127.0.0.1',r))
  let browser
  try{
    const base='http://127.0.0.1:'+server.address().port
    browser=await chromium.launch({args:['--disable-webgl','--no-sandbox']})
    const page=await browser.newPage({viewport:{width:1100,height:790}}),errors=[]
    await observeCity(page)
    page.on('pageerror',e=>errors.push(e.message))
    await page.goto(base+'/chess/login.html')
    await page.getByRole('button',{name:'Create an account'}).click()
    await page.locator('#username').fill('Map Walker');await page.locator('#password').fill('fixture')
    await page.locator('#confirm').fill('fixture');await page.locator('#auth-submit').click()
    await page.waitForURL('**/chess/lobby.html')
    await page.getByRole('link',{name:'City',exact:true}).first().click()
    const canvas=page.locator('#world-canvas')
    await page.locator('#city-world[data-flat=true][data-zone=city]').waitFor()
    const walker=browserWalker(page)
    const start=await page.evaluate(()=>window.walkObservation.view.you)
    assert.deepEqual([start.x,start.z],[0,8])
    await walker.outside({x:-24,z:5.67})
    await walker.walk({x:-24,z:4.16})
    await page.locator('#city-world[data-zone=bank]').waitFor()
    async function walkToPrompt(label){
      await canvas.focus();await page.keyboard.down('w')
      try{await page.getByRole('button',{name:new RegExp(label)}).waitFor({timeout:6500})}
      finally{await page.keyboard.up('w')}
      await page.keyboard.press('e')
    }
    await walkToPrompt('Withdraw or deposit')
    await page.getByLabel('Quantity').fill('50')
    await page.getByRole('button',{name:'Withdraw',exact:true}).click()
    await page.getByText(/Carried cash 50/).waitFor()
    await page.getByLabel('Quantity').fill('10')
    await page.getByRole('button',{name:'Deposit',exact:true}).click()
    await page.getByText(/Carried cash 40/).waitFor()
    await page.getByRole('button',{name:'Close',exact:true}).click()
    assert.equal(await page.locator('.arcade-slots button').count(),9)
    await walker.walk({x:-24,z:5.66})
    await walker.outside(entrances.gunshop)
    await walker.use('enter-gunshop')
    await page.locator('#city-world[data-zone=gunshop]').waitFor()
    await walkToPrompt('Visit the armory counter')
    await page.getByRole('button',{name:/Buy Pistol for 25 cash/}).click()
    await page.locator('.arcade-slots button').filter({hasText:'Pistol'}).waitFor()
    await page.getByRole('button',{name:'Close',exact:true}).click()
    await page.locator('.arcade-slots button').filter({hasText:'Pistol'}).click()
    await page.getByRole('button',{name:'Fire',exact:true}).click()
    await page.getByText(/HP 100\/100 · ★/).waitFor()
    const visitor=await browser.newContext()
    const signup=await visitor.request.post(base+'/api/signup',{data:{username:'Visitor',password:'local',confirm:'local'}})
    assert.equal(signup.status(),201)
    const match=await (await page.request.post(base+'/api/games',{data:{playerCount:2}})).json()
    assert.equal((await visitor.request.post(base+'/api/games/'+match.code+'/join',{data:{}})).status(),200)
    store.transaction(tx=>book(tx,'Map Walker',5,Date.now(),true,true))
    await page.locator('dialog.cell-screen[open]').waitFor()
    assert.equal(await page.locator('#cell-title').innerText(),'Inmate 01')
    await page.getByRole('button',{name:'Look around cell'}).click()
    const center=cellPosition(1)
    await canvas.focus();await page.keyboard.down('d')
    try{
      await page.waitForFunction(x=>Math.abs(window.walkObservation.view.you.x-x)<.02,center.x+.96)
      await page.waitForTimeout(240)
    }finally{await page.keyboard.up('d')}
    const frozen=(await (await page.request.get(base+'/api/custody')).json()).custody
    assert.ok(Math.abs(frozen.x-center.x-.96)<.02)
    assert.equal((await page.request.post(base+'/api/world/use',{data:{target:'gallery-down',scene:true}})).status(),423)
    await page.reload()
    await page.locator('#world-canvas[data-zone="precinct:1"]').waitFor()
    assert.equal(await page.evaluate(()=>window.walkObservation.view.you.x),frozen.x)
    await page.getByRole('button',{name:'Jigsaw table',exact:true}).click()
    await page.locator('.tray button').first().waitFor()
    assert.equal(await page.locator('.board button').count(),25)
    const label=await page.locator('.tray button').first().getAttribute('aria-label')
    const piece=Number(label.split(' ').at(-1))-1
    const target=JSON.parse(store.accountJson('Map Walker')).cellPuzzle.tiles[piece]
    await page.locator('.tray button').first().click()
    await page.locator('.board button').nth(Math.floor(target/40)*5+target%40).click()
    await page.getByText('Piece fitted.').waitFor()
    await page.reload();await page.getByRole('button',{name:'Jigsaw table',exact:true}).click()
    await page.getByText(/1\/1000 placed/).waitFor()
    await page.getByRole('button',{name:'Next section'}).click()
    await page.getByText(/Section 2\/40/).waitFor()
    await page.getByRole('button',{name:'Log out',exact:true}).click();await page.waitForURL('**/chess/login.html')
    const observer=await visitor.newPage()
    for(const url of ['/chess/leaderboard.html','/chess/online.html?code='+match.code]){
      await observer.goto(base+url)
      const link=observer.getByRole('link',{name:'Inmate 01',exact:true}).first()
      await link.waitFor()
      assert.ok(!(await observer.locator('body').innerText()).includes('Map Walker'))
      assert.equal(await link.getAttribute('href'),'/chess/profile.html?user=Inmate%2001')
      await link.click();await observer.getByRole('heading',{name:'Inmate 01',exact:true}).waitFor()
    }
    await visitor.close();assert.deepEqual(errors,[])
  }finally{
    await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));app.drain();store.close()
  }
})
