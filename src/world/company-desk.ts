import {policies,rescueStages,EQUITY_ORDER_LIMIT,type CompanyView} from '../equity-v2.ts'
import {casinoCoins} from '../casino-model.ts'
import type {MarketOrder} from '../equity-v2.ts'
import type {EquitySymbol,StockView} from '../stock-model.ts'
import {coins,safeText} from './services.ts'

export type DeskTab='trade'|'ownership'|'votes'|'activity'
const fmt=(n:number)=>casinoCoins(n)
const when=(n:number)=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(n)
const pct=(n:number,total:number)=>total?(100*n/total).toFixed(2).replace(/\.?0+$/,'')+'%':'0%'
const colors=['#e5bb75','#90b9d4','#a8d29d','#ba9bce','#e99e94','#74b6ac','#d0cb9b','#c8a572']
export function ownershipSegments(c:CompanyView):[string,number,string][]{
  const major=c.ownership.filter(h=>h.shares>=c.issued*.01).slice(0,8)
  const small=c.issued-c.inventory-major.reduce((n,h)=>n+h.shares,0)
  const list:[string,number,string][]=major.map((h,i)=>[h.name,h.shares,colors[i]])
  if(small)list.push(['Other investors',small,'#8b9b76'])
  if(c.inventory)list.push(['Unsold shares',c.inventory,'#677282'])
  return list
}
function ownership(c:CompanyView){
  const segments=ownershipSegments(c)
  let cursor=0
  const arcs=segments.map(([,shares,tone])=>{const start=cursor;cursor+=100*shares/c.issued;return tone+' '+start+'% '+cursor+'%'})
  return `<div class="world-ownership"><div class="world-pie" aria-hidden="true" style="background:conic-gradient(${arcs.join(',')})"><b>${fmt(c.issued)}<small>shares issued</small></b></div>
   <ul class="world-ledger">${segments.map(([name,n,color])=>`<li><span><i style="background:${color}"></i> ${safeText(name)} <small>${fmt(n)} shares</small></span><b>${pct(n,c.issued)}</b></li>`).join('')}</ul></div>
   <div class="world-metrics"><div><small>Cash reserves</small><b>${coins(c.cash)}</b></div><div><small>Assets</small><b>${coins(c.assets)}</b></div><div><small>Liabilities</small><b>${coins(c.liabilities)}</b></div><div><small>Profit this week</small><b>${coins(c.profit)}</b></div></div>`
}
function orderRows(orders:MarketOrder[]){
  return orders.slice(0,8).map(o=>`<li><span>${safeText(o.holder)} <small>${fmt(o.shares)} shares</small></span><b>${fmt(o.price)}</b></li>`).join('')||'<li>No orders</li>'
}
function trading(c:CompanyView,data:StockView,side:'buy'|'sell'){
  const available=c.votingShares-c.orders.filter(o=>o.side==='sell').reduce((n,o)=>n+o.shares,0)
  const quote=c.symbol==='CAS'?data.cas:data.bank,price=(side==='buy'?quote.ask:quote.bid)||quote.price
  return `<div class="world-equity-books"><section><h3>Buy orders</h3><ul class="world-ledger">${orderRows(c.bids)}</ul></section><section><h3>Sell orders</h3><ul class="world-ledger">${orderRows(c.asks)}</ul></section></div>
    <form class="world-service-form world-limit-order"><label>Side<select name="side"><option value="buy">Buy</option><option value="sell" ${side==='sell'?'selected':''}>Sell</option></select></label>
    <label>Shares<input name="shares" type="number" min="1" max="${EQUITY_ORDER_LIMIT}" step="1" inputmode="numeric" value="1" required></label>
    <label>Limit price per share<input name="price" type="number" min=".0001" step=".0001" inputmode="decimal" value="${price}" required></label>
    <small>${coins(data.coins)} available · ${fmt(available)} shares available to sell</small><strong data-limit-total>${coins(price)}</strong>
    <button type="submit" class="world-primary">Place limit order</button></form>
    <details ${c.orders.length?'open':''}><summary>Your open orders (${c.orders.length})</summary><ul class="world-ledger">${c.orders.map(o=>`<li><span>${o.side==='buy'?'Buy':'Sell'} ${fmt(o.shares)} at ${fmt(o.price)}</span><button data-cancel-order="${safeText(o.id)}" type="button">Cancel</button></li>`).join('')||'<li>No open orders</li>'}</ul></details>`
}
const optionLabel=(policy:string,value:number)=>{
  if(policy==='open')return value?'Open':'Paused'
  if(policy==='stake')return coins(value)
  if(policy==='edge'||policy==='rates'||policy==='interest')return fmt(value/100)+'%'
  if(policy==='term')return value+' days'
  return value+'%'
}
function voting(c:CompanyView,data:StockView){
  const active=c.ballot,cas=data.companies.CAS.bankruptcy
  const stage=c.bankruptcy?.stage,step=stage&&rescueStages[stage.index]
  const options=policies[c.symbol] as Record<string,{label:string;options:readonly number[]}>
  return `<div class="world-metrics"><div><small>Your voting shares</small><b>${fmt(c.votingShares)}</b></div><div><small>Eligible shares</small><b>${fmt(c.eligible)}</b></div></div>
    ${active?`<section class="world-ballot"><h3>${active.policy==='rescue'?'CAS rescue loan':safeText(options[active.policy]?.label??active.policy)+' · '+optionLabel(active.policy,active.value)}</h3>
    ${active.policy==='rescue'&&cas?.stage?`<p>${coins(cas.need*cas.stage.selected[0]/100)} · ${cas.stage.selected[1]} days · ${optionLabel('interest',cas.stage.selected[2])} daily</p>`:''}
    <p>Yes ${pct(active.yes,active.eligible)} · No ${pct(active.no,active.eligible)} · Closes ${when(active.ends)}</p>
    ${active.choice?`<p>You voted ${active.choice}.</p>`:active.weight?`<div class="world-button-row"><button data-vote="yes" data-ballot="${active.id}">Vote yes</button><button data-vote="no" data-ballot="${active.id}">Vote no</button></div>`:'<p>No voting shares at ballot opening.</p>'}</section>`:'<p class="world-muted">No active ballot.</p>'}
    ${step&&stage?`<section class="world-ballot"><h3>Rescue loan · ${step.label}</h3><p>Closes ${when(stage.ends)}</p><div class="world-policy-buttons">${step.options.map(v=>`<button type="button" data-rescue="${v}" data-on="${!stage.mine?.includes(v)}" aria-pressed="${!!stage.mine?.includes(v)}"><b>${optionLabel(step.key,v)}</b><small>${fmt(stage.support[v]??0)} shares</small></button>`).join('')}</div></section>`:''}
    ${c.lastBallot?`<p class="world-muted">Last vote · ${safeText(options[c.lastBallot.policy]?.label??c.lastBallot.policy)} ${c.lastBallot.passed?'passed':'closed without approval'}.</p>`:''}
    <h3>Support a policy</h3><p class="world-muted">More than 5% support qualifies an option for the daily vote.</p>
    ${Object.entries(options).map(([policy,{label,options:values}])=>`<details class="world-policy"><summary>${label}<small>${c.policies[policy]===undefined?'':optionLabel(policy,c.policies[policy])}</small></summary>
      ${c.cooldowns[policy]>data.now?`<p>Available again ${when(c.cooldowns[policy])}</p>`:''}
      <div class="world-policy-buttons">${values.map(value=>{const on=c.supported.includes(policy+':'+value);return `<button type="button" data-policy="${policy}" data-value="${value}" data-on="${!on}" aria-pressed="${on}" ${c.votingShares?'':'disabled'}><b>${optionLabel(policy,value)}</b><small>${pct(c.supports[policy+':'+value]??0,c.eligible)} support</small></button>`}).join('')}</div></details>`).join('')}`
}
function activity(c:CompanyView,data:StockView){
  const d=c.symbol==='CAS'?data.cas.lastDividend:data.bank.lastDividend
  return `<h3>Dividends</h3><p>${d?'Last payment '+when(Date.parse(d.day))+' · '+coins(d.paid):'No dividend paid yet.'} You have received ${coins(c.symbol==='CAS'?data.portfolio.dividendsPaid:data.portfolio.bankDividendsPaid??0)}.</p>
    <details open><summary>Recent trades</summary><ul class="world-ledger">${c.trades.map(t=>`<li><span>${safeText(t.sell)} → ${safeText(t.buy)}<small>${when(t.at)}</small></span><b>${fmt(t.shares)} at ${fmt(t.price)}</b></li>`).join('')||'<li>No trades yet</li>'}</ul></details>
    <details><summary>Company ledger</summary><ul class="world-ledger">${c.history.map(h=>`<li><span>${safeText(h.kind)}<small>${when(h.at)}</small></span><b>${h.shares===undefined?coins(h.coins):fmt(h.shares)+' shares'}</b></li>`).join('')}</ul></details>`
}
export function companyContent(symbol:EquitySymbol,data:StockView,tab:DeskTab,side:'buy'|'sell'){
  const c=data.companies[symbol],quote=symbol==='CAS'?data.cas:data.bank
  const status=c.bankruptcy?`<p class="world-equity-status"><strong>Bankruptcy</strong> · Shares can still trade. Recapitalization due ${when(c.bankruptcy.day7)}. ${safeText(c.bankruptcy.outcome??'')}</p>`:
    c.recoveryUntil>data.now?`<p class="world-equity-status"><strong>In recovery</strong> · Policy changes resume ${when(c.recoveryUntil)}.</p>`:''
  const tabs=[['trade','Trade'],['ownership','Ownership'],['votes','Votes'],['activity','Activity']] as const
  return `<div class="world-equity-price"><strong>${coins(quote.price)}</strong><span>Last price · ${fmt(c.votingShares)} shares held</span><button type="button" data-equity-refresh>Refresh</button></div>${status}
    <nav class="world-equity-tabs" aria-label="Company sections">${tabs.map(([key,label])=>`<button data-equity-tab="${key}" type="button" aria-pressed="${tab===key}">${label}</button>`).join('')}</nav>
    <div class="world-equity-body">${tab==='trade'?trading(c,data,side):tab==='ownership'?ownership(c):tab==='votes'?voting(c,data):activity(c,data)}</div>`
}
