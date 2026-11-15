import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {chromium} from 'playwright'
import {ChessStore} from '../server/storage.ts'
import {createApplication} from '../server/application.ts'
import {PUZZLES} from '../src/puzzle-model.ts'
import {coordName} from '../src/model.ts'
import {NAMES} from '../src/art.ts'
async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'chess-puzzle-ui-')),store=new ChessStore(dir),app=createApplication(store),server=createServer(app.handle)
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,args:['--no-sandbox']})
 t.after(async()=>{app.drain();await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections()});store.close();await rm(dir,{recursive:true,force:true})})
 return {base,browser,store}
}
async function worked(page){await page.getByRole('button',{name:'Need a hint?',exact:true}).click();await page.getByRole('button',{name:'Need a hint?',exact:true}).click();await page.getByRole('button',{name:'Show a worked plan',exact:true}).click();await page.getByRole('button',{name:'Test plan',exact:true}).click();await page.locator('#puzzle-feedback.success').waitFor()}

test('all 30 tutorial puzzles are playable, explained, saved and revisitable through the real browser/server',async t=>{
 const {base,browser}=await fixture(t),context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[]
 page.on('pageerror',e=>errors.push(e.message));await context.request.post(base+'/api/signup',{data:{username:'Learner',password:'p',confirm:'p'}})
 await page.goto(base+'/chess/lobby.html');await page.locator('.home-deal').first().waitFor();await page.getByRole('button',{name:'Start tutorial',exact:true}).click();await page.waitForURL(/puzzles.html\?lesson=1/)
 await page.getByRole('heading',{name:'One small step',exact:true}).waitFor();await page.screenshot({path:'/tmp/chess-puzzles-desktop.png'})
 // Legal-but-wrong double step teaches the objective rather than marking any move correct.
 await page.locator('.coordinate-controls summary').click();await page.locator('#source-select').selectOption({label:'Pawn · '+coordName({x:6,y:9,u:0,t:0},PUZZLES[0].setup())})
 await page.locator('#destination-select').selectOption({label:coordName({x:6,y:7,u:0,t:0},PUZZLES[0].setup())});await page.locator('#queue-coordinate').click();await page.locator('#test-plan').click();await page.locator('#puzzle-feedback.retry').waitFor();assert.equal((await(await context.request.get(base+'/api/puzzles')).json()).completed.length,0)
 await page.getByRole('button',{name:'Try again',exact:true}).click()
 // Complete the first lesson with normal board clicks.
 await page.getByRole('button',{name:'Focus source',exact:true}).click();await page.waitForTimeout(80)
 const square=async(x,y)=>{const box=await page.locator('#scene').boundingBox(),scale=Number((await page.locator('#scale').innerText()).replace('%',''))/100;await page.locator('#scene').click({position:{x:box.width/2+(x+.5-7)*32*scale,y:box.height/2+((y+.5-7)*32-2)*scale}})}
 await square(6,9);await square(6,8);await page.getByRole('button',{name:'Test plan',exact:true}).click();await page.locator('#puzzle-feedback.success').waitFor()
 for(let id=2;id<=30;id++){
  await page.getByRole('button',{name:'Next lesson →',exact:true}).click();await page.getByRole('heading',{name:PUZZLES[id-1].title,exact:true}).waitFor()
  if(id===13)await page.screenshot({path:'/tmp/chess-puzzles-interception.png'})
  if(id===26){await page.getByRole('button',{name:'Need a hint?',exact:true}).click();await page.getByRole('button',{name:'Need a hint?',exact:true}).click();await page.getByRole('button',{name:'Show a worked plan',exact:true}).click();assert.equal(await page.locator('.queued-puzzle-order').count(),2);await page.getByRole('button',{name:'Remove order 2'}).click();await page.locator('#test-plan').click();assert.match(await page.locator('#puzzle-feedback').innerText(),/Present/);await page.locator('#worked-plan').click();await page.locator('#test-plan').click();await page.locator('#puzzle-feedback.success').waitFor()}else await worked(page)
 }
 await page.getByText(/Progress saved[.]? (?:to your account|\+\d+ coins earned)/).waitFor();await page.reload();await page.locator('#course-count').getByText('30 / 30',{exact:true}).waitFor()
 const progress=await(await context.request.get(base+'/api/puzzles')).json();assert.equal(progress.completed.length,30)
 const me=await(await context.request.get(base+'/api/me')).json();assert.equal(me.profile.coins,1230);assert.equal(me.profile.rating.games,0)
 await page.locator('#open-course').click();assert.equal(await page.locator('.course-lesson.completed').count(),30);await page.getByRole('button',{name:/One shared past/}).click();await page.getByRole('heading',{name:'One shared past',exact:true}).waitFor()
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);await page.screenshot({path:'/tmp/chess-puzzles-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 await worked(page);await page.locator('#open-course').click();await page.getByRole('button',{name:/Your first complete operation/}).click();await worked(page)
 await page.getByRole('button',{name:'Try an AI opponent →',exact:true}).click();await page.waitForURL(/lobby.html#ai/);await page.locator('.ai-card').nth(4).waitFor()
 assert.deepEqual(errors,[])
})

test('guest progress survives reload and signed-in offline solves retry account sync',async t=>{
 const{base,browser}=await fixture(t),guest=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await guest.newPage()
 await page.goto(base+'/chess/puzzles.html?lesson=1');await worked(page);await page.reload();await page.getByText('1 / 30',{exact:true}).waitFor()
 const member=await browser.newContext({reducedMotion:'reduce'});await member.request.post(base+'/api/signup',{data:{username:'OfflineLearner',password:'p',confirm:'p'}})
 const signed=await member.newPage();await signed.route('**/api/puzzles/1/solve',route=>route.abort())
 await signed.goto(base+'/chess/puzzles.html?lesson=1');await worked(signed);await signed.getByText('Saved on this browser. Account sync will retry when you reconnect.',{exact:true}).waitFor()
 assert.equal((await(await member.request.get(base+'/api/puzzles')).json()).completed.length,0)
 await signed.unroute('**/api/puzzles/1/solve');await signed.reload();await signed.getByText(/Progress saved[.]? (?:to your account|\+\d+ coins earned)/).waitFor();assert.equal((await(await member.request.get(base+'/api/puzzles')).json()).completed.length,1)
 // A failed initial progress read must recover, rather than replacing account progress with an empty cache.
 const p=PUZZLES[8];await member.request.post(base+'/api/puzzles/9/solve',{data:{orders:p.solution(p.setup())}})
 await signed.route('**/api/puzzles',route=>route.abort());await signed.reload();await signed.getByText('Saved on this browser. Account sync will retry when you reconnect.',{exact:true}).waitFor()
 await signed.unroute('**/api/puzzles');await signed.evaluate(()=>window.dispatchEvent(new Event('online')));await signed.getByText('2 / 30',{exact:true}).waitFor()
})
