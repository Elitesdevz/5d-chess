import {api,ApiError} from '../shell.ts'
import {casinoCoins} from '../casino-model.ts'
import {BANK_MIN_LOAN,BANK_TERMS,type BankReceipt,type BankView} from '../bank-model.ts'
import {BNK,CAS,CAS_SHARES,MAX_STOCK_ORDER,QUOTE_MAX_AGE,equityOrderTotal,isEquity,type EquityPublic,type PricePoint,type StockOrder,type StockTrade,type StockView} from '../stock-model.ts'
import {StockChart} from '../stock-chart.ts'
import {FLOOR_LIST,type WorldUse} from './model.ts'

export const coins=(n:number)=>casinoCoins(n)+' coins'
const escapeMap:Record<string,string>={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}
export const safeText=(text:string)=>text.replace(/[&<>"']/g,c=>escapeMap[c])
const date=new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeZone:'Europe/Amsterdam'})
const stockName=(ticker:string)=>FLOOR_LIST.find(s=>s.symbol===ticker)?.name??ticker
type BankOrder={id:string;sequence:number;amount:number|null;days?:number;kind:'borrow'|'repay'}

export class CityServices {
  private host:HTMLElement
  private token=0
  private busy=false
  private digest=''
  private orderSide:'buy'|'sell'='buy'
  private chart?:StockChart
  private readout?:HTMLElement
  private view?:WorldUse
  private dialog:HTMLDialogElement
  private floorAction:(symbol:string)=>void
  private balance:(coins:number)=>void
  private account:string
  constructor(dialog:HTMLDialogElement,account:string,floorAction:(symbol:string)=>void,balance:(coins:number)=>void){
    this.dialog=dialog;this.host=dialog.querySelector('.world-dialog-body')!;this.account=account;this.floorAction=floorAction;this.balance=balance
    dialog.addEventListener('close',()=>{this.token++;this.chart?.dispose();this.chart=undefined;this.readout=undefined;this.view=undefined;this.digest=''})
  }
  close(){if(this.dialog.open)this.dialog.close()}
  private get<T>(key:string){
    try{return JSON.parse(sessionStorage.getItem('world-service:'+this.account+':'+key)??'null') as T|null}catch{return null}
  }
  private save(key:string,value?:unknown){
    try{
      if(value===undefined)sessionStorage.removeItem('world-service:'+this.account+':'+key)
      else sessionStorage.setItem('world-service:'+this.account+':'+key,JSON.stringify(value))
    }catch{}
  }
  private render(tag:string,title:string,body:string){
    this.host.innerHTML=`<header class="world-service-head"><div><span>${tag}</span><h2 id="world-dialog-title">${safeText(title)}</h2></div><form method="dialog"><button type="submit" aria-label="Close">×</button></form></header>${body}<p class="world-service-message" role="status" hidden></p>`
  }
  private message(text:string){
    const p=this.host.querySelector<HTMLElement>('.world-service-message')
    if(p){p.textContent=text;p.hidden=!text}
  }
  async open(view:WorldUse,symbol?:string){
    const key=view+(symbol??'')
    if(this.digest===key&&this.dialog.open)return
    this.chart?.dispose();this.chart=undefined
    this.view=view;this.digest=key;const token=++this.token
    if(view==='elevator'){
      this.elevator()
      if(!this.dialog.open)this.dialog.showModal()
      return
    }
    const heading=view==='loans'?'Loans':view==='payments'?'Payments':view==='reserve'?'Bank reserve':stockName(symbol??'')
    this.render(view==='trader'?'EXCHANGE': 'FIFTH DIMENSION BANK',heading,'<p class="world-muted">Connecting…</p>')
    if(!this.dialog.open)this.dialog.showModal()
    try{
      if(view==='trader'&&symbol){
        const data=await api<StockView>('/stocks')
        if(token===this.token){this.orderSide='buy';this.stock(symbol,data,token)}
      }else{
        const data=await api<BankView>('/bank')
        if(token===this.token)this.bank(view,data,token)
      }
    }catch(error){if(token===this.token)this.message(error instanceof Error?error.message:'Unavailable')}
  }
  private elevator(){
    this.render('EXCHANGE TOWER','Choose a floor','<input type="search" aria-label="Search stocks" placeholder="Company, ticker or floor" class="world-floor-search"><div class="world-floor-list"></div>')
    const search=this.host.querySelector<HTMLInputElement>('input')!,list=this.host.querySelector<HTMLElement>('.world-floor-list')!
    const render=()=>{
      const q=search.value.trim().toLowerCase()
      const matches=FLOOR_LIST.map((stock,i)=>({...stock,floor:i+1})).filter(s=>!q||s.symbol.toLowerCase().includes(q)||s.name.toLowerCase().includes(q)||String(s.floor)===q)
      list.innerHTML=(q?'':'<button type="button" data-floor=""><b>G</b><span>Reception</span></button>')+
        matches.map(s=>`<button type="button" data-floor="${s.symbol}"><b>${s.floor}</b><span><strong>${s.symbol}</strong> ${safeText(s.name)}</span><span aria-hidden="true">›</span></button>`).join('')
      if(!matches.length)list.innerHTML='<p class="world-muted">No matching floors.</p>'
    }
    search.oninput=render
    list.onclick=e=>{
      const b=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-floor]')
      if(b)this.floorAction(b.dataset.floor!)
    }
    render()
  }
  private bank(view:WorldUse,data:BankView,token:number,notice=''){
    this.balance(data.coins)
    const loan=data.loan,pending=this.get<BankOrder>('bank')
    if(view==='reserve'){
      this.render('FIFTH DIMENSION BANK','Bank reserve',`<div class="world-metrics"><div><small>Lending reserve</small><b>${coins(data.reserve)}</b></div><div><small>Exchange ticker</small><b>BNK</b></div></div><p>At Dutch midnight the bank allocates 25% of collected loan interest across its public shares. You can trade BNK on its floor in the Exchange Tower.</p>`)
      return
    }
    if(view==='loans'){
      if(loan&&!pending){this.render('FIFTH DIMENSION BANK','Loans',`<p>Your current loan has a balance of <strong>${coins(loan.total)}</strong>. Visit the cashier to repay it.</p>`);this.message(notice);return}
      const limit=data.limit
      this.render('LENDING DESK','Loans',`<div class="world-metrics"><div><small>Available to borrow</small><b>${coins(limit)}</b></div><div><small>Wallet</small><b>${coins(data.coins)}</b></div></div>${
        limit<BANK_MIN_LOAN&&!pending?'<p class="world-muted">The minimum loan is 100 coins.</p>':
        `<form class="world-service-form"><label>Loan amount<input name="amount" type="number" inputmode="numeric" min="${BANK_MIN_LOAN}" max="${Math.max(limit,BANK_MIN_LOAN)}" value="${pending?.amount??BANK_MIN_LOAN}" required></label><label>Term<select name="term">${BANK_TERMS.map(t=>`<option value="${t.days}" ${(pending?.days??7)===t.days?'selected':''}>${t.days} days · ${t.basisPoints/100}% daily</option>`).join('')}</select></label><p data-estimate></p><button type="submit" class="world-primary">${pending?'Confirm pending loan':'Take out loan'}</button></form>`
      }<details><summary>Loan terms</summary><p>Borrow up to half your wallet balance, within the reserve and 12,000 coin limit. Interest is added at Dutch midnight on the unpaid principal. Overdue loans accrue 0.9% per day, with total interest capped at 25% of the original loan.</p></details>`)
      const form=this.host.querySelector<HTMLFormElement>('.world-service-form')
      if(form){
        const amount=form.elements.namedItem('amount') as HTMLInputElement,term=form.elements.namedItem('term') as HTMLSelectElement
        const estimate=()=>{
          const plan=BANK_TERMS.find(t=>t.days===Number(term.value))
          if(plan)form.querySelector('[data-estimate]')!.textContent='Total at term: '+coins(Number(amount.value)*(1+plan.days*plan.basisPoints/10_000))
        }
        form.oninput=estimate;estimate()
        if(pending?.kind==='borrow'){amount.disabled=true;term.disabled=true}
        form.onsubmit=e=>{e.preventDefault();void this.bankTrade(view,data,'borrow',Number(amount.value),Number(term.value),token)}
      }
    }else{
      this.render('CASHIER','Payments',`${loan?`<div class="world-metrics"><div><small>${loan.overdue?'Overdue':'Balance due'}</small><b>${coins(loan.total)}</b></div><div><small>Due ${date.format(loan.due)}</small><b>${coins(loan.interest)} interest</b></div></div>`:'<p>No active loan.</p>'}${
        loan||pending?.kind==='repay'?`<form class="world-service-form"><label>Partial payment<input name="amount" type="number" inputmode="decimal" min=".0001" step=".0001" max="${Math.min(data.coins,loan?.total??0)}" required></label><div class="world-button-row"><button type="submit" ${pending?'disabled':''}>Pay amount</button><button type="button" class="world-primary" data-full ${!pending&&(!loan||data.coins<loan.total)?'disabled':''}>${pending?'Confirm pending payment':'Repay in full'}</button></div><small>Payments cover interest first.</small></form>`:''
      }<details><summary>Transaction history</summary>${data.receipts.length?'<ul class="world-ledger">'+data.receipts.slice(0,15).map(r=>`<li><span>${r.kind==='borrow'?'Loan issued':'Payment'} · ${date.format(r.at)}</span><b>${coins(r.amount)}</b></li>`).join('')+'</ul>':'<p class="world-muted">No transactions yet.</p>'}</details>`)
      const form=this.host.querySelector<HTMLFormElement>('.world-service-form')
      if(form){
        form.onsubmit=e=>{e.preventDefault();void this.bankTrade(view,data,'repay',Number((form.elements.namedItem('amount') as HTMLInputElement).value),undefined,token)}
        form.querySelector<HTMLButtonElement>('[data-full]')!.onclick=()=>void this.bankTrade(view,data,'repay',null,undefined,token)
      }
    }
    this.host.querySelectorAll<HTMLButtonElement>('.world-service-form button').forEach(b=>{if(this.busy)b.disabled=true})
    this.message(notice)
  }
  private async bankTrade(view:WorldUse,data:BankView,kind:'borrow'|'repay',amount:number|null,days:number|undefined,token:number){
    if(this.busy)return
    const prior=this.get<BankOrder>('bank')
    if(prior&&prior.kind!==kind){this.message('Confirm the pending bank transaction at its counter.');return}
    const order=prior??{id:crypto.randomUUID(),sequence:data.sequence+1,kind,amount,days}
    this.save('bank',order);this.busy=true;this.bank(view,data,token,'Recording transaction…')
    let latest=data,note=''
    try{
      const result=await api<BankView&{receipt:BankReceipt}>('/bank/'+kind,order)
      latest=result;this.save('bank');this.balance(result.coins)
      note=kind==='borrow'?coins(result.receipt.amount)+' added to your wallet.':'Paid '+coins(result.receipt.amount)+'.'
    }catch(error){
      note=error instanceof Error?error.message:'Could not confirm transaction.'
      try{
        latest=await api<BankView>('/bank')
        const receipt=latest.receipts.find(r=>r.id===order.id)
        if(receipt){this.save('bank');note='Transaction confirmed. '+coins(receipt.amount)}
        else if(error instanceof ApiError&&error.status>=400&&error.status<500&&error.status!==408)this.save('bank')
      }catch{}
    }finally{
      this.busy=false
      if(token===this.token)this.bank(view,latest,token,note)
    }
  }
  private equity(symbol:string,data:StockView):EquityPublic|undefined{return symbol===CAS?data.cas:symbol===BNK?data.bank:undefined}
  private marketPrice(symbol:string,data:StockView){return this.equity(symbol,data)?.price??data.quotes[symbol]?.price}
  private async stockHistory(symbol:string,token:number,seed:PricePoint[],color:string,chart:StockChart){
    chart.set(seed,color)
    if(isEquity(symbol))return
    try{
      const {points}=await api<{points:PricePoint[]}>('/stocks/history?symbol='+encodeURIComponent(symbol))
      if(token===this.token&&this.chart===chart)chart.set(points.slice(-90),color)
    }catch{}
  }
  private stock(symbol:string,data:StockView,token:number,notice=''){
    this.balance(data.coins)
    const holding=data.portfolio.positions[symbol],price=this.marketPrice(symbol,data),issue=this.equity(symbol,data),saved=this.get<StockOrder>('stock')
    const pending=saved?.symbol===symbol?saved:undefined
    if(pending)this.orderSide=pending.side
    this.chart?.dispose();this.chart=undefined
    this.render(symbol,stockName(symbol),`<div class="world-trade-grid"><section><div class="world-price"><strong>${price===undefined?'Price unavailable':coins(price)}</strong><small>${issue?'In-game share price':'Nasdaq reference price'}</small></div><canvas data-chart tabindex="0" aria-label="Stock price history"></canvas><p data-readout class="world-muted"></p></section>
    <form class="world-service-form"><div class="world-button-row"><button type="button" data-side="buy" aria-pressed="${this.orderSide==='buy'}">Buy</button><button type="button" data-side="sell" aria-pressed="${this.orderSide==='sell'}">Sell</button></div><label>Shares<input name="shares" type="number" inputmode="numeric" min="1" max="${MAX_STOCK_ORDER}" value="${pending?.shares??1}" required></label><small>${coins(data.coins)} available · ${holding?.shares??0} shares held</small><strong data-total></strong><button type="submit" class="world-primary" data-order></button></form></div>
    ${symbol===CAS?`<details open><summary>Casino ownership and dividends</summary><div class="world-share-row"><i style="--share:30;--tone:#e6b86d"></i><i style="--share:${data.cas.equity/100};--tone:#92b7cb"></i><i style="--share:20;--tone:#b496c9"></i><i style="--share:${data.cas.float/100};--tone:#8cd6ac"></i><i style="--share:10;--tone:#667c71"></i></div><p>CasinoOwner 30% · Private equity ${data.cas.equity/CAS_SHARES*100}% · The Keeper 20% · Public ${data.cas.float/CAS_SHARES*100}% · Treasury 10%.</p><p>${data.cas.lastDividend?'Last public allocation: '+coins(data.cas.lastDividend.pool):'No public dividend allocated yet.'}</p></details>`:
      symbol===BNK?`<details open><summary>Bank dividends</summary><p>25% of collected loan interest goes to the public shares at Dutch midnight. You have received ${coins(data.portfolio.bankDividendsPaid??0)}.</p></details>`:''}
    <details><summary>Portfolio</summary><ul class="world-ledger">${Object.entries(data.portfolio.positions).map(([ticker,h])=>`<li><span>${safeText(ticker)} · ${h.shares}</span><b>${coins((this.marketPrice(ticker,data)??0)*h.shares)}</b></li>`).join('')||'<li>No shares yet</li>'}</ul></details>
    <details><summary>Trade and dividend history</summary><ul class="world-ledger">${[...data.portfolio.trades.map(t=>({at:t.at,label:`${t.side==='buy'?'Bought':'Sold'} ${t.shares} ${t.symbol}`,amount:t.total})),...data.portfolio.dividends.map(d=>({at:Date.parse(d.day),label:(d.symbol??CAS)+' dividend',amount:d.amount}))].sort((a,b)=>b.at-a.at).slice(0,15).map(r=>`<li><span>${safeText(r.label)} · ${date.format(r.at)}</span><b>${coins(r.amount)}</b></li>`).join('')||'<li>No activity yet</li>'}</ul></details>`)
    const form=this.host.querySelector<HTMLFormElement>('.world-service-form')!,number=form.elements.namedItem('shares') as HTMLInputElement
    const estimate=()=>{
      const n=Number(number.value),side=this.orderSide
      if(!Number.isSafeInteger(n)||n<1||n>MAX_STOCK_ORDER||price===undefined)return undefined
      if(issue&&(side==='buy'?n>issue.available:n>issue.float-issue.available))return undefined
      if(!issue&&data.now-data.quotes[symbol].updated>=QUOTE_MAX_AGE)return undefined
      return issue&&isEquity(symbol)?equityOrderTotal(symbol,issue,side,n):Math.round(price*100)*n/100
    }
    const renderOrder=()=>{
      const total=estimate(),submit=form.querySelector<HTMLButtonElement>('[data-order]')!
      form.querySelectorAll<HTMLButtonElement>('[data-side]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.side===this.orderSide));b.disabled=!!pending||this.busy})
      form.querySelector('[data-total]')!.textContent=total===undefined?'Order unavailable':coins(total)
      submit.textContent=pending?'Confirm pending order':(this.orderSide==='buy'?'Buy ':'Sell ')+symbol
      submit.disabled=this.busy||!pending&&(total===undefined||(this.orderSide==='buy'?total>data.coins:Number(number.value)>(holding?.shares??0)))
      number.disabled=!!pending||this.busy
    }
    form.oninput=renderOrder
    form.querySelectorAll<HTMLButtonElement>('[data-side]').forEach(b=>b.onclick=()=>{this.orderSide=b.dataset.side==='sell'?'sell':'buy';renderOrder()})
    form.onsubmit=e=>{
      e.preventDefault()
      if(this.busy)return
      if(saved&&saved.symbol!==symbol){this.message('Confirm your other pending order first.');return}
      const total=estimate()
      if(total===undefined&&!pending)return
      const order=pending??{symbol,side:this.orderSide,shares:Number(number.value),id:crypto.randomUUID(),sequence:data.portfolio.sequence+1,total:total!,version:issue?.version}
      void this.stockTrade(symbol,data,order,token,renderOrder)
    }
    renderOrder();this.message(notice)
    const chart=new StockChart(this.host.querySelector('canvas')!,this.host.querySelector('[data-readout]')!,!!issue)
    this.chart=chart
    void this.stockHistory(symbol,token,issue?.history??data.quotes[symbol]?.history??[],symbol===CAS?'#e6ba72':'#8ce1b2',chart)
  }
  private async stockTrade(symbol:string,data:StockView,order:StockOrder,token:number,renderOrder:()=>void){
    this.save('stock',order);this.busy=true;renderOrder()
    let latest=data,note=''
    try{
      const result=await api<StockView&{trade:StockTrade}>('/stocks/trade',order)
      latest=result;this.save('stock');this.balance(result.coins);note=(result.trade.side==='buy'?'Bought ':'Sold ')+result.trade.shares+' '+symbol+'.'
    }catch(error){
      note=error instanceof Error?error.message:'Could not confirm order.'
      try{
        latest=await api<StockView>('/stocks')
        const found=latest.portfolio.trades.find(t=>t.id===order.id)
        if(found){this.save('stock');note='Order confirmed.'}
        else if(error instanceof ApiError&&error.status>=400&&error.status<500&&error.status!==408)this.save('stock')
      }catch{}
    }finally{
      this.busy=false
      if(token===this.token)this.stock(symbol,latest,token,note)
    }
  }
}
