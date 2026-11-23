import {api,ApiError,initShell,renderAccount} from './shell.ts'
import {casinoCoins} from './casino-model.ts'
import {icon} from './icons.ts'
import {BANK_MIN_LOAN,BANK_TERMS,type BankReceipt,type BankTerm,type BankView} from './bank-model.ts'
import type {Profile} from './account-model.ts'
import type {BankDesk,BankStage} from './bank-stage.ts'

const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T
const coinAmount=(coins:number)=>casinoCoins(coins)+' coins'
const hall=el('bank-hall'),borrowForm=el<HTMLFormElement>('bank-borrow'),repayForm=el<HTMLFormElement>('bank-repay')
const amount=el<HTMLInputElement>('bank-loan-amount'),repayment=el<HTMLInputElement>('bank-payment-amount')
const dates=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Amsterdam',day:'numeric',month:'short',year:'numeric'})
let stage:BankStage|undefined,state:BankView|undefined,profile:Profile|undefined,name=''
let active:'lobby'|BankDesk='lobby',term:BankTerm=7,busy=false,refreshing=false,hideMessage=0
type Order={id:string;sequence:number;kind:'borrow'|'repay';amount:number|null;days?:BankTerm}
let pending:Order|undefined
const desks={loans:['LENDING DESK','Loans'],payments:['CASHIER','Payments'],vault:['BANK RESERVE','The Vault']} as const

