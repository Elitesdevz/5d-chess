import {MENU} from './restaurant-model.ts'
import type {FoodView} from './food.ts'
import {residentialAt} from './residential.ts'
import {UNITS,RESIDENCES} from './housing.ts'
import type {WorldView} from './model.ts'
import {DRINKS,type BarService} from './bar-menu.ts'
import {companyContent} from './company-desk.ts'
import {api,ApiError} from '../shell.ts'
import {casinoCoins} from '../casino-model.ts'
import {BANK_MIN_LOAN,BANK_TERMS,type BankReceipt,type BankView} from '../bank-model.ts'
import {EQUITY_ORDER_LIMIT} from '../equity-v2.ts'
import {bookQuote,BNK,CAS,MAX_STOCK_ORDER,QUOTE_MAX_AGE,isEquity,type EquityPublic,type EquitySymbol,type PricePoint,type StockOrder,type StockTrade,type StockView} from '../stock-model.ts'
import {StockChart} from '../stock-chart.ts'
import {FLOOR_LIST,type WorldUse} from './model.ts'

export const coins=(n:number)=>casinoCoins(n)+' coins'
const escapeMap:Record<string,string>={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}
export const safeText=(text:string)=>text.replace(/[&<>"']/g,c=>escapeMap[c])
const date=new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeZone:'Europe/Amsterdam'})
const stockName=(ticker:string)=>FLOOR_LIST.find(s=>s.symbol===ticker)?.name??ticker
type BankOrder={id:string;sequence:number;amount:number|null;days?:number;loanId?:string;kind:'borrow'|'repay'}

