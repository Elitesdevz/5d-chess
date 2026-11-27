import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {ChessStore} from '../server/storage.ts'
import {applyAccountUpdates} from '../server/account-updates.ts'
import {ensureAccount,pruneNotices} from '../server/accounts.ts'
import {accountApi} from '../server/account-api.ts'

const account=(name,coins=123.4567)=>ensureAccount({name,salt:'fixture',hash:'fixture',settings:{avatar:'default',movement:'live',players:2,moveNotifications:false},wallet:{starterGranted:true,coins,inventory:[],loadout:{icon:'default',pieces:{}}}})

test('targeted bonus and warning survive restarts and apply once',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'chess-account-updates-'))
 t.after(()=>rm(dir,{recursive:true,force:true}))
 let store=new ChessStore(dir)
 try{
  store.transaction(u=>{for(const name of ['dima','MASTER','Other'])u.users.add(name,account(name))})
  const other=store.snapshot().users.find(a=>a.name==='Other')
  store.transaction(applyAccountUpdates)
  assert.equal(store.snapshot().users.find(a=>a.name==='dima').wallet.coins,2123.4567)
  assert.deepEqual(store.snapshot().users.find(a=>a.name==='Other'),other)
  const master=store.snapshot().users.find(a=>a.name==='MASTER')
  assert.equal(master.wallet.coins,123.4567)
  assert.deepEqual(master.notifications.map(n=>[n.kind,n.title,n.detail,n.read]),[['warning','Warning','hi',false]])
  const warningId=master.notifications[0].id
  store.transaction(u=>{
   const a=u.users.get('MASTER');a.notifications[0].created=Date.now()-10*86400000
   pruneNotices(a);assert.equal(a.notifications.length,1)
   accountApi(store,a,'/api/notifications/read','POST',{ids:[warningId]})
  })
  const before=store.snapshot()
  store.close();store=new ChessStore(dir)
  store.transaction(applyAccountUpdates)
  assert.deepEqual(store.snapshot(),before)
  assert.equal(store.snapshot().users.find(a=>a.name==='MASTER').notifications[0].read,true)
 }finally{store.close()}
})

test('missing accounts are not created and failed updates roll back with their receipts',()=>{
 const store=new ChessStore('.',{memory:true})
 try{
  const empty=store.snapshot();store.transaction(applyAccountUpdates);assert.deepEqual(store.snapshot(),empty)
  store.transaction(u=>{u.users.add('DIMA',account('DIMA'));u.users.add('Master',account('Master'))})
  const before=store.snapshot()
  assert.throws(()=>store.transaction(u=>{applyAccountUpdates(u);throw Error('rollback')}),/rollback/)
  assert.deepEqual(store.snapshot(),before)
  store.transaction(applyAccountUpdates)
  assert.equal(store.snapshot().users.find(a=>a.name==='DIMA').wallet.coins,2123.4567)
  assert.equal(store.snapshot().users.find(a=>a.name==='Master').notifications.length,1)
 }finally{store.close()}
})
