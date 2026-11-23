import test from 'node:test'
import assert from 'node:assert/strict'
import {ChessStore} from '../server/storage.ts'
import {bankApi} from '../server/bank.ts'
import {DAY} from '../server/credit.ts'

const now=Date.parse('2026-11-23T15:00:00Z')
const borrow={id:'bank-loan-fixture',sequence:1,amount:500,days:7}
function fixture(t){
  const store=new ChessStore('.',{memory:true})
  t.after(()=>store.close())
  store.transaction(unit=>{
    for(const name of ['Alice','Bob'])unit.users.add(name,{name,hash:'',salt:'',wallet:{starterGranted:true,coins:10000,inventory:[],loadout:{icon:'default',pieces:{}}}})
  })
  const bank=(name,action='',data={},time=now)=>store.transaction(unit=>bankApi(unit,unit.users.get(name),'/api/bank'+action,action?'POST':'GET',data,time).value)
  return {bank}
}

test('loans reserve funds once, accrue on the unpaid principal and repay interest first',t=>{
  const {bank}=fixture(t)
  const opening=bank('Alice')
  assert.equal(opening.limit,500)
  const issued=bank('Alice','/borrow',borrow)
  assert.equal(issued.coins,10500)
  assert.equal(issued.reserve,opening.reserve-500)
  assert.deepEqual(bank('Alice','/borrow',borrow),issued)
  assert.throws(()=>bank('Alice','/borrow',{...borrow,id:'bank-second-loan',sequence:2}),{status:409})
  const day2=now+DAY
  const accrued=bank('Alice','',{},day2)
  assert.equal(accrued.loan.interest,.9)
  const repaid=bank('Alice','/repay',{id:'bank-part-payment',sequence:2,amount:100},day2)
  assert.equal(repaid.receipt.interest,.9)
  assert.equal(repaid.loan.principal,400.9)
  assert.equal(repaid.loan.interest,0)
  assert.equal(repaid.reserve,Math.round((opening.reserve-400.9+.855)*10000)/10000)
  const cleared=bank('Alice','/repay',{id:'bank-full-payment',sequence:3,amount:null},day2)
  assert.equal(cleared.loan,undefined)
  assert.equal(cleared.coins,9999.1)
})

test('bank interest is capped and borrowing limits are enforced by the server',t=>{
  const {bank}=fixture(t)
  assert.throws(()=>bank('Alice','/borrow',{...borrow,amount:501}),{status:409})
  bank('Alice','/borrow',borrow)
  const overdue=bank('Alice','',{},now+120*86400000)
  assert.equal(overdue.loan.overdue,true)
  assert.equal(overdue.loan.interest,125)
  assert.equal(overdue.loan.total,625)
})
