import {api,ApiError,initShell,renderAccount} from './shell.ts'
import {icon} from './icons.ts'
import {StockChart,sparkline} from './stock-chart.ts'
import {casinoCoins} from './casino-model.ts'
import type {Profile} from './account-model.ts'
import {STOCKS,SECTORS} from './stock-catalog.ts'
import {BANK_SHARE_COUNT} from './bank-model.ts'
import {BNK,CAS,CAS_SHARES,MAX_STOCK_ORDER,QUOTE_MAX_AGE,isEquity,equityOrderTotal,type PricePoint,type StockOrder,type StockSide,type StockTrade,type StockView} from './stock-model.ts'

const el=<E extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as E
const nodes=[...document.querySelectorAll<HTMLButtonElement>('[data-exchange-view]')]
const symbols=new Map<string,{name:string;sector:string}>(STOCKS.map(s=>[s.symbol,s]))
const label=(symbol:string)=>symbol===CAS?'The Casino':symbol===BNK?'Fifth Dimension Bank':symbols.get(symbol)?.name??symbol
const coins=(value:number)=>casinoCoins(value)+' coins'
const signed=(value:number)=>value===0?'0':(value>0?'+':'−')+casinoCoins(Math.abs(value))
const changeClass=(v:number)=>v>0?'is-gain':v<0?'is-loss':''
const stamp=(time:number)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Amsterdam',dateStyle:'short',timeStyle:'short'}).format(time)
const simpleDate=(time:number)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Amsterdam',month:'short',day:'numeric'}).format(time)
const maxRows=12
const dayMs=86_400_000
const stockChart=new StockChart(el<HTMLCanvasElement>('stock-chart'),el('stock-chart-readout'))
const casChart=new StockChart(el<HTMLCanvasElement>('cas-chart'),el('cas-chart-readout'),true)
const historyBySymbol=new Map<string,PricePoint[]>()
const historyLoading=new Set<string>()
const historyRetry=new Map<string,number>()
const trendBySymbol=new Map<string,PricePoint[]>()
const trendRetry=new Map<string,number>()
let trendTimer=0,trendActive=false
const visibleTrendRows=()=>[...el('exchange-market-list').querySelectorAll<HTMLTableRowElement>('tbody tr')]
const watched=new Set<string>()
let scope='all',range=30,ownershipIndex=-1
const sectorColors=['#9cd6ce','#b1b0ed','#dbad7d','#bbd298','#88bed2','#e7aaa6','#d8c388','#d6a689','#a6d5ac','#c5b4d9','#b2c2ae']
const sectorColor=(sector:string)=>sectorColors[SECTORS.indexOf(sector)]??'#9cd6ce'
let state:StockView|undefined,profile:Profile|undefined,page=0,mode='market',selected='',side:StockSide='buy',working=false,refreshing=false
let pending:StockOrder|undefined,accountName='',marketFailed=false
const loading=el('exchange-load-error')
const app=el('exchange-app')
el('exchange-search-icon').innerHTML=icon('search')
el('exchange-cas-art').innerHTML=icon('wheel')
el('exchange-bank-art').innerHTML=icon('bank')
el('stock-watch').innerHTML='<span aria-hidden="true">☆</span>'
el<HTMLSelectElement>('exchange-sector').insertAdjacentHTML('beforeend',SECTORS.map(sector=>`<option>${sector}</option>`).join(''))
const input=<I extends HTMLInputElement|HTMLSelectElement>(id:string)=>el<I>(id).value
const issue=(symbol:string)=>symbol===CAS?state?.cas:symbol===BNK?state?.bank:undefined
const mark=(symbol:string)=>issue(symbol)?.price??state?.quotes[symbol]?.price
const validQuote=(symbol:string)=>Boolean(issue(symbol)||(state?.quotes[symbol]&&state.now-state.quotes[symbol].updated<QUOTE_MAX_AGE))

function setState(next:StockView){
  if(state&&(next.now<state.now||next.portfolio.sequence<state.portfolio.sequence))return
  state=next
  if(profile&&profile.coins!==next.coins){profile={...profile,coins:next.coins};renderAccount(profile)}
  app.hidden=false
  loading.hidden=true
  renderExchange()
}

