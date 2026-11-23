import {foodSymbol} from './restaurant-ui-icons.ts'
import {KFC_ROLES,MENU,RESTAURANT_NAME,SEATS,STAFF,WORK,menuItem,type KfcRole,type RestaurantView,type TicketView} from './restaurant-model.ts'
import type {WorldView} from './model.ts'
import {coins,safeText} from './services.ts'

const workNames:Record<KfcRole,string>={cook:'Cook',cashier:'Cashier',janitor:'Janitor'}
const jobCopy:Record<KfcRole,string>={
  cook:'Flip burgers, bag fries and pack orders at your station.',
  cashier:'Take orders at your till, then collect trays and serve customers.',
  janitor:'Mop spills and clean tables after guests leave.',
}
const orderName=(o:TicketView)=>menuItem(o.item)!.name
const labelTable=(n:number)=>'Table '+(SEATS[n].table+1)
function button(command:string,label:string,extra='',classes=''){
  return `<button type="button" class="${classes}" data-kfc-action="${command}" ${extra}>${label}</button>`
}
export class RestaurantUI{
  private current?:WorldView
  private point=''
  private markup=''
  private pending=false
  private notice=''
  private pay=''
  private payUntil=0
  private host:HTMLElement
  private bought?:{id:string;item:string;lane:number}
  constructor(private dialog:HTMLDialogElement,private hud:HTMLElement,private send:(command:string,data:object)=>Promise<void>){
    this.host=dialog.querySelector('.world-dialog-body')!
    dialog.addEventListener('close',()=>{
      if(!this.point)return
      this.point='';this.markup='';this.notice=''
      if(!this.dialog.open)delete this.dialog.dataset.restaurant
    })
  }
  open(point:string){
    if(!this.current?.restaurant)return
    this.point=point;this.markup='';this.notice=''
    this.dialog.dataset.restaurant='true'
    this.render()
    if(!this.dialog.open)this.dialog.showModal()
  }
  update(view:WorldView){
    this.current=view
    const inside=view.you.zone==='kfc',r=view.restaurant
    this.hud.hidden=!inside||!r||(!r.shift&&!r.meal&&view.you.dining===undefined)
    if(!this.hud.hidden&&r){
      const shift=r.shift
      const title=shift?`${workNames[shift.role]} · ${shift.role==='janitor'?'Cleaning crew':'Station '+(shift.slot+1)}`:'Your meal'
      const task=r.tray?r.tray.seat===undefined?'Hand the tray to '+safeText(r.tray.name):'Serve '+labelTable(r.tray.seat):
        r.work?WORK[r.work.kind].name:
        shift?shift.role==='cook'?'Head to your kitchen station.':shift.role==='cashier'?'Take orders at your till and watch the pickup shelf.':'Look for spills and used trays.':'Find a seat by the window.'
      if(r.pay&&r.pay.id!==this.pay){this.pay=r.pay.id;this.payUntil=view.now+3300}
      const pay=r.pay&&view.now<this.payUntil?`<small class="kfc-earned">+${coins(r.pay.coins)}</small>`:''
      const hud=`<strong>${title}</strong><span>${task}</span>${pay}`
      if(this.hud.dataset.content!==hud){this.hud.dataset.content=hud;this.hud.innerHTML=hud}
    }
    if(inside&&r&&this.point&&this.dialog.open&&!this.pending)this.render()
  }
  private menu(r:RestaurantView,lane:number){
    if(r.meal){
      const served=r.meal.status==='served'
      return `<h3>${menuItem(r.meal.item)!.name}</h3><p>${served?'Your meal is ready. Have a seat at any free table.':'Your order is in. You can take a seat while the kitchen prepares it.'}</p>`
    }
    return `<div class="kfc-menu">${MENU.map(i=>`<article><div class="kfc-food-icon">${foodSymbol(i.id)}</div><div><h3>${i.name}</h3><p>${i.description}</p></div>${
      button('buy',coins(i.price),`data-item="${i.id}" data-lane="${lane}" ${(this.current?.coins??0)<i.price?'disabled':''}`,'kfc-meal-buy')
    }</article>`).join('')}</div>`
  }
  private manager(r:RestaurantView){
    return `<div class="kfc-manager-intro">Take over an open station from the crew. You earn coins for each order or cleanup you complete.</div>
      <div class="kfc-jobs">${KFC_ROLES.map(role=>{
        const filled=r.staff[role].filter(s=>s.player).length,selected=r.shift?.role===role
        return `<article><span>${STAFF[role]-filled} available</span><h3>${workNames[role]}</h3><p>${jobCopy[role]}</p>
          ${button('hire',selected?'Your current shift':'Take '+role+' shift',`data-role="${role}" ${filled===STAFF[role]||selected?'disabled':''}`)}
        </article>`
      }).join('')}</div>${r.shift?button('quit','Clock out','','kfc-quiet'):''}`
  }
  private work(r:RestaurantView){
    const job=r.work
    if(!job){
      const cleaning=this.point.startsWith('kfc:clean:')
      const mess=cleaning?r.messes.find(m=>'kfc:clean:'+m.id===this.point):undefined
      if(cleaning&&!mess)return '<p>The area is clean.</p>'
      return `<p>${mess?'This '+(mess.kind==='mop'?'spill':'table')+' needs attention.':'Take the next kitchen ticket and prepare the requested item.'}</p>${button('start',mess?WORK[mess.kind].name:'Take a kitchen ticket','','kfc-primary')}`
    }
    const options=WORK[job.kind],wait=job.readyAt>this.current!.now
    return `<div class="kfc-work"><div class="kfc-work-lens" data-kind="${job.kind}" data-step="${job.step}" aria-hidden="true">${foodSymbol(job.kind)}</div>
      <ol>${options.steps.map((step,i)=>`<li class="${i<job.step?'done':i===job.step?'current':''}">${step}</li>`).join('')}</ol></div>
      ${button('step',options.steps[job.step],`data-key="${job.key}" data-step="${job.step}" ${wait?'disabled':''}`,'kfc-primary')}`
  }
  private cashier(r:RestaurantView){
    if(this.point==='kfc:deliver'){
      const t=r.tray
      return t?`<h3>${orderName(t)}</h3><p>${safeText(t.name)}${t.seat===undefined?' at the counter':' · '+labelTable(t.seat)}</p>${button('deliver','Serve order','','kfc-primary')}`:'<p>Go to the pickup shelf for another order.</p>'
    }
    if(this.point==='kfc:pass'){
      return r.tray?`<p>Deliver the tray to ${r.tray.seat===undefined?safeText(r.tray.name):labelTable(r.tray.seat)}.</p>`
        :r.pickup.length?`<div class="kfc-pickup">${r.pickup.slice(0,8).map(t=>`<article><div><h3>${orderName(t)}</h3><p>${safeText(t.name)} · ${t.seat===undefined?'Counter':labelTable(t.seat)}</p></div>${button('pickup','Pick up tray',`data-ticket="${safeText(t.id)}"`)}</article>`).join('')}</div>`
        :'<p>No trays are ready. The kitchen is still working.</p>'
    }
    const ticket=r.queues[r.shift?.slot??0]?.[0]
    if(!ticket)return '<p>Your queue is clear. New guests will join shortly.</p>'
    return `<blockquote class="kfc-quote"><strong>${safeText(ticket.name)}</strong><p>“I’ll have the ${orderName(ticket).toLowerCase()}, please.”</p></blockquote>
      <div class="kfc-choice">${MENU.map(i=>button('take',i.name,`data-ticket="${safeText(ticket.id)}" data-item="${i.id}"`)).join('')}</div>`
  }
  private dining(r:RestaurantView){
    const meal=r.meal,ready=meal?.status==='served'
    return `<div class="kfc-dine"><div aria-hidden="true">${foodSymbol(meal?.item??'combo')}</div>
      <div><h3>${meal?menuItem(meal.item)!.name:'Take a seat'}</h3><p>${meal?(ready?'Enjoy your meal.':'The kitchen is preparing your order.'):'Order at any register when you’re ready.'}</p>
        ${ready?`<div class="kfc-bites" aria-label="${3-meal.bites} portions left">${[0,1,2].map(i=>`<i class="${i<meal.bites?'finished':''}"></i>`).join('')}</div>`:''}
      </div></div>
      <div class="kfc-choice">${ready?button('eat',meal.item==='cola'?'Take a sip':'Take a bite',(this.current?.you.eatingUntil??0)>this.current!.now?'disabled':'','kfc-primary'):''}${button('stand','Stand up')}</div>`
  }
  private render(){
    const r=this.current?.restaurant
    if(!r||!this.point)return
    const desk=this.point.split(':')[1]
    const title=desk==='menu'?'Order at queue '+(Number(this.point.split(':')[2])+1):desk==='manager'?'Speak to the manager':
      desk==='dining'?labelTable(this.current!.you.dining??0):desk==='cook'?'Kitchen station':desk==='clean'?'Cleaning crew':
      desk==='till'?'Take an order':desk==='deliver'?'Serve the table':'Pickup shelf'
    const body=desk==='menu'?this.menu(r,Number(this.point.split(':')[2])):desk==='manager'?this.manager(r):
      desk==='dining'?this.dining(r):desk==='cook'||desk==='clean'?this.work(r):this.cashier(r)
    const markup=`<header class="kfc-header"><div class="kfc-badge">KFC</div><div><span>${RESTAURANT_NAME}</span><h2 id="world-dialog-title">${title}</h2></div><form method="dialog"><button type="submit" aria-label="Close">×</button></form></header>
      <section class="kfc-content">${body}</section><p class="kfc-notice" role="status" ${this.notice?'':'hidden'}>${safeText(this.notice)}</p>`
    if(this.markup===markup)return
    this.markup=markup;this.host.innerHTML=markup
    this.host.onclick=event=>{
      const click=(event.target as Element).closest<HTMLButtonElement>('button[data-kfc-action]')
      if(!click)return
      void this.run(click)
    }
  }
  private async run(control:HTMLButtonElement){
    if(this.pending)return
    const command=control.dataset.kfcAction!
    const {item,ticket,key,role,lane,step}=control.dataset
    let id:string|undefined
    if(command==='buy'){
      if(!this.bought||this.bought.lane!==Number(lane)||this.bought.item!==item){
        this.bought={id:crypto.randomUUID(),item:item!,lane:Number(lane)}
      }
      id=this.bought.id
    }
    this.pending=true;control.disabled=true;this.notice=''
    try{
      await this.send(command,{id,item,ticket,key,role,lane:lane===undefined?undefined:Number(lane),step:step===undefined?undefined:Number(step),point:this.point})
      if(command==='buy')this.bought=undefined
      if(command==='stand'||command==='pickup'||command==='hire'||command==='deliver')this.dialog.close()
      this.notice=command==='eat'&&!this.current?.restaurant?.meal?'Meal finished.':command==='take'?'Order sent to the kitchen.':command==='step'&&!this.current?.restaurant?.work?'Task complete. Payment sent.':''
    }catch(error){this.notice=error instanceof Error?error.message:'Please try again.'}
    finally{
      this.pending=false;control.disabled=false
      if(this.dialog.open&&this.point)this.render()
    }
  }
}
