import {api,ApiError,initShell,renderAccount} from './shell.ts'
import {icon} from './icons.ts'
import {casinoCoins} from './casino-model.ts'
import type {Profile} from './account-model.ts'
import {STOCKS,SECTORS} from './stock-catalog.ts'
import {CAS,CAS_SHARES,MAX_STOCK_ORDER,QUOTE_MAX_AGE,casOrderTotal,type StockOrder,type StockSide,type StockTrade,type StockView} from './stock-model.ts'

const el=<E extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as E
const nodes=[...document.querySelectorAll<HTMLButtonElement>('[data-exchange-view]')]
const symbols=new Map<string,{name:string;sector:string}>(STOCKS.map(s=>[s.symbol,s]))
const label=(symbol:string)=>symbol===CAS?'The Casino':symbols.get(symbol)?.name??symbol
const coins=(value:number)=>casinoCoins(value)+' coins'
const signed=(value:number)=>value===0?'0':(value>0?'+':'−')+casinoCoins(Math.abs(value))
const changeClass=(v:number)=>v>0?'is-gain':v<0?'is-loss':''
const stamp=(time:number)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Amsterdam',dateStyle:'short',timeStyle:'short'}).format(time)
const simpleDate=(time:number)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Amsterdam',month:'short',day:'numeric'}).format(time)
const maxRows=15
let state:StockView|undefined,profile:Profile|undefined,page=0,mode='market',selected='',side:StockSide='buy',working=false,refreshing=false
let pending:StockOrder|undefined,accountName='',marketFailed=false
const loading=el('exchange-load-error')
const app=el('exchange-app')
el('exchange-search-icon').innerHTML=icon('search')
el('exchange-cas-art').innerHTML=icon('wheel')
el<HTMLSelectElement>('exchange-sector').insertAdjacentHTML('beforeend',SECTORS.map(sector=>`<option>${sector}</option>`).join(''))
const input=<I extends HTMLInputElement|HTMLSelectElement>(id:string)=>el<I>(id).value
const mark=(symbol:string)=>symbol===CAS?state!.cas.price:state!.quotes[symbol]?.price
const validQuote=(symbol:string)=>symbol===CAS||Boolean(state?.quotes[symbol]&&state.now-state.quotes[symbol].updated<QUOTE_MAX_AGE)

function setState(next:StockView){
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
  el('exchange-dividends').textContent=casinoCoins(state.portfolio.dividendsPaid)
  const marks=Object.values(state.quotes)
  const last=marks.length?Math.max(...marks.map(q=>q.updated)):0
  el('exchange-feed-time').textContent=marketFailed?'Refresh unavailable · showing saved prices':last?`${marks.length}/100 priced · Refreshed ${stamp(last)}`:'Waiting for the first price refresh'
  el('exchange-cas-price').textContent=coins(state.cas.price)
  el('exchange-cas-float').textContent=`${state.cas.float/CAS_SHARES*100}% public float · ${casinoCoins(state.cas.available)} available`
  if(mode==='market')renderMarket()
  else if(mode==='portfolio')renderPortfolio()
  else renderActivity()
  if(selected)renderDetail()
}
function renderMarket(){
  if(!state)return
  const search=input('exchange-search').trim().toLowerCase(),sector=input('exchange-sector'),sort=input('exchange-sort')
  const listed=STOCKS.filter(s=>(!sector||s.sector===sector)&&(!search||s.symbol.toLowerCase().includes(search)||s.name.toLowerCase().includes(search)))
  const quote=state.quotes
  listed.sort((a,b)=>{
    if(sort==='name')return a.name.localeCompare(b.name)
    if(sort==='price')return (quote[a.symbol]?.price??Infinity)-(quote[b.symbol]?.price??Infinity)||a.name.localeCompare(b.name)
    if(!quote[a.symbol]||!quote[b.symbol])return Number(!quote[a.symbol])-Number(!quote[b.symbol])||a.name.localeCompare(b.name)
    return (quote[a.symbol].percent-quote[b.symbol].percent)*(sort==='gainers'?-1:1)||a.name.localeCompare(b.name)
  })
  page=Math.max(0,Math.min(page,Math.ceil(listed.length/maxRows)-1))
  const start=page*maxRows
  const rows=listed.slice(start,start+maxRows)
  el('exchange-market-list').innerHTML=rows.length?`<div class="exchange-table-heading"><span>Company</span><span>Sector</span><span>Price</span><span>Day</span><span></span></div>`+
    rows.map(s=>{
      const q=quote[s.symbol]
      return `<button type="button" class="exchange-stock-row" data-stock="${s.symbol}"><span class="exchange-company"><b>${s.symbol}</b><span>${s.name}</span></span><span class="exchange-sector-name">${s.sector}</span><strong>${q?casinoCoins(q.price):'—'}</strong><b class="${changeClass(q?.percent??0)}">${q?signed(q.percent)+'%':'—'}</b><span aria-hidden="true">›</span></button>`
    }).join(''):'<p class="exchange-empty">No stocks match your filters.</p>'
  el('exchange-market-count').textContent=rows.length?`${start+1}–${start+rows.length} of ${listed.length}`:'0 stocks'
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
    ...dividends.map(d=>({at:Date.parse(d.day+'T23:00:00'),html:`<li><div><strong>CAS dividend</strong><small>${d.day} · ${casinoCoins(d.shares)} shares</small></div><b class="is-gain">+${coins(d.amount)}</b></li>`})),
  ].sort((a,b)=>b.at-a.at)
  el('exchange-activity').innerHTML=entries.length?`<ul class="exchange-ledger">${entries.map(entry=>entry.html).join('')}</ul>`:'<p class="exchange-empty">Trades and dividends will appear here.</p>'
}