function renderExchange(){
  if(!state)return
  let value=0,cost=0,unmarked=0
  for(const [symbol,holding] of Object.entries(state.portfolio.positions)){
    const price=mark(symbol)
    if(price===undefined){unmarked++;continue}
    value+=price*holding.shares
    cost+=holding.cost
  }
  const gain=value-cost
  el('exchange-cash').textContent=casinoCoins(state.coins)
  el('exchange-value').textContent=casinoCoins(value)+(unmarked?'*':'')
  el('exchange-value').title=unmarked?`${unmarked} positions have no displayed price`:''
  el('exchange-gain').textContent=signed(gain)
  el('exchange-gain').className=changeClass(gain)
  el('exchange-dividends').textContent=casinoCoins(state.portfolio.dividendsPaid+(state.portfolio.bankDividendsPaid??0))
  const positions=Object.keys(state.portfolio.positions).length
  el('exchange-holding-count').textContent=positions===1?'1 position':`${positions} positions`
  el('exchange-gain-percent').textContent=cost?`${signed(Math.round(gain/cost*10000)/100)}% vs. cost`:'Across open positions'
  const marks=Object.values(state.quotes)
  const last=marks.length?Math.max(...marks.map(q=>q.updated)):0
  el('exchange-feed-time').textContent=marketFailed?'Refresh unavailable · showing saved prices':last?`${marks.length}/100 priced · Refreshed ${stamp(last)}`:'Waiting for the first price refresh'
  document.querySelector('.exchange-feed')!.classList.toggle('is-waiting',marketFailed||!last||state.now-last>2*60*60*1000)
  el('exchange-cas-price').textContent=coins(state.cas.price)
  el('exchange-cas-float').textContent=`${state.cas.float/CAS_SHARES*100}% public float · ${casinoCoins(state.cas.available)} available`
  document.querySelector<HTMLElement>('.exchange-bank')!.hidden=!state.bank
  if(state.bank){
    el('exchange-bank-price').textContent=coins(state.bank.price)
    el('exchange-bank-float').textContent=`${state.bank.float/BANK_SHARE_COUNT*100}% public float · ${casinoCoins(state.bank.available)} available`
  }
  if(mode==='market'){renderPulse();renderMarket()}
  else if(mode==='portfolio')renderPortfolio()
  else renderActivity()
  if(selected)renderDetail()
}
function quoteTag(percent:number){
  return `<span class="exchange-move ${changeClass(percent)}">${signed(Math.round(percent*100)/100)}%</span>`
}
function renderPulse(){
  if(!state)return
  const marked=STOCKS.filter(s=>validQuote(s.symbol)).map(s=>({...s,percent:state!.quotes[s.symbol].percent}))
  const up=marked.filter(s=>s.percent>0).length,down=marked.filter(s=>s.percent<0).length,flat=marked.length-up-down
  el('exchange-breadth-label').innerHTML=marked.length?`<strong>${up} up</strong><span>${flat} flat</span><strong>${down} down</strong>`:'<span>Waiting for reference prices</span>'
  el('exchange-breadth-track').innerHTML=[up,flat,down].map((count,i)=>`<i class="pulse-${i}" style="--weight:${count}"></i>`).join('')
  const sorted=marked.sort((a,b)=>b.percent-a.percent)
  const gainer=sorted.find(s=>s.percent>0),decliner=sorted.at(-1)
  const card=(stock:typeof gainer,caption:string)=>stock?`<button type="button" data-stock="${stock.symbol}"><span><small>${caption}</small><strong>${stock.symbol}</strong></span>${quoteTag(stock.percent)}</button>`:''
  el('exchange-movers').innerHTML=card(gainer,'Top gainer')+card(decliner&&decliner.percent<0?decliner:undefined,'Top decline')
}
function toggleWatch(symbol:string){
  if(watched.has(symbol))watched.delete(symbol)
  else watched.add(symbol)
  try{localStorage.setItem('stock-watch:'+accountName,JSON.stringify([...watched]))}catch{}
  if(mode==='market')renderMarket()
  if(selected===symbol)setWatch(el<HTMLButtonElement>('stock-watch'),symbol)
}
function setWatch(button:HTMLButtonElement,symbol:string){
  const on=watched.has(symbol)
  button.setAttribute('aria-pressed',String(on))
  button.setAttribute('aria-label',(on?'Remove ':'Watch ')+symbol+(on?' from watchlist':''))
  button.title=on?'Remove from watchlist':'Add to watchlist'
  button.innerHTML=`<span aria-hidden="true">${on?'★':'☆'}</span>`
}
function paintTrend(row:HTMLTableRowElement){
  const symbol=row.dataset.openStock!,q=state?.quotes[symbol]
  const history=historyBySymbol.get(symbol)??trendBySymbol.get(symbol)??q?.history??[]
  const recent=history.slice(-22).map(p=>p.price)
  const canvas=row.querySelector('canvas')!
  if(recent.length>1)canvas.title='Latest recorded prices'
  else if(q&&q.price-q.change>0){
    recent.splice(0,recent.length,q.price-q.change,q.price)
    canvas.title='Previous close to last price'
  }
  if(recent.length>1)sparkline(canvas,recent,recent.at(-1)!>=recent[0]?'#85d7af':'#e59791')
}
function queueTrends(){
  if(trendActive)return
  clearTimeout(trendTimer)
  if(mode==='market'&&!document.hidden&&!matchMedia('(max-width:650px)').matches)trendTimer=window.setTimeout(loadTrends,300)
}
async function loadTrends(){
  if(mode!=='market'||document.hidden||matchMedia('(max-width:650px)').matches)return
  const now=Date.now(),symbols=visibleTrendRows().map(row=>row.dataset.openStock!).filter(symbol=>!historyBySymbol.has(symbol)&&!trendBySymbol.has(symbol)&&!historyLoading.has(symbol)&&(trendRetry.get(symbol)??0)<now).slice(0,3)
  if(!symbols.length)return
  trendActive=true
  try{
    const response=await fetch('/api/stocks/trends?symbols='+symbols.map(encodeURIComponent).join(','),{signal:AbortSignal.timeout(12_000)})
    if(!response.ok)throw new Error('Market trends unavailable')
    const {trends}=await response.json() as {trends:Record<string,PricePoint[]>}
    for(const symbol of symbols){
      const points=trends[symbol]
      if(points?.length)trendBySymbol.set(symbol,points)
      else trendRetry.set(symbol,Date.now()+90_000)
    }
    if(mode==='market')visibleTrendRows().forEach(paintTrend)
  }catch{for(const symbol of symbols)trendRetry.set(symbol,Date.now()+90_000)}
  finally{trendActive=false;queueTrends()}
}
function renderMarket(){
  if(!state)return
  const search=input('exchange-search').trim().toLowerCase(),sector=input('exchange-sector'),sort=input('exchange-sort'),move=input('exchange-move')
  const budget=el<HTMLInputElement>('exchange-budget').checked,quote=state.quotes
  const listed=STOCKS.filter(s=>{
    const q=quote[s.symbol]
    return (!sector||s.sector===sector)
      &&(!search||s.symbol.toLowerCase().includes(search)||s.name.toLowerCase().includes(search))
      &&(scope==='all'||(scope==='watch'?watched.has(s.symbol):Boolean(state?.portfolio.positions[s.symbol]?.shares)))
      &&(!budget||(validQuote(s.symbol)&&q.price<=state!.coins))
      &&(!move||(validQuote(s.symbol)&&(move==='up'?q.percent>0:move==='down'?q.percent<0:q.percent===0)))
  })
  listed.sort((a,b)=>{
    if(sort==='name'||sort==='symbol')return a[sort==='name'?'name':'symbol'].localeCompare(b[sort==='name'?'name':'symbol'])
    const aq=quote[a.symbol],bq=quote[b.symbol]
    if(!aq||!bq)return Number(!aq)-Number(!bq)||a.name.localeCompare(b.name)
    const metric=sort.startsWith('price')?'price':'percent',direction=sort==='price-desc'||sort==='gainers'?-1:1
    return (aq[metric]-bq[metric])*direction||a.name.localeCompare(b.name)
  })
  page=Math.max(0,Math.min(page,Math.ceil(listed.length/maxRows)-1))
  const start=page*maxRows,rows=listed.slice(start,start+maxRows)
  const host=el('exchange-market-list')
  const focus=document.activeElement instanceof HTMLButtonElement&&host.contains(document.activeElement)?{symbol:document.activeElement.dataset.stock,watch:document.activeElement.dataset.watch}:undefined
  host.innerHTML=rows.length?`<table class="exchange-stock-table"><thead><tr><th scope="col"><span class="stock-only-reader">Watchlist</span></th><th scope="col">Company</th><th scope="col" class="exchange-sector-name">Sector</th><th scope="col" class="exchange-trend">Recent prices</th><th scope="col">Price</th><th scope="col">Day</th></tr></thead><tbody>`+
    rows.map(s=>{
      const q=quote[s.symbol]
      return `<tr class="exchange-list-row" data-open-stock="${s.symbol}"><td><button type="button" class="exchange-watch" data-watch="${s.symbol}"></button></td><th scope="row"><button type="button" class="exchange-company" data-stock="${s.symbol}"><i aria-hidden="true" style="--company-color:${sectorColor(s.sector)}">${s.symbol.slice(0,2)}</i><span><b>${s.symbol}</b><small>${s.name}</small></span></button></th><td class="exchange-sector-name">${s.sector}</td><td class="exchange-trend"><canvas aria-hidden="true"></canvas></td><td><strong>${q?casinoCoins(q.price):'—'}</strong></td><td>${q?quoteTag(q.percent):'—'}</td></tr>`
    }).join('')+'</tbody></table>':'<div class="exchange-empty"><strong>'+ (scope==='watch'&&!watched.size?'Your watchlist is empty':scope==='owned'&&!Object.keys(state.portfolio.positions).some(s=>!isEquity(s))?'No US stocks owned':'No stocks match these filters')+'</strong><span> '+(scope==='watch'&&!watched.size?'Star a stock to add it here.':'Try a different scope or clear your filters.')+'</span></div>'
  visibleTrendRows().forEach(row=>{
    setWatch(row.querySelector('button[data-watch]')!,row.dataset.openStock!)
    paintTrend(row)
  })
  queueTrends()
  if(focus?.watch||focus?.symbol){
    const match=Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(b=>focus.watch?b.dataset.watch===focus.watch:b.dataset.stock===focus.symbol)
    ;(match??document.querySelector<HTMLButtonElement>(`[data-scope="${scope}"]`))?.focus({preventScroll:true})
  }
  el('exchange-watch-count').textContent=String(watched.size)
  el('exchange-market-count').textContent=rows.length?`${start+1}–${start+rows.length} of ${listed.length} stocks`:'0 matching stocks'
  el('exchange-page').textContent=`${page+1} / ${Math.max(1,Math.ceil(listed.length/maxRows))}`
  el('exchange-reset').hidden=!search&&!sector&&!move&&sort==='name'&&!budget&&scope==='all'
  el<HTMLButtonElement>('exchange-prev').disabled=page===0
  el<HTMLButtonElement>('exchange-next').disabled=start+rows.length>=listed.length
}
function renderPortfolio(){
  const owned=Object.entries(state!.portfolio.positions).sort(([a],[b])=>a.localeCompare(b))
  el('exchange-portfolio').innerHTML=owned.length?`<div class="exchange-table-heading exchange-holdings"><span>Holding</span><span>Shares</span><span>Value</span><span>Return</span><span></span></div>`+
    owned.map(([symbol,h])=>{
      const price=mark(symbol),value=price===undefined?undefined:Math.round(price*h.shares*100)/100
      const gain=value===undefined?0:value-h.cost
      return `<button type="button" class="exchange-stock-row exchange-holdings" data-stock="${symbol}"><span class="exchange-company"><b>${symbol}</b><span>${label(symbol)}</span></span><span>${casinoCoins(h.shares)}</span><strong>${value===undefined?'—':casinoCoins(value)}</strong><b class="${changeClass(gain)}">${value===undefined?'—':signed(gain)}</b><span aria-hidden="true">›</span></button>`
    }).join(''):'<p class="exchange-empty">Your holdings will appear here after your first trade.</p>'
}
function renderActivity(){
  const {trades,dividends}=state!.portfolio
  const entries=[
    ...trades.map(t=>({at:t.at,html:`<li><div><strong>${t.side==='buy'?'Bought':'Sold'} ${casinoCoins(t.shares)} ${t.symbol}</strong><small>${stamp(t.at)}</small></div><b class="${t.side==='sell'?'is-gain':''}">${t.side==='sell'?'+':'−'}${coins(t.total)}</b></li>`})),
    ...dividends.map(d=>({at:Date.parse(d.day+'T23:00:00'),html:`<li><div><strong>${d.symbol??CAS} dividend</strong><small>${d.day} · ${casinoCoins(d.shares)} shares</small></div><b class="is-gain">+${coins(d.amount)}</b></li>`})),
  ].sort((a,b)=>b.at-a.at)
  el('exchange-activity').innerHTML=entries.length?`<ul class="exchange-ledger">${entries.map(entry=>entry.html).join('')}</ul>`:'<p class="exchange-empty">Trades and dividends will appear here.</p>'
}

