import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {chromium} from 'playwright'
import {ChessStore} from '../server/storage.ts'
import {createApplication} from '../server/application.ts'

test('online match controls support unanimous draws, resignation and Classic warnings on desktop and mobile',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'chess-match-ui-')),store=new ChessStore(dir),app=createApplication(store),server=createServer(app.handle)
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']})
 t.after(async()=>{await browser.close();await new Promise(r=>{server.close(r);server.closeAllConnections()});store.close();await rm(dir,{recursive:true,force:true})})
 const contexts=await Promise.all(['Alice','Bob','Cy'].map(async username=>{const context=await browser.newContext();const res=await context.request.post(base+'/api/signup',{data:{username,password:'p',confirm:'p'}});assert.equal(res.status(),201);return context}))
 const created=await contexts[0].request.post(base+'/api/games',{data:{title:'Three-player Live',movement:'live',playerCount:3}}),room=await created.json()
 for(const context of contexts.slice(1))assert.equal((await context.request.post(base+`/api/games/${room.code}/join`,{data:{}})).status(),200)
 const pages=await Promise.all(contexts.map(c=>c.newPage())),errors=[];for(const page of pages)page.on('pageerror',e=>errors.push(e.message))
 await Promise.all(pages.map(p=>p.goto(base+`/chess/online.html?code=${room.code}`)))
 await pages[0].getByRole('button',{name:'Offer draw',exact:true}).click()
 await pages[1].reload();await pages[1].getByRole('button',{name:'Accept draw',exact:true}).click()
 assert.equal((await (await contexts[0].request.get(base+`/api/games/${room.code}`)).json()).finished,false)
 await pages[2].reload();await pages[2].getByRole('button',{name:'Accept draw',exact:true}).click()
 await pages[2].getByText('The game ended in a draw.',{exact:true}).waitFor()
 assert.equal(await pages[2].getByRole('button',{name:'Resign',exact:true}).count(),0)
 await pages[0].goto(base+'/chess/lobby.html#make');await pages[0].locator('#game-movement').selectOption('classic');assert.match(await pages[0].locator('#game-reward-hint').innerText(),/Unrated.*no Elo changes/)
 const classic=await(await contexts[0].request.post(base+'/api/games',{data:{title:'Classic test',movement:'classic',playerCount:2,rated:true}})).json()
 await contexts[1].request.post(base+`/api/games/${classic.code}/join`,{data:{}})
 await pages[0].setViewportSize({width:390,height:844});await pages[0].goto(base+`/chess/online.html?code=${classic.code}`)
 await pages[0].getByText('CLASSIC · UNRATED',{exact:true}).waitFor({state:'attached'})
 // Open the mobile bottom sheet so the same match actions remain reachable.
 if(await pages[0].locator('#panel-handle').isVisible())await pages[0].locator('#panel-handle').click()
 pages[0].once('dialog',d=>d.accept());await pages[0].getByRole('button',{name:'Resign',exact:true}).click()
 await pages[0].getByText('Yellow wins.',{exact:true}).waitFor()
 assert.equal(await pages[0].evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 assert.deepEqual(errors,[])
})