function chart(prefix:string,series:{at:number;price:number}[],color:string){
  const canvas=el<HTMLCanvasElement>(prefix+'-chart'),ctx=canvas.getContext('2d')
  if(!ctx)return
  const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height
  if(!w||!h)return
  const scale=Math.min(2,window.devicePixelRatio)
  canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale)
  ctx.scale(scale,scale)
  ctx.strokeStyle='#dce8df1c';ctx.lineWidth=1
  for(let i=1;i<5;i++){const y=h*i/5;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
  el(prefix+'-chart-first').textContent=series.length?simpleDate(series[0].at):''
  el(prefix+'-chart-last').textContent=series.length>1?simpleDate(series.at(-1)!.at):''
  if(!series.length)return
  const low=Math.min(...series.map(n=>n.price)),high=Math.max(...series.map(n=>n.price))
  const range=Math.max(high-low,high*.002,.01)
  const points=series.map((n,i)=>({x:i/Math.max(1,series.length-1)*(w-14)+7,y:h*.83-(n.price-low)/range*h*.64}))
  ctx.beginPath()
  if(points.length===1){ctx.moveTo(7,h/2);ctx.lineTo(w-7,h/2)}
  else points.forEach((point,i)=>i?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y))
  ctx.strokeStyle=color;ctx.lineWidth=2.2;ctx.lineJoin='round';ctx.stroke()
  if(points.length<2)return
  ctx.lineTo(w-7,h);ctx.lineTo(7,h);ctx.closePath()
  const glow=ctx.createLinearGradient(0,0,0,h)
  glow.addColorStop(0,color+'40');glow.addColorStop(1,color+'00');ctx.fillStyle=glow;ctx.fill()
}

const orderMarkup=`<form class="exchange-ticket">
  <div class="exchange-sides" role="group" aria-label="Trade side"><button type="button" data-side="buy" aria-pressed="true">Buy</button><button type="button" data-side="sell" aria-pressed="false">Sell</button></div>
  <div class="exchange-quantity"><label>Shares <input name="quantity" type="number" min="1" max="${MAX_STOCK_ORDER}" step="1" value="1" inputmode="numeric" required></label><small data-holding></small></div>
  <div class="exchange-ticket-total"><span>Order total<strong data-total></strong></span><button type="submit" data-submit></button></div>
  <p class="exchange-order-message" role="status" data-order-message hidden></p>
</form>`
for(const prefix of ['cas','stock'])el(prefix+'-order').innerHTML=orderMarkup

