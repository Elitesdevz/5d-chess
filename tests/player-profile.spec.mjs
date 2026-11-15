import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm,mkdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {createHash} from 'node:crypto'
import {chromium} from 'playwright'
import {ChessStore} from '../server/storage.ts'
import {ensureAccount} from '../server/accounts.ts'
import {initialState} from '../src/model.ts'

async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'chess-profile-ui-')),store=new ChessStore(dir),now=Date.now()
 store.transaction(u=>{for(const name of ['Alice','Bob']){const account=ensureAccount({name,salt:'fixture',hash:'fixture',rating:{value:name==='Alice'?1800:1200,games:12},wallet:{coins:5000,starterGranted:true,inventory:[],loadout:{icon:'default',pieces:{}}}});u.users.add(name,account);u.putSession(createHash('sha256').update(name+'-profile-token').digest('hex'),{user:name,expires:now+600000})}
 const a=u.users.get('Alice');a.wallet.inventory=[['skin-neon',undefined],['skin-frost','P'],['skin-obsidian','Q'],['icon-laurel',undefined],['frame-copper-orbit',undefined],['skin-maple',undefined]].map(([itemId,kind],i)=>({uid:'profile-piece-'+i,itemId,kind,pending:false,acquired:now}));a.wallet.inventory[5].listed='profile-market-listing';u.listings().push({id:'profile-market-listing',seller:'Alice',uid:'profile-piece-5',itemId:'skin-maple',price:500,created:now})
 a.casino={sequence:3,recent:[{id:'a'.repeat(24),game:'dice',currency:'elo',stake:12,eloLost:12,won:false,net:0,credited:0,created:now+20},{id:'b'.repeat(24),game:'dice',currency:'elo',stake:50,won:true,net:1000,credited:1000,created:now+10},{id:'c'.repeat(24),game:'roulette',won:false,stake:100,net:-100,credited:0,created:now}]}
 for(let i=0;i<24;i++){const state=initialState(2,'classic',['red','yellow']);state.eliminated=['yellow'];const code='P'+String(i).padStart(3,'0');u.rooms.add(code,{code,title:'Across the river',owner:'Alice',seats:{red:'Alice',yellow:'Bob'},state,journal:[],results:[],locked:{},created:now-1000-i,rated:true,ratingChanges:{red:{before:1784,after:1800,delta:16},yellow:{before:1216,after:1200,delta:-16}}})}
 const state=initialState(2,'live',['red','yellow']);u.rooms.add('PLAY',{code:'PLAY',title:'An open timeline',owner:'Alice',seats:{red:'Alice',yellow:'Bob'},state,journal:[],results:[],locked:{},created:now-100,rated:true})});store.close()
 const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));const base=`http://127.0.0.1:${port}`,server=spawn(process.execPath,['dist/server.mjs'],{env:{...process.env,PORT:String(port),DATA_DIR:dir},stdio:'ignore'}),browser=await chromium.launch({headless:true,args:['--no-sandbox']});t.after(async()=>{await browser.close();if(server.exitCode===null){const done=new Promise(r=>server.once('exit',r));server.kill();await done}await rm(dir,{recursive:true,force:true})})
 for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)break}catch{}await new Promise(r=>setTimeout(r,30))}
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await context.addCookies([{name:'multiverse_session',value:'Alice-profile-token',domain:'127.0.0.1',path:'/'}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));return {base,browser,context,page,errors}
}
async function screenshot(page,name){if(process.env.PROFILE_SCREENSHOT_DIR){await mkdir(process.env.PROFILE_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:process.env.PROFILE_SCREENSHOT_DIR+'/'+name+'.png',fullPage:true})}}

