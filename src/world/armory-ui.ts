import {armoryQuote,WEAPONS,weaponIds,type ArmoryPayment,type WeaponId} from './arcade.ts'
import type {WorldView} from './model.ts'

const money=(amount:number)=>amount.toLocaleString(undefined,{maximumFractionDigits:0})
const photo=(id:WeaponId)=>'/chess/overrun/catalog-'+WEAPONS[id].model+'.webp'

export function openArmory(dialog:HTMLDialogElement,initial:WorldView,buy:(id:WeaponId,payment:ArmoryPayment,sequence:number)=>Promise<void>){
  const body=dialog.querySelector<HTMLElement>('.world-dialog-body')!
  body.innerHTML=`<div class="armory-shop">
    <header class="armory-head"><div><small>ARCADE ARMORY</small><h2 id="world-dialog-title">Pulse &amp; Pixel</h2></div><form method="dialog"><button aria-label="Close">×</button></form></header>
    <section class="armory-counter">
      <nav class="armory-rack" aria-label="Weapon rack">${weaponIds.map(id=>`<button type="button" data-weapon="${id}" aria-label="Select ${WEAPONS[id].name}"><img src="${photo(id)}" alt=""><span>${WEAPONS[id].name}<small>${WEAPONS[id].price} coins</small></span></button>`).join('')}</nav>
      <div class="armory-detail">
        <div class="armory-product"><h3></h3><img class="armory-photo" alt=""></div>
        <dl><div><dt>Damage</dt><dd data-damage></dd></div><div><dt>Magazine</dt><dd data-magazine></dd></div><div><dt>In hotbar</dt><dd data-owned></dd></div></dl>
        <fieldset><legend>Pay with</legend><label><input type="radio" name="armory-payment" value="cash"><span>Carried cash<strong data-cash></strong></span></label><label><input type="radio" name="armory-payment" value="bank"><span>Banked coins<strong data-bank></strong></span></label></fieldset>
        <p data-space></p><button type="button" class="armory-buy"></button>
      </div>
    </section><footer><strong>Mara <span>· Sales</span></strong><p role="status" aria-live="polite"></p></footer>
  </div>`
  const shop=body.querySelector<HTMLElement>('.armory-shop')!
  const field=(selector:string)=>shop.querySelector<HTMLElement>(selector)!
  const submit=shop.querySelector<HTMLButtonElement>('.armory-buy')!
  const status=field('[role=status]'),img=shop.querySelector<HTMLImageElement>('.armory-photo')!
  const choices=Array.from(shop.querySelectorAll<HTMLInputElement>('[name=armory-payment]'))
  const rack=Array.from(shop.querySelectorAll<HTMLButtonElement>('[data-weapon]'))
  let view=initial,id:WeaponId='blaster',pending=false,last=''
  let payment:ArmoryPayment=armoryQuote(view.arcade!.slots,view.coins,id,'cash').shortfall&&view.coins>=WEAPONS[id].price?'bank':'cash'

  function refresh(next:WorldView){
    if(!shop.isConnected||next.interaction!=='counter'||!next.arcade)return
    view=next
    const {slots,sequence}=next.arcade
    const key=JSON.stringify([sequence,slots,next.coins,id,payment,pending])
    if(key===last)return
    last=key
    const model=WEAPONS[id],quote=armoryQuote(slots,next.coins,id,payment)
    for(const b of rack){b.setAttribute('aria-pressed',String(b.dataset.weapon===id));b.disabled=pending}
    for(const r of choices){r.checked=r.value===payment;r.disabled=pending}
    field('h3').textContent=model.name
    if(img.getAttribute('src')!==photo(id))img.src=photo(id)
    field('[data-damage]').textContent=String(model.damage)
    field('[data-magazine]').textContent=String(model.magazine)
    field('[data-owned]').textContent=String(slots.filter(s=>s?.item===id).length)
    field('[data-cash]').textContent=money(quote.cash)
    field('[data-bank]').textContent=money(next.coins)
    const currency=payment==='cash'?'cash':'banked coins'
    field('[data-space]').textContent=quote.shortfall?`Short ${money(quote.shortfall)} ${currency}. Choose another payment method or return with more funds.`:quote.slot<0?'Your hotbar is full. Store an item to free a slot.':`Goes into hotbar slot ${quote.slot+1}.`
    submit.textContent=pending?'Buying…':`Buy ${model.name} · ${model.price}`
    submit.setAttribute('aria-label',`Buy ${model.name} for ${model.price} ${currency}`)
    submit.disabled=pending||quote.shortfall>0||quote.slot<0
  }
  for(const b of rack)b.onclick=()=>{id=b.dataset.weapon as WeaponId;status.textContent='';refresh(view)}
  for(const r of choices)r.onchange=()=>{payment=r.value as ArmoryPayment;status.textContent='';refresh(view)}
  submit.onclick=async()=>{
    if(pending||submit.disabled||!view.arcade)return
    const slot=armoryQuote(view.arcade.slots,view.coins,id,payment).slot
    pending=true;status.textContent='';refresh(view)
    try{
      await buy(id,payment,view.arcade.sequence)
      status.textContent=`${WEAPONS[id].name} added to hotbar slot ${slot+1}. Paid ${WEAPONS[id].price} ${payment==='cash'?'cash':'banked coins'}.`
    }catch(e){status.textContent=e instanceof Error?e.message:'Purchase unavailable.'}
    finally{pending=false;refresh(view)}
  }
  refresh(initial)
  if(!dialog.open)dialog.showModal()
  return refresh
}