const ticket=()=>el(selected===CAS?'cas-order':'stock-order').querySelector<HTMLFormElement>('form')!
const quantity=()=>Number(ticket().querySelector<HTMLInputElement>('input')!.value)
function estimate(shares:number){
  if(!state||!validQuote(selected)||!Number.isSafeInteger(shares)||shares<1||shares>MAX_STOCK_ORDER)return undefined
  if(selected===CAS){
    if(side==='buy'&&shares>state.cas.available||side==='sell'&&shares>state.cas.float-state.cas.available)return undefined
    return casOrderTotal(state.cas,side,shares)
  }
  return Math.round(state.quotes[selected].price*100)*shares/100
}
function orderMessage(text:string,bad=false){
  const node=ticket().querySelector<HTMLElement>('[data-order-message]')!
  node.textContent=text;node.hidden=!text;node.classList.toggle('is-loss',bad)
}
function renderTicket(){
  const form=ticket(),shares=quantity(),value=estimate(shares),held=state!.portfolio.positions[selected]?.shares??0
  form.querySelector('[data-holding]')!.textContent=`You hold ${casinoCoins(held)} · ${coins(state!.coins)} available`
  form.querySelector('[data-total]')!.textContent=value===undefined?'—':coins(value)
  const submit=form.querySelector<HTMLButtonElement>('[data-submit]')!
  const allowed=value!==undefined&&(side==='buy'?value<=state!.coins:shares<=held)
  const retry=pending?.symbol===selected
  submit.disabled=working||(!allowed&&!retry)
  submit.textContent=working?'Submitting…':retry?'Confirm pending order':`${side==='buy'?'Buy':'Sell'} ${selected}`
  for(const b of form.querySelectorAll<HTMLButtonElement>('[data-side]')){
    b.setAttribute('aria-pressed',String(side===b.dataset.side));b.disabled=working||retry
  }
  form.querySelector('input')!.disabled=working||retry
}
function renderCas(){
  const cas=state!.cas
  el('cas-price').textContent=coins(cas.price)
  el('cas-available').textContent=`${casinoCoins(cas.available)} shares available`
  el('cas-spread').textContent=`Bid ${cas.bid?casinoCoins(cas.bid):'—'} · Ask ${cas.ask?casinoCoins(cas.ask):'—'} · ${casinoCoins(CAS_SHARES)} shares issued`
  const segments=[['CasinoOwner',3000,'#d9b16b'],['Private equity',cas.equity,'#8f9cad'],['The Keeper',2000,'#9d80b2'],['Public float',cas.float,'#82c9a2'],['Treasury reserve',1000,'#566761']] as const
  document.querySelector('.exchange-ownership')!.innerHTML=segments.map(([name,n,color])=>`<i title="${name}: ${n/CAS_SHARES*100}%" style="width:${n/CAS_SHARES*100}%;background:${color}"></i>`).join('')
  document.querySelector('.exchange-ownership-list')!.innerHTML=segments.map(([name,n,color])=>`<div><span><i style="background:${color}"></i>${name}</span><b>${casinoCoins(n/CAS_SHARES*100)}%</b></div>`).join('')
  const dividend=cas.lastDividend
  el('cas-dividends').innerHTML=dividend?`<div><dt>Last allocation · ${dividend.day}</dt><dd>${coins(dividend.pool)}</dd></div><div><dt>Paid to players</dt><dd>${coins(dividend.paid)}</dd></div>`:'<div><dt>First allocation</dt><dd>Pending</dd></div>'
  el('cas-moves').innerHTML=cas.equityMoves.length?cas.equityMoves.slice(0,5).map(move=>`<div class="cas-move"><span>${move.side==='sell'?'Released to public':'Bought back'} · ${simpleDate(move.at)}</span><b>${casinoCoins(move.shares)}</b></div>`).join(''):'<p class="exchange-muted">No equity transactions yet.</p>'
  chart('cas',cas.history,'#e6ba72')
}
function renderDetail(){
  if(!selected||!state)return
  if(selected===CAS)renderCas()
  else{
    const q=state.quotes[selected]
    el('stock-title').textContent=label(selected)
    el('stock-sector').textContent=symbols.get(selected)!.sector
    el('stock-symbol').textContent=selected
    el('stock-price').textContent=q?coins(q.price):'Price unavailable'
    const changeNode=el('stock-change')
    changeNode.textContent=q?`${signed(q.percent)}% today${validQuote(selected)?'':' · Quote unavailable for trading'}`:'Waiting for reference data'
    changeNode.className=changeClass(q?.percent??0)
    chart('stock',q?.history??[],(q?.percent??0)<0?'#e6a190':'#8bd4a7')
  }
  renderTicket()
}
function openStock(symbol:string){
  if(!state||symbol!==CAS&&!symbols.has(symbol))return
  selected=symbol
  const queued=pending?.symbol===symbol?pending:undefined
  side=queued?.side??'buy'
  ticket().querySelector('input')!.value=String(queued?.shares??1)
  orderMessage('')
  el<HTMLDialogElement>(symbol===CAS?'exchange-cas-dialog':'exchange-stock-dialog').showModal()
  renderDetail()
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
    request={symbol:selected,side,shares,total,sequence:state.portfolio.sequence+1,id:crypto.randomUUID(),version:selected===CAS?state.cas.version:undefined}
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
  form.querySelectorAll<HTMLButtonElement>('[data-side]').forEach(button=>button.onclick=()=>{
    side=button.dataset.side as StockSide;orderMessage('');renderTicket()
  })
}
for(const id of ['exchange-stock-dialog','exchange-cas-dialog']){
  el<HTMLDialogElement>(id).addEventListener('close',()=>selected='')
}
document.querySelector('.exchange')!.addEventListener('click',event=>{
  const button=(event.target as Element).closest<HTMLButtonElement>('[data-stock]')
  if(button)openStock(button.dataset.stock!)
})
for(const button of nodes)button.onclick=()=>{
  mode=button.dataset.exchangeView!
  for(const tab of nodes){const current=mode===tab.dataset.exchangeView;el('exchange-'+tab.dataset.exchangeView).hidden=!current;tab.setAttribute('aria-pressed',String(current))}
  renderExchange()
}
for(const id of ['exchange-search','exchange-sector','exchange-sort'])el(id).addEventListener('input',()=>{page=0;renderMarket()})
el('exchange-prev').onclick=()=>{page--;renderMarket()}
el('exchange-next').onclick=()=>{page++;renderMarket()}
window.addEventListener('resize',()=>{if(selected)renderDetail()})
async function start(){
  const auth=await initShell()
  if(!auth?.user){loading.hidden=false;loading.innerHTML='<a href="/chess/login.html">Log in to open the exchange ›</a>';return}
  accountName=auth.user
  profile=auth.profile??undefined
  try{pending=JSON.parse(sessionStorage.getItem('stock-order:'+accountName)??'null')??undefined}catch{}
  await refresh()
  if(state&&location.hash==='#cas')openStock(CAS)
  window.setInterval(()=>{if(!document.hidden)void refresh()},60_000)
}
void start()
