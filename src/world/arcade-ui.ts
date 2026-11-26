import {WEAPONS,isWeapon,weaponIds,type Item,type Stack} from './arcade.ts'
import {safeText} from './services.ts'
import type {WorldView} from './model.ts'

const groceries={cash:'Cash',burger:'Burger',fries:'Fries',cola:'Cola'}
const itemName=(item:Item)=>isWeapon(item)?WEAPONS[item].name:groceries[item]
export class ArcadeControls {
  private view?:WorldView
  private selected=0
  get slot(){return this.selected}
  get weapon(){
    const item=this.view?.arcade?.slots[this.selected]?.item
    return isWeapon(item)?item:undefined
  }
  trigger(operation:'fire'|'reload',target?:string){
    if(!this.weapon||!this.view?.arcade||this.view.arcade.custody)return
    void this.send('arcade',{operation,target,slot:this.selected,sequence:this.view.arcade.sequence}).catch(()=>{})
  }
  private key=''
  constructor(private host:HTMLElement,private send:(name:string,data:object)=>Promise<void>,private selectionChanged=()=>{}){
    host.innerHTML='<div class="arcade-meter"></div><div class="arcade-slots" aria-label="Carried inventory"></div><div class="arcade-actions"></div>'
    host.onclick=e=>{
      const b=(e.target as Element).closest<HTMLButtonElement>('button')
      if(!b||!this.view?.arcade)return
      if(b.dataset.slot!==undefined){this.selected=Number(b.dataset.slot);this.key='';this.update(this.view);this.selectionChanged();return}
      const stack=this.view.arcade.slots[this.selected]
      if(b.dataset.op==='eat'&&stack){void send('food',{id:crypto.randomUUID(),operation:'eat',item:stack.item,amount:1}).catch(()=>{});return}
      const target=b.dataset.op==='fire'?host.querySelector<HTMLSelectElement>('select')?.value:b.dataset.target
      void send('arcade',{sequence:this.view.arcade.sequence,operation:b.dataset.op,target,slot:this.selected}).catch(()=>{})
    }
    document.addEventListener('keydown',e=>{
      if(!/^[1-9]$/.test(e.key)||document.querySelector('dialog[open]')||(e.target as Element)?.matches('input,textarea,select')||!this.view)return
      this.selected=Number(e.key)-1;this.key='';this.update(this.view);this.selectionChanged()
    })
  }
  update(view:WorldView){
    const a=view.arcade
    this.view=view;this.host.hidden=!a||!!a.custody
    if(!a||a.custody)return
    this.host.querySelector('.arcade-meter')!.textContent='HP '+a.hp+'/100'+(a.stars?' · '+ '★'.repeat(a.stars)+' · '+Math.ceil(a.remaining/60000)+' min · '+(a.warning??'Patrol searching'):'')
    const dist=(p:{x:number;z:number})=>Math.hypot(view.you.x-p.x,view.you.z-p.z)
    const targets=a.contacts.filter(c=>c.inSight&&c.kind!=='dog'&&c.kind!=='helicopter'&&(c.distance??dist(c))<=(this.weapon?WEAPONS[this.weapon].range:0))
    const drops=a.drops.filter(d=>dist(d)<=1.85)
    const weapon=this.weapon,mag=weapon?a.magazines?.[weapon]:undefined
    const reloading=!!mag&&mag.readyAt>view.now
    const key=JSON.stringify([mag?.rounds,reloading,a.slots,this.selected,targets.map(t=>[t.id,t.hp]),drops.map(d=>d.id)])
    if(key===this.key)return
    this.key=key
    this.host.querySelector('.arcade-slots')!.innerHTML=a.slots.map((s,i)=>`<button data-slot="${i}" aria-pressed="${this.selected===i}" title="Slot ${i+1}"><small>${i+1}</small>${s?itemName(s.item)+' ×'+s.count:'—'}</button>`).join('')
    const priorTarget=this.host.querySelector<HTMLSelectElement>('select')?.value
    const s=a.slots[this.selected],actions=this.host.querySelector('.arcade-actions')!
    actions.innerHTML=(weapon?`<span class="city-ammo">${reloading?'Reloading…':(mag?.rounds??WEAPONS[weapon].magazine)+' / '+WEAPONS[weapon].magazine}</span><select aria-label="Weapon target"><option value="">Open air</option>${targets.map(t=>`<option value="${safeText(t.id)}">${safeText(t.label)} · ${t.hp} HP</option>`).join('')}</select><button data-op="fire" ${reloading?'disabled':''}>Fire</button><button data-op="reload" ${reloading?'disabled':''}>Reload</button>`:s&&s.item!=='cash'?'<button data-op="eat">Eat one</button>':'')+
      drops.map(d=>`<button data-op="pickup" data-target="${safeText(d.id)}">Pick up items</button>`).join('')
    const select=actions.querySelector('select')
    if(select&&priorTarget&&targets.some(t=>t.id===priorTarget))select.value=priorTarget
  }
}