export class CityServices {
  private host:HTMLElement
  private token=0
  private busy=false
  private digest=''
  private orderSide:'buy'|'sell'='buy'
  private history=new Map<string,PricePoint[]>()
  private chart?:StockChart
  private dialog:HTMLDialogElement
  private floorAction:(symbol:string)=>void
  private balance:(coins:number)=>void
  private account:string
  private refreshFloor:()=>void
  constructor(dialog:HTMLDialogElement,account:string,floorAction:(symbol:string)=>void,balance:(coins:number)=>void,refreshFloor:()=>void=()=>{}){
    this.dialog=dialog;this.host=dialog.querySelector('.world-dialog-body')!;this.account=account;this.floorAction=floorAction;this.balance=balance;this.refreshFloor=refreshFloor
    dialog.addEventListener('close',()=>{this.token++;this.chart?.dispose();this.chart=undefined;this.digest=''})
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
    this.digest=key;const token=++this.token
    if(view==='elevator'){
      this.elevator()
      if(!this.dialog.open)this.dialog.showModal()
      return
    }
    const heading=view==='reception'?'Welcome to the Exchange':view==='advisor'?'Your portfolio':view==='board'?'Shareholder board':view==='loans'?'Loans':view==='payments'?'Payments':view==='reserve'?'Bank reserve':view==='credit'?'Credit advisor':stockName(symbol??'')
    this.render(view==='trader'||view==='reception'||view==='advisor'||view==='board'?'EXCHANGE': 'FIFTH DIMENSION BANK',heading,'<p class="world-muted">Connecting…</p>')
    if(!this.dialog.open)this.dialog.showModal()
    try{
      if(view==='reception')this.reception()
      else if(view==='advisor'||view==='trader'&&symbol||view==='board'&&symbol&&isEquity(symbol)){
        const data=await api<StockView>('/stocks')
        if(token!==this.token)return
        if(view==='advisor')this.advisor(data)
        else if(view==='board')this.company(symbol as EquitySymbol,data,token)
        else {this.orderSide='buy';this.stock(symbol!,data,token)}
      }else{
        const data=await api<BankView>('/bank')
        if(token===this.token)this.bank(view,data,token)
      }
    }catch(error){if(token===this.token)this.message(error instanceof Error?error.message:'Unavailable')}
  }
  property(point:string,view:WorldView,acquire:(id:string)=>Promise<void>){
    const key=point.slice(9),block=key.startsWith('desk-')?Number(key.slice(5)):undefined
    const list=UNITS.filter(u=>block===undefined?u.id===key:u.block===block)
    this.render('CITY HOUSING',block===undefined?'House listing':RESIDENCES[block].name,list.map(u=>{
      const mine=view.housing?.keys.includes(u.id),occupied=view.housing?.occupied.includes(u.id)||u.tenure==='resident'
      const expiry=view.housing?.expires[u.id]
      const status=mine?(expiry?'Your lease ends '+date.format(expiry):'You own this home'):occupied?'Occupied':u.tenure==='rent'?'Seven-day lease':'For sale'
      return `<section class="world-ballot"><h3>${u.name}</h3><p>${u.block===undefined?'House':'Floor '+u.floor} · ${u.bedrooms} ${u.bedrooms===1?'bedroom':'bedrooms'} · ${u.layout}</p><p>${status}${occupied&&!mine&&u.tenure!=='resident'?' · '+coins(u.price):''}</p>${mine||occupied?'':`<button class="world-primary" data-home="${u.id}">${u.tenure==='rent'?'Rent':'Buy'} · ${coins(u.price)}</button>`}</section>`
    }).join(''))
    if(!this.dialog.open)this.dialog.showModal()
    this.host.querySelectorAll<HTMLButtonElement>('[data-home]').forEach(b=>b.onclick=async()=>{
      b.disabled=true
      try{await acquire(b.dataset.home!)}catch(error){this.message(error instanceof Error?error.message:'Unavailable');b.disabled=false}
    })
  }
  residentialLift(zone:string,travel:(level:number)=>Promise<void>){
    const spot=residentialAt(zone)
    if(!spot||spot.building.block===undefined)return
    this.render(RESIDENCES[spot.building.block].name,'Elevator',`<div class="world-button-row residential-bank">${[0,1,2,3,4].map(i=>`<button type="button" data-home-floor="${i}" ${i===spot.level?'disabled aria-current="location"':''}>${i||'G'}</button>`).join('')}</div>`)
    if(!this.dialog.open)this.dialog.showModal()
    this.host.querySelectorAll<HTMLButtonElement>('[data-home-floor]').forEach(button=>button.onclick=async()=>{
      button.disabled=true
      try{await travel(Number(button.dataset.homeFloor))}catch(error){button.disabled=false;this.message(error instanceof Error?error.message:'Elevator unavailable')}
    })
  }
  food(food:FoodView,send:(data:object)=>Promise<void>){
    const renderItems=(storage:boolean)=>MENU.map(item=>{
      const quantity=(storage?food.stored!:food.personal)[item.id]
      const transfer=storage?'take':'store',label=storage?'Take':'Store'
      const submit=(op:string,title:string,all=false)=>`<button type="submit" value="${op}" data-all="${all}" ${all||op==='eat'?'formnovalidate':''} ${quantity?'':'disabled'}>${title}</button>`
      return `<form class="world-ballot residential-food" data-food-item="${item.id}"><h3>${item.name} <small>×${quantity}</small></h3><div class="world-button-row">${food.stored?`<input type="number" aria-label="Quantity" name="quantity" min="1" max="${Math.max(1,quantity)}" value="1">${submit(transfer,label)}${submit(transfer,label+' all',true)}`:''}${storage?'':submit('eat',item.id==='cola'?'Drink one':'Eat one')}</div></form>`
    }).join('')
    this.render('FOOD',food.stored?'Refrigerator':'Food inventory',`<div class="residential-food-columns"><section><h3>Your food inventory</h3>${renderItems(false)}</section>${food.stored?`<section><h3>Stored here</h3>${renderItems(true)}</section>`:''}</div>`)
    if(!this.dialog.open)this.dialog.showModal()
    this.host.querySelectorAll<HTMLFormElement>('[data-food-item]').forEach(form=>form.onsubmit=async event=>{
      event.preventDefault()
      const button=event.submitter as HTMLButtonElement
      button.disabled=true
      try{await send({id:crypto.randomUUID(),item:form.dataset.foodItem,operation:button.value,
        amount:button.dataset.all==='true'?'all':button.value==='eat'?1:Number(new FormData(form).get('quantity'))})}
      catch(error){button.disabled=false;this.message(error instanceof Error?error.message:'Food unavailable')}
    })
  }
  bar(order:BarService|undefined,buy:(drink:string,id:string)=>Promise<void>,stand:()=>Promise<void>,seated:boolean){
    this.render('ROYAL SALON','The bar',`<div class="world-drinks">${DRINKS.map(drink=>`<article><i style="--drink:#${drink.color.toString(16)}"></i><div><h3>${drink.name}</h3><p>${drink.note}</p></div><button type="button" data-drink="${drink.id}">${coins(drink.price)}</button></article>`).join('')}</div>${seated?'<button type="button" data-bar-stand>Leave stool</button>':''}`)
    if(!this.dialog.open)this.dialog.showModal()
    if(order)this.message('Your drink is at the counter.')
    this.host.querySelectorAll<HTMLButtonElement>('[data-drink]').forEach(button=>button.onclick=async()=>{
      button.disabled=true
      try{await buy(button.dataset.drink!,crypto.randomUUID());this.close()}
      catch(error){this.message(error instanceof Error?error.message:'Please try again')}
      finally{button.disabled=false}
    })
    const leave=this.host.querySelector<HTMLButtonElement>('[data-bar-stand]')
    if(leave)leave.onclick=()=>void stand().then(()=>this.close()).catch(()=>{})
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
    const loans=data.loans??(data.loan?[data.loan]:[]),loan=loans.find(l=>l.defaulted)??loans.find(l=>l.overdue)??loans[0],pending=this.get<BankOrder>('bank')
    const outstanding=loans.reduce((total,l)=>total+l.total,0)
    const tiles=loans.map(l=>`<li><span>${l.defaulted?'In default':l.overdue?'Overdue':'Due '+date.format(l.due)}<small>${l.rate}% daily · ${coins(l.interest)} accrued interest</small></span><b>${coins(l.total)}</b></li>`).join('')
    if(view==='credit'){
      const status=loan?.defaulted?'In default':loan?.overdue?'Payment overdue':loan?'Loan active':
        data.blockedUntil&&data.blockedUntil>data.now?'Borrowing paused':data.score<600?'Building credit':'In good standing'
      const note=loan?.defaulted?'Visit Payments to settle your debt. Automatic repayments also apply to incoming coins.':
        loan?(`You owe ${coins(outstanding)} across ${loans.length} active ${loans.length===1?'loan':'loans'}. Make a payment at the cashier’s desk.`):
        data.blockedUntil&&data.blockedUntil>data.now?('Your borrowing hold ends '+date.format(data.blockedUntil)+'.'):
        !data.lendingOpen?'The bank has paused new loans.':data.score<600?'You need a score of at least 600 to borrow.':
        ('Visit the lender for loans of up to '+coins(data.limit)+'.')
      this.render('FIFTH DIMENSION BANK','Credit advisor',`<div class="credit-summary"><div><small>Credit score</small><strong>${data.score}</strong><span>of 850</span></div><div><strong>${status}</strong><p>${note}</p></div></div>
        <details><summary>Building your score</summary><p>Repay qualifying loans on time. To count, a loan must be at least 300 coins, last at least seven days, and stay open for at least half its term.</p><p>Late payments lower your score. If a default has been cleared, your score gradually recovers while you remain debt-free.</p></details>`)
      return
    }
    if(view==='reserve'){
      this.render('FIFTH DIMENSION BANK','Bank reserve',`<div class="world-metrics"><div><small>Lending reserve</small><b>${coins(data.reserve)}</b></div><div><small>Exchange ticker</small><b>BNK</b></div></div><p>Weekly dividends depend on profit and available reserves. Visit the BNK floor of the Exchange Tower to trade or vote.</p>`)
      return
    }
    if(view==='loans'){
      const limit=data.limit
      this.render('LENDING DESK','Loans',`<div class="world-metrics"><div><small>Available to borrow</small><b>${coins(limit)}</b></div><div><small>Credit score</small><b>${data.score}</b></div><div><small>Outstanding</small><b>${coins(outstanding)}</b></div><div><small>Daily interest</small><b>${data.rate}%</b></div></div>${
        limit<BANK_MIN_LOAN&&!pending?`<p class="world-muted">${data.blockedUntil&&data.blockedUntil>data.now?'Borrowing resumes '+date.format(data.blockedUntil)+'.':!data.lendingOpen?'New lending is paused.':data.score<600?'A credit score of 600 is required to borrow.':'You have less than the 100-coin minimum available.'}</p>`:
        `<form class="world-service-form"><label>Loan amount<input name="amount" type="number" inputmode="numeric" min="${BANK_MIN_LOAN}" max="${Math.max(limit,BANK_MIN_LOAN)}" value="${pending?.amount??BANK_MIN_LOAN}" required></label><label>Term<select name="term">${BANK_TERMS.map(t=>`<option value="${t.days}" ${(pending?.days??7)===t.days?'selected':''}>${t.days} days</option>`).join('')}</select></label><p data-estimate></p><button type="submit" class="world-primary">${pending?'Confirm pending loan':'Take out loan'}</button></form>`
      }${tiles?`<details><summary>Active loans (${loans.length})</summary><ul class="world-ledger">${tiles}</ul></details>`:''}<details><summary>Loan terms</summary><p>Your credit score sets your rate and borrowing limit. Pay early or in parts. Overdue payments can lower your score.</p></details>`)
      const form=this.host.querySelector<HTMLFormElement>('.world-service-form')
      if(form){
        const amount=form.elements.namedItem('amount') as HTMLInputElement,term=form.elements.namedItem('term') as HTMLSelectElement
        const estimate=()=>{
          const plan=BANK_TERMS.find(t=>t.days===Number(term.value))
          if(plan)form.querySelector('[data-estimate]')!.textContent='Total at term: '+coins(Number(amount.value)*(1+plan.days*data.rate/100))
        }
        form.oninput=estimate;estimate()
        if(pending?.kind==='borrow'){amount.disabled=true;term.disabled=true}
        form.onsubmit=e=>{e.preventDefault();void this.bankTrade(view,data,'borrow',Number(amount.value),Number(term.value),token)}
      }
    }else{
      const payment=pending?.kind==='repay'?pending:undefined
      this.render('CASHIER','Payments',`<div class="world-metrics"><div><small>Total debt</small><b>${coins(outstanding)}</b></div><div><small>Available in wallet</small><b>${coins(data.coins)}</b></div></div>${tiles?`<ul class="world-ledger">${tiles}</ul>`:'<p>No active loans.</p>'}${
        loan||payment?`<form class="world-service-form"><label>Loan<select name="loan" ${payment?'disabled':''}>${loans.map((l,i)=>`<option value="${safeText(l.id)}" ${(payment?.loanId??loan?.id)===l.id?'selected':''}>Loan ${i+1} · ${coins(l.total)} · due ${date.format(l.due)}</option>`).join('')}</select></label><label>Partial payment<input name="amount" type="number" inputmode="decimal" min=".0001" step=".0001" required ${payment?'disabled':''}></label><div class="world-button-row"><button type="submit" ${payment?'disabled':''}>Pay amount</button><button type="button" class="world-primary" data-full>${payment?'Confirm pending payment':'Repay in full'}</button></div><small>Payments cover accrued interest first.</small></form>`:''
      }<details><summary>Transaction history</summary>${data.receipts.length?'<ul class="world-ledger">'+data.receipts.slice(0,15).map(r=>`<li><span>${r.kind==='borrow'?'Loan issued':r.kind==='collection'?'Automatic repayment':'Payment'} · ${date.format(r.at)}</span><b>${coins(r.amount)}</b></li>`).join('')+'</ul>':'<p class="world-muted">No transactions yet.</p>'}</details>`)
      const form=this.host.querySelector<HTMLFormElement>('.world-service-form')
      if(form){
        const select=form.elements.namedItem('loan') as HTMLSelectElement,amount=form.elements.namedItem('amount') as HTMLInputElement
        const full=form.querySelector<HTMLButtonElement>('[data-full]')!
        const refresh=()=>{
          const chosen=loans.find(l=>l.id===select.value)
          amount.max=String(Math.min(data.coins,chosen?.total??0))
          full.disabled=!payment&&(!chosen||data.coins<chosen.total)
        }
        select.onchange=refresh;refresh()
        form.onsubmit=e=>{e.preventDefault();void this.bankTrade(view,data,'repay',Number(amount.value),undefined,token,select.value)}
        full.onclick=()=>void this.bankTrade(view,data,'repay',null,undefined,token,select.value)
      }
    }
    this.host.querySelectorAll<HTMLButtonElement>('.world-service-form button').forEach(b=>{if(this.busy)b.disabled=true})
    this.message(notice)
  }
  private async bankTrade(view:WorldUse,data:BankView,kind:'borrow'|'repay',amount:number|null,days:number|undefined,token:number,loanId?:string){
    if(this.busy)return
    const prior=this.get<BankOrder>('bank')
    if(prior&&prior.kind!==kind){this.message('Confirm the pending bank transaction at its counter.');return}
    const order=prior??{id:crypto.randomUUID(),sequence:data.sequence+1,kind,amount,days,loanId}
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
    let points=this.history.get(symbol)??seed,range=30
    const buttons=this.host.querySelectorAll<HTMLButtonElement>('[data-range]')
    const update=()=>{
      const cutoff=Date.now()-range*86_400_000
      chart.set(points.filter(p=>p.at>=cutoff),color)
      buttons.forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.range)===range)))
    }
    buttons.forEach(button=>button.onclick=()=>{range=Number(button.dataset.range);update()})
    update()
    if(isEquity(symbol)||this.history.has(symbol))return
    try{
      const result=await api<{points:PricePoint[]}>('/stocks/history?symbol='+encodeURIComponent(symbol))
      this.history.set(symbol,result.points)
      if(token===this.token&&this.chart===chart){points=result.points;update()}
    }catch{}
  }
  private reception(){
    this.render('EXCHANGE RECEPTION','Welcome to the Exchange',`<div class="world-reception">
      <article><span>FLOOR DIRECTORY</span><h3>Trade with a broker</h3><p>Enter the elevator, pick a company, and speak to a broker on its floor. Use coins to buy and sell shares.</p></article>
      <article><span>FINANCIAL ADVISOR</span><h3>Follow your investments</h3><p>Visit the desk to your left for your holdings, daily performance and available cash.</p></article>
      <article><span>CAS AND BNK</span><h3>Own a piece of the city</h3><p>Prices follow completed trades. Shareholders can earn dividends and vote on company policy at the board table.</p></article>
      <article><span>REFERENCE STOCKS</span><h3>Explore real-world companies</h3><p>These virtual shares track external prices. Your holdings stay in the game and are traded with coins.</p></article>
      </div>`)
  }
  private advisor(data:StockView){
    this.balance(data.coins)
    const day=new Date(data.now).toISOString().slice(0,10)
    const boundary=Date.parse(day),positions=Object.entries(data.portfolio.positions).map(([symbol,holding])=>{
      const mark=this.marketPrice(symbol,data),issue=this.equity(symbol,data),quote=data.quotes[symbol]
      const prior=issue?.history.findLast(p=>p.at<boundary)?.price??(quote&&quote.updated>=boundary?quote.price-quote.change:undefined)
      return {symbol,holding,value:mark===undefined?undefined:mark*holding.shares,prior:prior&&prior>0?prior*holding.shares:undefined}
    }).sort((a,b)=>(b.value??0)-(a.value??0))
    const worth=positions.reduce((n,p)=>n+(p.value??0),0)
    const priced=positions.filter(p=>p.prior!==undefined&&p.value!==undefined)
    const previous=priced.reduce((n,p)=>n+p.prior!,0)
    const change=(n:number)=>`<span class="${n>=0?'world-gain':'world-loss'}">${n>0?'+':''}${n.toFixed(2)}%</span>`
    const open=Object.values(data.companies).flatMap(c=>c.orders.map(o=>({...o,symbol:c.symbol})))
    this.render('FINANCIAL ADVISOR','Your portfolio',`<div class="world-portfolio-mast"><div><small>Marked holdings</small><b>${coins(worth)}</b><span>Daily move ${previous?change(100*(priced.reduce((n,p)=>n+p.value!,0)/previous-1)):'—'}</span></div><div><small>Cash available</small><b>${coins(data.coins)}</b><span>${positions.length} ${positions.length===1?'holding':'holdings'}</span></div></div><h3>Holdings</h3>
      <ul class="world-ledger world-portfolio-ledger">${positions.map(p=>`<li><span><strong>${safeText(p.symbol)}</strong> · ${safeText(stockName(p.symbol))}<small>${casinoCoins(p.holding.shares)} shares · Floor ${FLOOR_LIST.findIndex(s=>s.symbol===p.symbol)+1}</small><meter min="0" max="1" value="${worth?(p.value??0)/worth:0}" aria-label="Portfolio weight"></meter></span><b>${p.value===undefined?'—':coins(p.value)}<small>${p.prior!==undefined&&p.value!==undefined?change(100*(p.value/p.prior-1)):'—'}</small></b></li>`).join('')||'<li>No holdings yet</li>'}</ul>
      ${open.length?`<details><summary>Open orders (${open.length})</summary><ul class="world-ledger">${open.map(o=>`<li><span>${o.symbol} · ${o.side==='buy'?'Buy':'Sell'} ${casinoCoins(o.shares)} at ${casinoCoins(o.price)}</span><button type="button" data-portfolio-cancel="${safeText(o.id)}" data-symbol="${o.symbol}">Cancel</button></li>`).join('')}</ul></details>`:''}`)
    const token=this.token
    this.host.querySelectorAll<HTMLButtonElement>('[data-portfolio-cancel]').forEach(b=>b.onclick=async()=>{
      b.disabled=true
      try{const next=await api<StockView>('/stocks/cancel',{symbol:b.dataset.symbol,id:b.dataset.portfolioCancel});if(token===this.token)this.advisor(next)}
      catch(error){b.disabled=false;this.message(error instanceof Error?error.message:'Unable to cancel order')}
    })
  }
  private company(symbol:EquitySymbol,data:StockView,token:number,notice=''){
    this.balance(data.coins)
    const open=[...this.host.querySelectorAll<HTMLDetailsElement>('.world-policy')].map(d=>d.open)
    this.chart?.dispose();this.chart=undefined
    this.render(symbol+' SHAREHOLDERS',stockName(symbol)+' board',companyContent(symbol,data))
    this.host.querySelectorAll<HTMLDetailsElement>('.world-policy').forEach((d,i)=>{d.open=!!open[i]})
    this.message(notice)
    const request=async(action:string,input:Record<string,unknown>,success:string)=>{
      if(this.busy)return
      this.busy=true
      const buttons=[...this.host.querySelectorAll<HTMLButtonElement>('button:not([aria-label=Close]):enabled')]
      buttons.forEach(b=>b.disabled=true)
      try{
        const next=await api<StockView>(action==='refresh'?'/stocks':'/stocks/'+action,action==='refresh'?undefined:{symbol,...input})
        if(token===this.token)this.company(symbol,next,token,success)
      }catch(error){
        if(token===this.token)this.message(error instanceof Error?error.message:'Please try again')
      }finally{this.busy=false;buttons.forEach(b=>b.disabled=false)}
    }
    this.host.querySelector<HTMLButtonElement>('[data-equity-refresh]')!.onclick=()=>void request('refresh',{},'')
    this.host.querySelectorAll<HTMLButtonElement>('[data-policy]').forEach(b=>b.onclick=()=>void request('support',{policy:b.dataset.policy,value:Number(b.dataset.value),on:b.dataset.on==='true'},'Support updated.'))
    this.host.querySelectorAll<HTMLButtonElement>('[data-rescue]').forEach(b=>b.onclick=()=>void request('rescue',{value:Number(b.dataset.rescue),on:b.dataset.on==='true'},'Rescue support updated.'))
    this.host.querySelectorAll<HTMLButtonElement>('[data-vote]').forEach(b=>b.onclick=()=>void request('vote',{id:b.dataset.ballot,choice:b.dataset.vote},'Vote recorded.'))
  }
  private stock(symbol:string,data:StockView,token:number,notice=''){
    this.balance(data.coins)
    const holding=data.portfolio.positions[symbol],price=this.marketPrice(symbol,data),issue=this.equity(symbol,data),saved=this.get<StockOrder>('stock')
    const company=isEquity(symbol)?data.companies[symbol]:undefined,cap=company?EQUITY_ORDER_LIMIT:MAX_STOCK_ORDER
    const available=(holding?.shares??0)-(company?.orders.filter(o=>o.side==='sell').reduce((n,o)=>n+o.shares,0)??0)
    const pending=saved?.symbol===symbol?saved:undefined
    if(pending)this.orderSide=pending.side
    this.chart?.dispose();this.chart=undefined
    this.render(symbol,stockName(symbol),`<div class="world-trade-grid"><section><div class="world-price"><strong>${price===undefined?'Price unavailable':coins(price)}</strong><small>${issue?'Last traded price':'Nasdaq reference price'}</small></div><div class="world-range" role="group" aria-label="Chart range"><button type="button" data-range="30">1M</button><button type="button" data-range="90">3M</button><button type="button" data-range="365">1Y</button></div><canvas data-chart tabindex="0" aria-label="Stock price history"></canvas><p data-readout class="world-muted"></p></section>
    <form class="world-service-form"><div class="world-button-row"><button type="button" data-side="buy" aria-pressed="${this.orderSide==='buy'}">Buy</button><button type="button" data-side="sell" aria-pressed="${this.orderSide==='sell'}">Sell</button></div><label>Shares<input name="shares" type="number" inputmode="numeric" min="1" max="${cap}" value="${pending?.shares??1}" required></label>${company?`<details ${pending?.price?'open':''}><summary>Set a limit price</summary><label>Price per share<input name="limit" type="number" inputmode="decimal" min=".0001" step=".0001" value="${pending?.price??''}" ${pending?'disabled':''}></label></details>`:''}<small>${coins(data.coins)} available · ${casinoCoins(available)} shares available</small><strong data-total></strong><button type="submit" class="world-primary" data-order></button></form></div>
    <details><summary>Portfolio</summary><ul class="world-ledger">${Object.entries(data.portfolio.positions).map(([ticker,h])=>`<li><span>${safeText(ticker)} · ${h.shares}</span><b>${coins((this.marketPrice(ticker,data)??0)*h.shares)}</b></li>`).join('')||'<li>No shares yet</li>'}</ul></details>
    <details><summary>Trade and dividend history</summary><ul class="world-ledger">${[...data.portfolio.trades.map(t=>({at:t.at,label:`${t.side==='buy'?'Bought':'Sold'} ${t.shares} ${t.symbol}`,amount:t.total})),...data.portfolio.dividends.map(d=>({at:Date.parse(d.day),label:(d.symbol??CAS)+' dividend',amount:d.amount}))].sort((a,b)=>b.at-a.at).slice(0,15).map(r=>`<li><span>${safeText(r.label)} · ${date.format(r.at)}</span><b>${coins(r.amount)}</b></li>`).join('')||'<li>No activity yet</li>'}</ul></details>`)
    const form=this.host.querySelector<HTMLFormElement>('.world-service-form')!,number=form.elements.namedItem('shares') as HTMLInputElement
    const limit=form.elements.namedItem('limit') as HTMLInputElement|null
    const target=()=>limit?.closest('details')?.open?Number(limit.value):0
    const estimate=()=>{
      const n=Number(number.value)
      if(!Number.isSafeInteger(n)||n<1||n>cap||price===undefined)return undefined
      if(company){
        const requested=target()
        if(limit?.closest('details')?.open)return Number.isFinite(requested)&&requested>0?{total:Math.round(requested*10_000)*n/10_000,limit:requested}:undefined
        return bookQuote(this.orderSide==='buy'?company.asks:company.bids,this.account,n)
      }
      if(data.now-data.quotes[symbol].updated>=QUOTE_MAX_AGE)return undefined
      return {total:Math.round(price*100)*n/100,limit:price}
    }
    const renderOrder=()=>{
      const total=estimate(),submit=form.querySelector<HTMLButtonElement>('[data-order]')!
      form.querySelectorAll<HTMLButtonElement>('[data-side]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.side===this.orderSide));b.disabled=!!pending||this.busy})
      form.querySelector('[data-total]')!.textContent=total===undefined?'Quote unavailable':(target()?'Limit total · ':company?'Est. total · ':'')+coins(total.total)
      submit.textContent=pending?'Confirm pending order':target()?'Place limit order':(this.orderSide==='buy'?'Buy ':'Sell ')+symbol
      submit.disabled=this.busy||!pending&&(total===undefined||(this.orderSide==='buy'?(company?total.limit*Number(number.value):total.total)>data.coins:Number(number.value)>available))
      number.disabled=!!pending||this.busy
    }
    form.oninput=renderOrder
    if(limit)limit.closest('details')!.ontoggle=renderOrder
    form.querySelectorAll<HTMLButtonElement>('[data-side]').forEach(b=>b.onclick=()=>{this.orderSide=b.dataset.side==='sell'?'sell':'buy';renderOrder()})
    form.onsubmit=e=>{
      e.preventDefault()
      if(this.busy)return
      if(saved&&saved.symbol!==symbol){this.message('Confirm your other pending order first.');return}
      const total=estimate()
      if(total===undefined&&!pending)return
      const order=pending??{symbol,side:this.orderSide,shares:Number(number.value),id:crypto.randomUUID(),sequence:data.portfolio.sequence+1,total:total!.total,version:issue?.version,price:target()||undefined}
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
      const result=await api<StockView&{trade?:StockTrade}>(order.price?'/stocks/order':isEquity(symbol)?'/stocks/market':'/stocks/trade',order)
      latest=result;this.save('stock');this.balance(result.coins);this.refreshFloor()
      note=result.trade?(result.trade.side==='buy'?'Bought ':'Sold ')+result.trade.shares+' '+symbol+'.':'Limit order received.'
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
