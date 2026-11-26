import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp,writeFile,unlink,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {chromium} from 'playwright'
import {clickMatchSquare} from './helpers/match-board.mjs'
import worker from '../.cloudflare/worker.mjs'
import {ChessStore} from '../server/storage.ts'
import {createApplication} from '../server/application.ts'

test('operator flag, lost API, cached games and return to the original page',{timeout:90000},async t=>{
  const directory=await mkdtemp(join(tmpdir(),'update-screen-')),flag=join(directory,'update-in-progress')
  const store=new ChessStore(directory,{memory:true}),app=createApplication(store,flag)
  let backend=true,frontend=true
  const calls=[]
  const server=createServer(async(req,res)=>{
    if(req.url.startsWith('/api/')){
      calls.push([req.method,req.url])
      if(backend)return app.handle(req,res)
      res.writeHead(502).end();return
    }
    if(!frontend){res.writeHead(503).end();return}
    const result=await worker.fetch(new Request('http://localhost'+req.url))
    res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()))
  })
  await new Promise(r=>server.listen(0,'127.0.0.1',r))
  const browser=await chromium.launch({args:['--no-sandbox']})
  t.after(async()=>{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));app.drain();store.close();await rm(directory,{recursive:true,force:true})})
  const base='http://127.0.0.1:'+server.address().port,original='/chess/login.html?next=local#login'
  const page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'})
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/me')),page.goto(base+original)])
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller)
  await writeFile(flag,'')
  await page.evaluate(()=>window.dispatchEvent(new Event('online')))
  await page.getByRole('heading',{name:'UPDATE IN PROGRESS',exact:true}).waitFor()
  calls.length=0
  await page.getByRole('button',{name:'Play Snake',exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('#score').textContent==='1')
  await page.getByRole('button',{name:'Pause',exact:true}).click()
  await page.getByRole('button',{name:'Resume',exact:true}).waitFor()
  if(process.env.UPDATE_SCREEN_CAPTURE)await page.screenshot({path:process.env.UPDATE_SCREEN_CAPTURE})
  backend=false
  // A first visit needs only the frontend when the Pi is already down.
  const newcomer=await browser.newPage({viewport:{width:390,height:844}})
  await newcomer.goto(base+'/chess/')
  await newcomer.getByRole('heading',{name:'SERVER UNREACHABLE'}).waitFor()
  await newcomer.getByRole('link',{name:'Play chess with AI'}).waitFor()
  await newcomer.close()
  frontend=false
  await page.getByRole('button',{name:'Check connection'}).click()
  await page.getByRole('heading',{name:'SERVER UNREACHABLE'}).waitFor()
  await page.getByRole('link',{name:'Play chess with AI'}).click()
  await page.getByText('OFFLINE · PRACTICE WITH PIP').waitFor()
  await page.getByRole('button',{name:'Focus player',exact:true}).click()
  await clickMatchSquare(page,4,10,2);await clickMatchSquare(page,5,8,2)
  await page.getByRole('button',{name:/Lock orders/}).click()
  await page.getByRole('button',{name:/Begin next round/}).waitFor()
  const journal=await page.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.endsWith('/practice-pip')))).journal)
  assert.ok(journal[0].some(o=>o.player==='yellow'))
  await page.reload();await page.getByText('OFFLINE · PRACTICE WITH PIP').waitFor()
  await page.getByRole('link',{name:'Update screen',exact:true}).click()
  await page.setViewportSize({width:375,height:812})
  await page.getByRole('heading',{name:'SERVER UNREACHABLE'}).waitFor()
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  await page.goto(base+original)
  await page.getByRole('heading',{name:'SERVER UNREACHABLE'}).waitFor()
  assert.ok(calls.every(([method,path])=>method==='GET'&&path==='/api/health'),JSON.stringify(calls))
  await unlink(flag);backend=true;frontend=true
  await page.getByRole('button',{name:'Check connection'}).click()
  await page.getByRole('link',{name:'Return to game'}).click()
  await page.waitForURL(base+original)
  await page.waitForFunction(()=>!!document.querySelector('script[data-entry]'))
  assert.deepEqual(errors,[])
})