const orderMarkup=`<form class="exchange-ticket">
  <h3>Place an order</h3>
  <div class="exchange-sides" role="group" aria-label="Trade side"><button type="button" data-side="buy" aria-pressed="true">Buy</button><button type="button" data-side="sell" aria-pressed="false">Sell</button></div>
  <div class="exchange-quantity"><label>Shares <span><input name="quantity" type="number" min="1" max="${MAX_STOCK_ORDER}" step="1" value="1" inputmode="numeric" required><button type="button" data-max aria-label="Set maximum shares">Max</button></span></label><small data-holding></small></div>
  <div class="exchange-ticket-total"><span>Order total<strong data-total></strong><small data-average hidden></small></span><button type="submit" data-submit></button></div>
  <p class="exchange-order-limit" data-order-limit hidden></p>
  <p class="exchange-order-message" role="status" data-order-message hidden></p>
</form>`
for(const prefix of ['cas','stock'])el(prefix+'-order').innerHTML=orderMarkup

const ticket=()=>el(selected===CAS?'cas-order':'stock-order').querySelector<HTMLFormElement>('form')!
const quantity=()=>Number(ticket().querySelector<HTMLInputElement>('input')!.value)
function estimate(shares:number){
  if(!state||!validQuote(selected)||!Number.isSafeInteger(shares)||shares<1||shares>MAX_STOCK_ORDER)return undefined
  if(isEquity(selected)){
    const equity=issue(selected)
    if(!equity||side==='buy'&&shares>equity.available||side==='sell'&&shares>equity.float-equity.available)return undefined
    return equityOrderTotal(selected,equity,side,shares)
  }
  return Math.round(state.quotes[selected].price*100)*shares/100
}
function orderMessage(text:string,bad=false){
  const node=ticket().querySelector<HTMLElement>('[data-order-message]')!
  node.textContent=text;node.hidden=!text;node.classList.toggle('is-loss',bad)
}
function renderTicket(){
  const form=ticket(),shares=quantity(),value=estimate(shares),held=state!.portfolio.positions[selected]?.shares??0
  const avgCost=held?Math.round(state!.portfolio.positions[selected].cost/held*100)/100:0
  form.querySelector('[data-holding]')!.textContent=`${coins(state!.coins)} available · ${casinoCoins(held)} shares held${held?' at '+casinoCoins(avgCost)+' average':''}`
  const average=form.querySelector<HTMLElement>('[data-average]')!
  average.hidden=value===undefined||shares<2
  average.textContent=value===undefined?'':`${casinoCoins(Math.round(value/shares*100)/100)} per share`
  form.querySelector('[data-total]')!.textContent=value===undefined?'—':coins(value)
  const submit=form.querySelector<HTMLButtonElement>('[data-submit]')!
  const allowed=value!==undefined&&(side==='buy'?value<=state!.coins:shares<=held)
  const limit=form.querySelector<HTMLElement>('[data-order-limit]')!
  limit.textContent=shares>0&&!working&&!allowed?(side==='sell'&&shares>held?'You have fewer shares than this order.':!validQuote(selected)?'This price is unavailable for trading.':isEquity(selected)&&side==='buy'&&shares>(issue(selected)?.available??0)?'This order exceeds the available float.':value!==undefined&&side==='buy'?'Insufficient coins for this order.':''):''
  limit.hidden=!limit.textContent
  const retry=pending?.symbol===selected
  submit.disabled=working||(!allowed&&!retry)
  submit.textContent=working?'Submitting…':retry?'Confirm pending order':`${side==='buy'?'Buy':'Sell'} ${selected}`
  for(const b of form.querySelectorAll<HTMLButtonElement>('[data-side]')){
    b.setAttribute('aria-pressed',String(side===b.dataset.side));b.disabled=working||retry
  }
  form.querySelector('input')!.disabled=working||retry
  form.querySelector<HTMLButtonElement>('[data-max]')!.disabled=working||retry||!validQuote(selected)||(side==='sell'?!held:state!.coins<=0)
}
function ownershipSegments(){
  const cas=state!.cas
  return [['CasinoOwner',3000,'#efbe6c'],['Private equity',cas.equity,'#8bb4d1'],['The Keeper',2000,'#bf9cda'],['Public float',cas.float,'#8cdbb1'],['Treasury reserve',1000,'#66837d']] as const
}
function showOwnership(index:number){
  const part=ownershipSegments()
  const [name,count]=part[index<0?3:index]
  let cursor=0
  const fill=part.map(([,shares,color],i)=>{
    const next=cursor+shares/CAS_SHARES*100
    const wedge=`${color}${index>=0&&i!==index?'48':''} ${cursor}% ${next}%`
    cursor=next
    return wedge
  })
  const ring=document.querySelector<HTMLElement>('.exchange-pie')!
  ring.style.background=`conic-gradient(from -90deg,${fill.join(',')})`
  el('cas-pie-value').textContent=casinoCoins(count/CAS_SHARES*100)+'%'
  el('cas-pie-label').textContent=name
  document.querySelectorAll<HTMLButtonElement>('[data-owner]').forEach(b=>b.classList.toggle('is-highlight',Number(b.dataset.owner)===index))
}
function chooseOwner(index:number){
  ownershipIndex=ownershipIndex===index?-1:index
  document.querySelectorAll<HTMLButtonElement>('[data-owner]').forEach((button,i)=>button.setAttribute('aria-pressed',String(i===ownershipIndex)))
  showOwnership(ownershipIndex)
}
const ownershipPie=document.querySelector<HTMLElement>('.exchange-pie')!
function sliceAt(event:MouseEvent){
  const r=ownershipPie.getBoundingClientRect(),x=event.clientX-r.left-r.width/2,y=event.clientY-r.top-r.height/2
  const radius=Math.hypot(x,y)/(r.width/2)
  if(radius<.64||radius>1)return -1
  const fraction=((Math.atan2(x,-y)+Math.PI*2.5)%(2*Math.PI))/(Math.PI*2)
  let count=0
  return ownershipSegments().findIndex(([,size])=>{count+=size;return fraction<count/CAS_SHARES})
}
ownershipPie.addEventListener('pointermove',event=>{
  if(selected!==CAS||event.pointerType!=='mouse')return
  const index=sliceAt(event)
  showOwnership(index<0?ownershipIndex:index)
})
ownershipPie.addEventListener('pointerleave',()=>{if(selected===CAS)showOwnership(ownershipIndex)})
ownershipPie.addEventListener('click',event=>{
  const index=sliceAt(event)
  if(index>=0)chooseOwner(index)
})
function renderCas(){
  const cas=state!.cas
  el('cas-price').textContent=coins(cas.price)
  el('cas-available').textContent=`${casinoCoins(cas.available)} shares available`
  el('cas-spread').textContent=`Bid ${cas.bid?casinoCoins(cas.bid):'—'} · Ask ${cas.ask?casinoCoins(cas.ask):'—'}`
  el('cas-total-shares').textContent=`${casinoCoins(CAS_SHARES)} shares issued`
  el('cas-float-note').textContent=`Players hold ${casinoCoins(cas.float-cas.available)} of ${casinoCoins(cas.float)} public shares.`
  const legend=document.querySelector<HTMLElement>('.exchange-ownership-list')!,segments=ownershipSegments()
  const composition=segments.map(([,n])=>n).join(',')
  if(legend.dataset.composition!==composition){
    legend.dataset.composition=composition
    legend.innerHTML=segments.map(([name,n,color],i)=>`<button type="button" data-owner="${i}" aria-pressed="false"><span><i style="background:${color}"></i><span>${name}<small>${casinoCoins(n)} shares</small></span></span><b>${casinoCoins(n/CAS_SHARES*100)}%</b></button>`).join('')
    legend.querySelectorAll<HTMLButtonElement>('button').forEach((button,i)=>{
      button.addEventListener('pointerenter',()=>showOwnership(i))
      button.addEventListener('pointerleave',()=>showOwnership(ownershipIndex))
      button.addEventListener('focus',()=>showOwnership(i))
      button.addEventListener('blur',()=>showOwnership(ownershipIndex))
      button.onclick=()=>chooseOwner(i)
    })
  }
  showOwnership(ownershipIndex)
  const dividend=cas.lastDividend
  el('cas-dividends').innerHTML=dividend?`<div><dt>Last allocation · ${dividend.day}</dt><dd>${coins(dividend.pool)}</dd></div><div><dt>Paid to players</dt><dd>${coins(dividend.paid)}</dd></div>`:'<div><dt>First allocation</dt><dd>Pending</dd></div>'
  el('cas-moves').innerHTML=cas.equityMoves.length?cas.equityMoves.slice(0,5).map(move=>`<div class="cas-move"><span>${move.side==='sell'?'Released to public':'Bought back'} · ${simpleDate(move.at)}</span><b>${casinoCoins(move.shares)} shares</b></div>`).join(''):'<p class="exchange-muted">No equity transactions yet.</p>'
  casChart.set(cas.history,'#e6ba72')
}
function renderBankShare(){
  const bank=state!.bank,info=el('stock-bank-info')
  info.hidden=false
  el('stock-title').textContent=label(BNK)
  el('stock-sector').textContent='In-game equity'
  const monogram=el('stock-monogram')
  monogram.innerHTML=icon('bank');monogram.style.setProperty('--company-color','#a8d4eb')
  el('stock-symbol').textContent=BNK
  el('stock-watch').hidden=true
  el('stock-price').textContent=coins(bank.price)
  const change=el('stock-change')
  change.textContent=`Bid ${bank.bid?casinoCoins(bank.bid):'—'} · Ask ${bank.ask?casinoCoins(bank.ask):'—'}`;change.className=''
  el('stock-chart-status').textContent='Bank share prices · In-game orders'
  const history=bank.history.filter(p=>p.at>=state!.now-range*dayMs)
  stockChart.set(history,'#97d2ea')
  const held=state!.portfolio.positions[BNK]?.shares??0
  el('stock-range-stats').innerHTML=`<div><dt>Public shares</dt><dd>${casinoCoins(bank.float)}</dd></div><div><dt>Available</dt><dd>${casinoCoins(bank.available)}</dd></div><div><dt>You hold</dt><dd>${casinoCoins(held)}</dd></div><div><dt>Price records</dt><dd>${history.length}</dd></div>`
  const accrual=bank.lastDividend
  el('stock-bank-details').innerHTML=`<div><dt>Issued shares</dt><dd>${casinoCoins(BANK_SHARE_COUNT)}</dd></div><div><dt>Last allocation</dt><dd>${accrual?coins(accrual.pool):'Pending'}</dd></div><div><dt>Paid to you</dt><dd>${coins(state!.portfolio.bankDividendsPaid??0)}</dd></div>`
}
function renderStock(){
  el('stock-bank-info').hidden=true
  el('stock-watch').hidden=false
  const active=selected,q=state!.quotes[active],symbol=symbols.get(active)!,history=historyBySymbol.get(active)
  el('stock-title').textContent=symbol.name
  el('stock-sector').textContent=symbol.sector
  const monogram=el('stock-monogram')
  monogram.textContent=active.slice(0,2);monogram.style.setProperty('--company-color',sectorColor(symbol.sector))
  el('stock-symbol').textContent=active
  setWatch(el<HTMLButtonElement>('stock-watch'),active)
  el('stock-price').textContent=q?coins(q.price):'Price unavailable'
  const changeNode=el('stock-change')
  changeNode.textContent=q?`${signed(q.change)} · ${signed(Math.round(q.percent*100)/100)}% last session${validQuote(active)?'':' · quote expired'}`:'Waiting for reference data'
  changeNode.className=changeClass(q?.percent??0)
  const points=(history??q?.history??[]).filter(p=>p.at>=state!.now-range*dayMs)
  const from=points[0],last=points.at(-1)
  const performance=from&&last?(last.price/from.price-1)*100:0
  el('stock-chart-status').textContent=history?'Nasdaq daily close and volume':historyLoading.has(active)?'Loading Nasdaq history…':'Saved quote history'
  el('stock-range-stats').innerHTML=points.length&&from?`<div><dt>Range change</dt><dd class="${changeClass(performance)}">${points.length>1?signed(Math.round(performance*100)/100)+'%':'—'}</dd></div><div><dt>${history?'Highest close':'High'}</dt><dd>${casinoCoins(Math.max(...points.map(p=>p.price)))}</dd></div><div><dt>${history?'Lowest close':'Low'}</dt><dd>${casinoCoins(Math.min(...points.map(p=>p.price)))}</dd></div><div><dt>${history?'Sessions':'Records'}</dt><dd>${points.length}</dd></div>`:''
  stockChart.set(points,performance<0?'#e79e94':'#8ce1b2')
}
function renderDetail(){
  if(!selected||!state)return
  if(selected===CAS)renderCas()
  else if(selected===BNK)renderBankShare()
  else renderStock()
  renderTicket()
}
async function loadHistory(symbol:string){
  if(historyBySymbol.has(symbol)||historyLoading.has(symbol)||(historyRetry.get(symbol)??0)>Date.now())return
  historyLoading.add(symbol)
  if(selected===symbol)renderStock()
  try{
    const {points}=await api<{points:PricePoint[]}>('/stocks/history?symbol='+encodeURIComponent(symbol))
    historyBySymbol.set(symbol,points)
    if(mode==='market')visibleTrendRows().filter(row=>row.dataset.openStock===symbol).forEach(paintTrend)
  }catch{historyRetry.set(symbol,Date.now()+60_000)}
  finally{
    historyLoading.delete(symbol)
    if(selected===symbol)renderDetail()
  }
}
function openStock(symbol:string){
  if(!state||isEquity(symbol)&&!issue(symbol)||!isEquity(symbol)&&!symbols.has(symbol))return
  selected=symbol
  ownershipIndex=-1
  if(symbol===CAS){
    document.querySelectorAll<HTMLButtonElement>('[data-owner]').forEach(b=>b.setAttribute('aria-pressed','false'))
  }else{
    range=30
    for(const b of document.querySelectorAll<HTMLButtonElement>('[data-range]'))b.setAttribute('aria-pressed',String(Number(b.dataset.range)===range))
  }
  const queued=pending?.symbol===symbol?pending:undefined
  side=queued?.side??'buy'
  ticket().querySelector('input')!.value=String(queued?.shares??1)
  orderMessage('')
  el<HTMLDialogElement>(symbol===CAS?'exchange-cas-dialog':'exchange-stock-dialog').showModal()
  renderDetail()
  if(!isEquity(symbol))void loadHistory(symbol)
}
function savePending(value?:StockOrder){
  pending=value
  try{if(value)sessionStorage.setItem('stock-order:'+accountName,JSON.stringify(value));else sessionStorage.removeItem('stock-order:'+accountName)}catch{}
}
async function refresh(){
  if(refreshing||working)return
  refreshing=true
  try{const next=await api<StockView>('/stocks');marketFailed=false;setState(next)}
  catch(error){
    marketFailed=true
    if(!state){loading.hidden=false;loading.textContent=error instanceof Error?error.message:'The exchange is temporarily unavailable.'}
    else renderExchange()
  }finally{refreshing=false}
}
function showTrade(trade:StockTrade){
  orderMessage(`${trade.side==='buy'?'Bought':'Sold'} ${casinoCoins(trade.shares)} ${trade.symbol} for ${coins(trade.total)}.`)
}
async function trade(event:SubmitEvent){
  event.preventDefault()
  if(working||!selected||!state)return
  let request=pending
  if(request&&request.symbol!==selected){orderMessage(`Review your pending ${request.symbol} order first.`,true);return}
  if(!request){
    const shares=quantity(),total=estimate(shares)
    if(total===undefined)return
    request={symbol:selected,side,shares,total,sequence:state.portfolio.sequence+1,id:crypto.randomUUID(),version:issue(selected)?.version}
    savePending(request)
  }
  working=true;orderMessage('');renderTicket()
  try{
    const result=await api<StockView&{trade:StockTrade}>('/stocks/trade',request)
    savePending()
    setState(result)
    if(selected===request.symbol)showTrade(result.trade)
  }catch(error){
    const message=error instanceof Error?error.message:'The order could not be confirmed.'
    try{
      const next=await api<StockView>('/stocks'),receipt=next.portfolio.trades.find(t=>t.id===request.id)
      if(receipt){savePending();setState(next);if(selected===request.symbol)showTrade(receipt);return}
      if(error instanceof ApiError&&(error.status===503||error.status>=400&&error.status<500))savePending()
      setState(next)
    }catch{}
    if(selected===request.symbol)orderMessage(message,true)
  }finally{working=false;if(selected)renderTicket()}
}