test('profile editor saves owned cosmetics, biography and three showcases; histories retain their mysterious entries',async t=>{
 const {base,page,context,errors}=await fixture(t);await page.goto(base+'/chess/lobby.html');await page.locator('#account-name').waitFor();await page.locator('#account-name').click();await page.waitForURL(/profile\.html\?user=Alice/);await page.getByRole('heading',{name:'Alice',exact:true}).waitFor()
 assert.equal(await page.locator('.profile-showcase article').count(),3);await page.getByRole('button',{name:'Edit profile',exact:true}).click();await page.locator('#profile-bio').waitFor();await page.locator('#profile-bio').fill('A <b>bold</b> move & no scripts.');await page.locator('#profile-avatar').selectOption('icon-laurel');await page.locator('#profile-frame').selectOption('frame-copper-orbit')
 for(const [i,id]of ['skin-neon','skin-frost','skin-obsidian'].entries())await page.locator(`[data-skin-slot="${i}"]`).selectOption(id)
 await page.locator('[data-kind-slot="0"]').selectOption('K');await page.locator('[data-faction="blue"][data-slot="0"]').click();assert.equal(await page.locator('[data-kind-slot="1"]').inputValue(),'P');assert.equal(await page.locator('[data-kind-slot="2"]').inputValue(),'Q');await screenshot(page,'profile-editor')
 await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.locator('#profile-editor').waitFor({state:'hidden'});assert.equal(await page.locator('.player-bio').textContent(),'A <b>bold</b> move & no scripts.');assert.equal(await page.locator('.player-bio b').count(),0);assert.equal(await page.locator('.showcase-copy').count(),3);assert.equal(await page.locator('.player-portrait .frame-copper-orbit').count(),1)
 const saved=await(await context.request.get(base+'/api/profile')).json();assert.deepEqual(saved.showcase.map(s=>s.kind),['K','P','Q']);assert.equal(saved.showcase[0].color,'blue');await screenshot(page,'profile-own')
 await page.locator('.history-anomaly').first().waitFor();assert.match(await page.locator('.history-anomaly').first().textContent(),/\?{5}.*12/s);assert.match(await page.locator('.history-anomaly').first().textContent(),/Elo/);assert.equal(await page.locator('.profile-history-row').count(),20);await page.getByRole('button',{name:'Load more history'}).click();await page.waitForFunction(()=>document.querySelectorAll('.profile-history-row').length===26)
 await page.getByRole('link',{name:'Gambling',exact:true}).click();await page.locator('[data-history-kind=roulette]').waitFor();const mystery=await page.locator('.history-anomaly').textContent();assert.match(mystery,/\?{5}.*1,000.*coins/s);assert.doesNotMatch(mystery,/Elo|dice|room/i);await screenshot(page,'profile-gambling')
 await page.reload();await page.locator('.showcase-copy').first().waitFor();assert.equal(await page.locator('.showcase-copy').count(),3);assert.deepEqual(errors,[])
 for(const width of [768,390,320]){await page.setViewportSize({width,height:900});await page.goto(base+'/chess/profile.html?user=Alice');await page.locator('.showcase-copy').first().waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,'profile fits '+width);await page.getByRole('button',{name:'Edit profile',exact:true}).click();await page.locator('#profile-bio').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);if(width===390)await screenshot(page,'profile-mobile-editor');await page.getByRole('button',{name:'Cancel',exact:true}).click();if(width===390)await screenshot(page,'profile-mobile')}
 assert.deepEqual(errors,[])
})

test('leaderboards, market sellers, match participants and the split header lead to the correct profiles',async t=>{
 const {base,browser,errors}=await fixture(t),context=await browser.newContext({viewport:{width:1366,height:900},reducedMotion:'reduce'});await context.addCookies([{name:'multiverse_session',value:'Bob-profile-token',domain:'127.0.0.1',path:'/'}]);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
 await page.goto(base+'/chess/lobby.html');await page.locator('#leaderboard .rank-player').first().waitFor();await page.locator('#leaderboard').getByRole('link',{name:'Alice',exact:true}).click();await page.getByRole('heading',{name:'Alice',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Edit profile',exact:true}).count(),0);assert.equal((await context.request.get(base+'/api/profile/edit?user=Alice')).status(),403)
 const url=page.url();await page.getByRole('button',{name:'Account menu',exact:true}).click();assert.equal(page.url(),url);await page.keyboard.press('Escape');await page.locator('#account-rating').click();await page.waitForURL(/profile\.html\?user=Bob/);await page.getByRole('heading',{name:'Bob',exact:true}).waitFor()
 await page.goto(base+'/chess/leaderboard.html');await page.locator('#full-ranking-table').getByRole('link',{name:'Alice',exact:true}).click();await page.getByRole('heading',{name:'Alice',exact:true}).waitFor()
 await page.goto(base+'/chess/collection.html#market');await page.locator('.seller').getByRole('link',{name:'Alice',exact:true}).click();await page.getByRole('heading',{name:'Alice',exact:true}).waitFor()
 await page.goto(base+'/chess/online.html?code=PLAY');await page.locator('#seats').getByRole('link',{name:'Alice',exact:true}).waitFor();for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'in-game profile header fits '+width);assert.equal(await page.locator('.account-profile-link .profile-avatar').isVisible(),true)}await page.locator('#seats').getByRole('link',{name:'Alice',exact:true}).click();await page.getByRole('heading',{name:'Alice',exact:true}).waitFor();assert.deepEqual(errors,[])
})