el('bank-back').innerHTML=icon('back')+'<span>Back to Home</span>'
el('bank-term-buttons').innerHTML=BANK_TERMS.map(t=>`<button type="button" data-term="${t.days}" aria-pressed="${t.days===term}"><strong>${t.days} days</strong><small data-loan-rate></small></button>`).join('')
function show(message:string,kind='info'){
  const host=el('bank-feedback')
  host.textContent=message;host.dataset.kind=kind;host.hidden=!message
  clearTimeout(hideMessage)
  if(message)hideMessage=window.setTimeout(()=>host.hidden=true,6400)
}
function setState(next:BankView){
  if(state&&(state.sequence>next.sequence||state.now>next.now))return
  state=next
  if(profile&&profile.coins!==next.coins){profile={...profile,coins:next.coins};renderAccount(profile)}
  el('bank-directory').hidden=active!=='lobby'
  el('bank-welcome').textContent=next.loan?`${coinAmount(next.loan.total)} outstanding`:'Credit score '+next.score+' · Loans and payments'
  render()
}
function render(){
  if(!state)return
  const {loan,limit,coins:balance}=state
  hall.querySelectorAll<HTMLElement>('[data-bank-coins]').forEach(p=>p.textContent=coinAmount(balance))
  el('bank-limit').textContent=coinAmount(limit)
  el('bank-reserve').textContent=coinAmount(state.reserve)
  const blocked=el('bank-loan-unavailable'),borrowAllowed=!loan&&limit>=BANK_MIN_LOAN
  borrowForm.hidden=!borrowAllowed&&pending?.kind!=='borrow'
  blocked.hidden=borrowAllowed
  blocked.textContent=loan?'You already have an active loan. Visit Payments to review it.':'Your borrowing limit is below the 100 coin minimum.'
  amount.max=String(Math.max(BANK_MIN_LOAN,limit))
  const value=Number(amount.value)
  hall.querySelectorAll('[data-loan-rate]').forEach(node=>node.textContent=state!.rate+'% daily')
  const charge=Math.floor(value*state.rate*100)*term/10_000
  el('bank-estimate-interest').textContent=value>0&&Number.isFinite(value)?coinAmount(charge):'—'
  el('bank-estimate-total').textContent=value>0&&Number.isFinite(value)?coinAmount(value+charge):'—'
  const retryBorrow=pending?.kind==='borrow',retryRepay=pending?.kind==='repay'
  el<HTMLButtonElement>('bank-sign').disabled=busy||(!retryBorrow&&(!borrowAllowed||!amount.validity.valid))
  el('bank-sign').textContent=busy?'Recording…':retryBorrow?'Confirm pending loan':'Take out loan'
  amount.disabled=busy||retryBorrow
  el<HTMLButtonElement>('bank-loan-max').disabled=busy||retryBorrow
  hall.querySelectorAll<HTMLButtonElement>('[data-term]').forEach(button=>{
    button.setAttribute('aria-pressed',String(Number(button.dataset.term)===term));button.disabled=busy||retryBorrow
  })
  const payments=el('bank-current-loan')
  payments.innerHTML=loan?`<div class="bank-due ${loan.overdue?'is-overdue':''}"><span>${loan.overdue?'Overdue':'Balance due'}</span><strong>${coinAmount(loan.total)}</strong><small>Due ${dates.format(loan.due)}</small></div><dl class="bank-metrics"><div><dt>Unpaid principal</dt><dd>${coinAmount(loan.principal)}</dd></div><div><dt>Accrued interest</dt><dd>${coinAmount(loan.interest)}</dd></div></dl>`:'<p class="bank-note">You have no active loan.</p>'
  repayForm.hidden=!loan&&!retryRepay
  if(loan)repayment.max=String(Math.min(loan.total,balance))
  repayment.disabled=busy||retryRepay
  el<HTMLButtonElement>('bank-pay-some').disabled=busy||retryRepay||!repayment.validity.valid
  el<HTMLButtonElement>('bank-pay-all').disabled=busy||(!retryRepay&&(!loan||balance<loan.total))
  el('bank-pay-all').textContent=busy?'Recording…':retryRepay?'Confirm pending payment':'Repay in full'
  el('bank-receipts').innerHTML=state.receipts.length?`<ul>${state.receipts.slice(0,15).map(receipt=>`<li><span><strong>${receipt.kind==='borrow'?'Loan issued':'Payment'}</strong><small>${dates.format(receipt.at)}${receipt.interest?' · '+coinAmount(receipt.interest)+' interest':''}</small></span><b>${receipt.kind==='borrow'?'+':'−'}${coinAmount(receipt.amount)}</b></li>`).join('')}</ul>`:'<p class="bank-note">No transactions yet.</p>'
}
function visit(view:'lobby'|BankDesk){
  if(!state)return
  active=view;hall.dataset.view=view
  el('bank-directory').hidden=view!=='lobby'
  el('bank-service').hidden=view==='lobby'
  for(const desk of Object.keys(desks))el('bank-'+desk).hidden=desk!==view
  if(view==='lobby')stage?.visit()
  else{
    el('bank-desk-label').textContent=desks[view][0]
    el('bank-desk-title').textContent=desks[view][1]
    stage?.visit(view)
    if(pending?.kind==='borrow'&&view==='loans'){amount.value=String(pending.amount);term=pending.days??term}
    if(pending?.kind==='repay'&&view==='payments')repayment.value=pending.amount===null?'':String(pending.amount)
  }
  render()
  void refresh()
}
function save(order?:Order){
  pending=order
  try{if(order)sessionStorage.setItem('bank-order:'+name,JSON.stringify(order));else sessionStorage.removeItem('bank-order:'+name)}catch{}
}
async function refresh(){
  if(refreshing||busy)return
  refreshing=true
  try{setState(await api<BankView>('/bank'))}
  catch(error){if(!state)el('bank-welcome').textContent=error instanceof Error?error.message:'The bank is temporarily unavailable.'}
  finally{refreshing=false}
}
function receipt(rec:BankReceipt){
  if(rec.kind!=='collection')stage?.transaction(rec.kind)
  show(rec.kind==='borrow'?`${coinAmount(rec.amount)} deposited into your wallet.`:`Paid ${coinAmount(rec.amount)}${rec.interest?` · ${coinAmount(rec.interest)} went to interest`:''}.`,'success')
  if(rec.kind==='repay')repayment.value=''
  render()
}
async function transact(kind:Order['kind'],value:number|null){
  if(busy||!state)return
  if(pending&&pending.kind!==kind){show('Confirm the pending bank transaction first.','error');return}
  const order=pending??{id:crypto.randomUUID(),sequence:state.sequence+1,kind,amount:value,...(kind==='borrow'?{days:term}:{})}
  save(order);busy=true;render()
  try{
    const result=await api<BankView&{receipt:BankReceipt}>('/bank/'+kind,order)
    save();setState(result);receipt(result.receipt)
  }catch(error){
    const message=error instanceof Error?error.message:'The bank could not confirm that transaction.'
    try{
      const current=await api<BankView>('/bank'),previous=current.receipts.find(r=>r.id===order.id)
      if(previous){save();setState(current);receipt(previous);return}
      if(error instanceof ApiError&&error.status>=400&&error.status<500&&error.status!==408)save()
      setState(current)
    }catch{}
    show(message,'error')
  }finally{busy=false;render()}
}
hall.querySelectorAll<HTMLButtonElement>('[data-bank-visit]').forEach(button=>button.onclick=()=>visit(button.dataset.bankVisit as 'lobby'|BankDesk))
hall.querySelectorAll<HTMLButtonElement>('[data-term]').forEach(button=>button.onclick=()=>{term=Number(button.dataset.term) as BankTerm;render()})
amount.oninput=render;repayment.oninput=render
el('bank-loan-max').onclick=()=>{if(state){amount.value=String(state.limit);render()}}
borrowForm.onsubmit=e=>{e.preventDefault();void transact('borrow',Number(amount.value))}
repayForm.onsubmit=e=>{e.preventDefault();void transact('repay',Number(repayment.value))}
el('bank-pay-all').onclick=()=>void transact('repay',null)

async function start(){
  const auth=await initShell()
  if(!auth?.user){
    hall.dataset.unavailable='true'
    el('bank-welcome').innerHTML='<a href="/chess/login.html">Log in to visit the bank</a>'
    return
  }
  name=auth.user;profile=auth.profile??undefined
  try{pending=JSON.parse(sessionStorage.getItem('bank-order:'+name)??'null')??undefined}catch{}
  await refresh()
  try{
    const {BankStage}=await import('./bank-stage.ts')
    if(!el<HTMLCanvasElement>('bank-canvas'))return
    stage=new BankStage(el('bank-canvas'),hall)
    if(active!=='lobby')stage.visit(active)
  }catch{hall.dataset.flat='true'}
  window.setInterval(()=>{if(!document.hidden)void refresh()},60_000)
}
el('bank-canvas').addEventListener('webglcontextlost',()=>{hall.dataset.flat='true';stage=undefined})
void start()