export function counterUI(dialog:HTMLDialogElement,view:WorldView,send:(data:object)=>Promise<void>){
  const a=view.arcade!,service=view.interaction!,body=dialog.querySelector('.world-dialog-body')!
  const transfer=(stacks:Stack[],op:string,label:string)=>stacks.map(s=>`<button data-op="${op}" data-item="${s.item}">${label} ${itemName(s.item)} (×${s.count})</button>`).join(' ')
  const carried=a.slots.filter((s):s is Stack=>!!s),amount='<label>Quantity <input aria-label="Quantity" type="number" min="1" step="1" value="1"></label>'
  let title='',content=''
  if(service==='cash'){
    title='Cash counter';content=`<p>Banked ${view.coins.toLocaleString()} · Carried cash ${carried.find(s=>s.item==='cash')?.count??0}</p>`+amount+
      '<button data-op="withdraw">Withdraw</button><button data-op="deposit">Deposit</button>'+
      (a.recovery?.length?'<h3>Recovered belongings</h3>'+transfer(a.recovery,'recover','Collect'):'')
  }else if(service==='counter'){
    title='Pulse & Pixel';content='<p>Pay with carried cash. Select a hotbar slot to equip. Firing alerts Meridian Police.</p><div class="city-armory">'+weaponIds.map(id=>{
      const w=WEAPONS[id]
      return `<article><h3>${w.name}</h3><small>${w.damage} damage · ${w.magazine} rounds</small><button data-op="buy" data-item="${id}" aria-label="Buy ${w.name} for ${w.price} cash">Buy · ${w.price} cash</button></article>`
    }).join('')+'</div>'
  }else if(service.startsWith('drawer:')){
    title='Storage drawer';content=amount+'<h3>Carried</h3>'+transfer(carried.filter(s=>s.item==='cash'||isWeapon(s.item)),'store','Put away')+'<h3>In drawer</h3>'+(transfer(a.drawer??[],'take','Take')||'Empty')
  }else{
    title=service==='desk'?'Meridian Police front desk':'Booking register'
    content=service==='desk'?'<p>The booking desk is across the lobby. Take the central stairs to levels 1–5. West Wing holds cells 01–25, East Wing 26–50.</p>':
      '<p>'+((a.register??[]).map(safeText).join(' · ')||'All cells are available.')+'</p>'
  }
  body.innerHTML=`<header class="world-service-head"><h2 id="world-dialog-title">${title}</h2><form method="dialog"><button aria-label="Close">×</button></form></header><section class="arcade-counter">${content}</section><p class="counter-feedback" role="status"></p>`
  if(!dialog.open)dialog.showModal()
  for(const b of body.querySelectorAll<HTMLButtonElement>('button[data-op]'))b.onclick=async()=>{
    b.disabled=true
    try{await send({operation:b.dataset.op,item:b.dataset.item,amount:Number(body.querySelector('input')?.value??1),sequence:a.sequence})}
    catch(e){body.querySelector('.counter-feedback')!.textContent=e instanceof Error?e.message:'Transfer failed';b.disabled=false}
  }
}
