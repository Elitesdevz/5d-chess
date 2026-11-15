import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {chromium} from 'playwright'
import {ChessStore} from '../server/storage.ts'
import {createApplication} from '../server/application.ts'
import {initialState,index} from '../src/model.ts'

test('five AI characters, playable Classic/Live duels, private plans and visible victory rewards on desktop/mobile',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'chess-ai-ui-')),store=new ChessStore(dir),app=createApplication(store),server=createServer(app.handle)
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']})
 t.after(async()=>{app.drain();await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections()});store.close();await rm(dir,{recursive:true,force:true})})
 const context=await browser.newContext({viewport:{width:1440,height:950},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await context.request.post(base+'/api/signup',{data:{username:'Player',password:'p',confirm:'p'}})
 await page.goto(base+'/chess/lobby.html');await page.locator('.home-deal').first().waitFor();await page.getByRole('button',{name:/Play with AI/}).click()
 await page.locator('.ai-card').nth(4).waitFor();assert.equal(await page.locator('.ai-card').count(),5)
 assert.deepEqual(await page.locator('.ai-card h3').allTextContents(),['Pip','Brass','Iris','Vesper','Orion'])
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 await page.screenshot({path:'/tmp/chess-ai-gallery-desktop.png'})
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/chess-ai-gallery-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 await page.setViewportSize({width:1440,height:950});await page.locator('#ai-movement').selectOption('classic')
 await page.getByRole('button',{name:'Challenge Pip',exact:true}).click();await page.waitForURL(/online.html\?code=/)
 const code=new URL(page.url()).searchParams.get('code'),path=base+'/api/games/'+code
 for(let i=0;i<60;i++){const room=await(await context.request.get(path)).json();if(!room.ai.thinking)break;await page.waitForTimeout(50)}
 await page.reload();await page.getByRole('button',{name:'Submit turn',exact:true}).waitFor()
 assert.match(await page.locator('#online-mode').innerText(),/AI DUEL.*CLASSIC.*UNRATED/)
 await page.getByRole('button',{name:'Offer draw',exact:true}).click();await page.getByText('Pip declines the draw. There is still a game to play.',{exact:true}).waitFor()
 // Use actual canvas input to submit a legal opening and wait for the AI reply.
 const opening=await(await context.request.get(path)).json()
 await page.getByRole('button',{name:'Focus player',exact:true}).click();await page.waitForTimeout(150)
 const square=async(x,y)=>{const box=await page.locator('#scene').boundingBox(),scale=Number((await page.locator('#scale').innerText()).replace('%',''))/100;await page.locator('#scene').click({position:{x:box.width/2+(x+.5-7)*32*scale,y:box.height/2+((y+.5-7)*32-2)*scale}})}
 await square(4,10);await square(5,8);await page.getByRole('button',{name:'Submit turn',exact:true}).click()
 let after
 for(let i=0;i<80;i++){after=await(await context.request.get(path)).json();if(!after.ai.thinking&&after.state.round>=opening.state.round+2)break;await page.waitForTimeout(50)}
 assert.equal(after.state.turn,'red');assert.equal(after.state.round,opening.state.round+2)
 // Legal final-position fixture only in this test's isolated database.
 store.transaction(unit=>{const room=unit.rooms.get(code),s=initialState(2,'classic',['red','yellow']),cells=Array(196).fill(null);for(const[x,y,player,kind]of[[3,10,'red','K'],[7,5,'red','R'],[7,3,'yellow','K']])cells[index({x,y})]={player,kind,moved:true};room.state={...s,round:100,universes:[{...s.universes[0],boards:[{...s.universes[0].boards[0],cells}]}]};room.results=[];room.journal=[];room.locked={}})
 await page.reload();await page.getByRole('button',{name:'Focus player',exact:true}).click();await page.waitForTimeout(150);await square(7,5);await square(7,3);await page.getByRole('button',{name:'Submit turn',exact:true}).click()
 await page.getByText('Victory · +60 coins. Next win today: 30 coins.',{exact:true}).waitFor()
 const me=await(await context.request.get(base+'/api/me')).json();assert.equal(me.profile.coins,540);assert.equal(me.profile.rating.value,1200)
 await page.getByRole('link',{name:'Choose your next challenge'}).click();await page.locator('[data-ai=pip]').waitFor();assert.match(await page.locator('[data-ai=pip] .ai-prize').innerText(),/\+30/)
 // Verify that a real Live match is ready, has a committed hidden AI plan and is resumable.
 await page.locator('#ai-movement').selectOption('live');await page.getByRole('button',{name:'Challenge Orion',exact:true}).click();await page.waitForURL(/online.html\?code=/)
 const liveCode=new URL(page.url()).searchParams.get('code')
 for(let i=0;i<80;i++){const room=await(await context.request.get(base+'/api/games/'+liveCode)).json();if(!room.ai.thinking){assert.equal(room.locked.yellow,true);assert.equal(room.rated,false);break}await page.waitForTimeout(50)}
 await page.reload();await page.getByRole('button',{name:'Focus player',exact:true}).click();await page.waitForTimeout(150);await square(4,10);await square(5,8)
 await page.getByRole('button',{name:'Lock orders',exact:true}).click()
 const live=await(await context.request.get(base+'/api/games/'+liveCode)).json();assert.equal(live.state.round,2)
 await page.setViewportSize({width:390,height:844});if(await page.locator('#panel-handle').isVisible())await page.locator('#panel-handle').click()
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Resign',exact:true}).click();await page.getByText('Yellow wins.',{exact:true}).waitFor()
 assert.deepEqual(errors,[])
})