for(const prefix of ['cas','stock']){
  const form=el(prefix+'-order').querySelector<HTMLFormElement>('form')!
  form.onsubmit=trade
  form.querySelector('input')!.oninput=renderTicket
  form.querySelector<HTMLButtonElement>('[data-max]')!.onclick=()=>{
    if(!selected||!state)return
    let max=side==='sell'?Math.min(MAX_STOCK_ORDER,state.portfolio.positions[selected]?.shares??0):0
    if(side==='buy'){
      let high=Math.min(MAX_STOCK_ORDER,issue(selected)?.available??MAX_STOCK_ORDER)
      while(max<high){
        const mid=Math.ceil((max+high)/2)
        if((estimate(mid)??Infinity)<=state.coins)max=mid
        else high=mid-1
      }
    }
    if(max>0)form.querySelector('input')!.value=String(max)
    renderTicket()
  }
  form.querySelectorAll<HTMLButtonElement>('[data-side]').forEach(button=>button.onclick=()=>{
    side=button.dataset.side as StockSide;orderMessage('');renderTicket()
  })
}
for(const id of ['exchange-stock-dialog','exchange-cas-dialog']){
  el<HTMLDialogElement>(id).addEventListener('close',()=>selected='')
}
document.querySelector('.exchange')!.addEventListener('click',event=>{
  const target=event.target as Element
  const watch=target.closest<HTMLButtonElement>('[data-watch]')
  if(watch){toggleWatch(watch.dataset.watch!);return}
  const symbol=target.closest<HTMLElement>('[data-stock]')?.dataset.stock??target.closest<HTMLElement>('[data-open-stock]')?.dataset.openStock
  if(symbol)openStock(symbol)
})
el('stock-watch').onclick=()=>{if(selected)toggleWatch(selected)}
document.querySelectorAll<HTMLButtonElement>('[data-range]').forEach(b=>b.onclick=()=>{
  range=Number(b.dataset.range)
  document.querySelectorAll<HTMLButtonElement>('[data-range]').forEach(button=>button.setAttribute('aria-pressed',String(button===b)))
  if(selected&&selected!==CAS)renderDetail()
})
function changeScope(next:string){
  scope=next;page=0
  document.querySelectorAll<HTMLButtonElement>('[data-scope]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scope===scope)))
  renderMarket()
}
document.querySelectorAll<HTMLButtonElement>('[data-scope]').forEach(b=>b.onclick=()=>changeScope(b.dataset.scope!))
el('exchange-reset').onclick=()=>{
  el<HTMLInputElement>('exchange-search').value=''
  for(const id of ['exchange-sector','exchange-move'])el<HTMLSelectElement>(id).value=''
  el<HTMLSelectElement>('exchange-sort').value='name'
  el<HTMLInputElement>('exchange-budget').checked=false
  changeScope('all')
  el<HTMLInputElement>('exchange-search').focus()
}
document.addEventListener('keydown',event=>{
  if(event.key==='/'&&mode==='market'&&!selected&&!(event.target instanceof HTMLElement&&event.target.closest('input,textarea,select,[contenteditable]'))){
    event.preventDefault();el('exchange-search').focus()
  }
})
for(const button of nodes)button.onclick=()=>{
  mode=button.dataset.exchangeView!
  for(const tab of nodes){const current=mode===tab.dataset.exchangeView;el('exchange-'+tab.dataset.exchangeView).hidden=!current;tab.setAttribute('aria-pressed',String(current))}
  renderExchange()
}
for(const id of ['exchange-search','exchange-sector','exchange-sort','exchange-move','exchange-budget'])el(id).addEventListener('input',()=>{page=0;renderMarket()})
el('exchange-prev').onclick=()=>{page--;renderMarket()}
el('exchange-next').onclick=()=>{page++;renderMarket()}
window.addEventListener('resize',()=>{if(selected)renderDetail();queueTrends()})
document.addEventListener('visibilitychange',queueTrends)
async function start(){
  const auth=await initShell()
  if(!auth?.user){loading.hidden=false;loading.innerHTML='<a href="/chess/login.html">Log in to open the exchange ›</a>';return}
  accountName=auth.user
  profile=auth.profile??undefined
  try{
    const saved=JSON.parse(localStorage.getItem('stock-watch:'+accountName)??'[]')
    if(Array.isArray(saved))for(const ticker of saved)if(symbols.has(ticker))watched.add(ticker)
  }catch{}
  try{pending=JSON.parse(sessionStorage.getItem('stock-order:'+accountName)??'null')??undefined}catch{}
  await refresh()
  if(state&&location.hash==='#cas')openStock(CAS)
  if(state&&location.hash==='#bnk')openStock(BNK)
  const monitor=async()=>{
    if(!document.hidden)await refresh()
    window.setTimeout(monitor,state&&Object.keys(state.quotes).length?60_000:12_000)
  }
  window.setTimeout(monitor,state&&Object.keys(state.quotes).length?60_000:12_000)
}
void start()
