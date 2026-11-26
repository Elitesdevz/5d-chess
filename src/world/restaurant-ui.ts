import {foodSymbol} from './restaurant-ui-icons.ts'
import {KFC_ROLES,MENU,RESTAURANT_NAME,SEATS,STAFF,WORK,blankOrder,handNames,orderItems,orderPrice,orderSize,orderText,sameItems,
  type KfcRole,type KitchenJob,type MenuItem,type OrderItems,type RestaurantView} from './restaurant-model.ts'
import type {WorldView} from './model.ts'
import {coins,safeText} from './services.ts'

const workNames:Record<KfcRole,string>={cook:'Cook',cashier:'Cashier',janitor:'Janitor'}
const jobCopy:Record<KfcRole,string>={
  cook:'Collect tickets in the kitchen. Bring buns and patties to your grill, bag fries, and fill sodas.',
  cashier:'Listen to each customer, fill a ticket, and take finished trays to their tables.',
  janitor:'Mop spills and clean tables after guests leave.',
}
const labelTable=(n:number)=>'Table '+(SEATS[n].table+1)
function button(command:string,label:string,extra='',classes=''){
  return `<button type="button" class="${classes}" data-kfc-action="${command}" ${extra}>${label}</button>`
}
function kitchenObjective(job:KitchenJob|undefined){
  if(!job)return 'Take a ticket from the kitchen box behind the tills.'
  if(job.hand){
    if(job.hand==='tray')return 'Leave the tray at Order Pickup.'
    if(job.hand==='bag')return 'Take the bag to the fryer.'
    if(job.hand==='cup')return 'Take the cup to the soda fountain.'
    return 'Bring the '+handNames[job.hand].toLowerCase()+' to your station.'
  }
  if(job.patty==='raw')return 'Flip the patty on your grill.'
  if(job.patty==='flipped')return 'Put the cooked patty on the bun.'
  if(sameItems(job.done,job.ticket.items))return 'Lift the finished tray from your station.'
  const needs=MENU.filter(({id})=>job.done[id]<job.ticket.items[id]).map(({id})=>id==='burger'?(job.bun?'raw patty':'bun'):id==='fries'?'fries bag':'cup')
  return 'Pick up a '+needs.join(', or a ')+'.'
}
export class RestaurantUI{
  private current?:WorldView
  private point=''
  private markup=''
  private pending=false
  private dragging=false
  private notice=''
  private pay=''
  private payUntil=0
  private host:HTMLElement
  private order=blankOrder()
  private draftTicket=''
  private bought?:{id:string;items:OrderItems;lane:number;takeaway:boolean}
  private takeaway=false
  constructor(private dialog:HTMLDialogElement,private hud:HTMLElement,private send:(command:string,data:object)=>Promise<void>){
    this.host=dialog.querySelector('.world-dialog-body')!
    dialog.addEventListener('close',()=>{
      if(!this.point)return
      this.point='';this.markup='';this.notice='';this.dragging=false
      if(!this.dialog.open)delete this.dialog.dataset.restaurant
    })
  }
  open(point:string){
    if(!this.current?.restaurant)return
    if(point!==this.point){this.order=blankOrder();this.draftTicket='';this.takeaway=false}
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
      const station=view.interaction?.startsWith('kfc:kitchen:')?view.interaction:undefined
      const instruction=station?.endsWith(':fryer')?'Dip the scoop down, then lift it right into the bag.':
        station?.endsWith(':soda')?'Raise the cup to the tap and hold it there.':
        station?r.kitchen?.patty==='flipped'?'Slide under the cooked patty, then lift it right onto the bun.':'Slide the spatula down under the patty, then flick it up.':undefined
      const task=instruction??(r.tray?r.tray.seat===undefined?'Hand the tray to '+safeText(r.tray.name):'Serve '+labelTable(r.tray.seat):
        r.work?WORK[r.work.kind].name:
        shift?shift.role==='cook'?kitchenObjective(r.kitchen):shift.role==='cashier'?'Take orders at your till and watch the pickup shelf.':'Look for spills and used trays.':
          r.meal?.takeaway?(r.meal.status==='served'?'Collect your takeaway at queue '+(r.meal.lane+1)+'.':'The kitchen is preparing your takeaway.'):
          view.you.dining!==undefined?(r.meal?.status==='paid'?'Waiting for your order.':'You’re seated.'):'Find a seat by the window.')
      if(r.pay&&r.pay.id!==this.pay){this.pay=r.pay.id;this.payUntil=view.now+3300}
      const pay=r.pay&&view.now<this.payUntil?`<small class="kfc-earned">+${coins(r.pay.coins)}</small>`:''
      const job=r.kitchen,check=job?`<small>${orderText(job.ticket.items)} · ${orderSize(job.done)}/${orderSize(job.ticket.items)} on tray</small>`:''
      const held=job?.hand?`<small>Holding ${handNames[job.hand]}</small>`:''
      const hud=`<strong>${title}</strong>${check}<span>${task}</span>${held}${pay}`
      if(this.hud.dataset.content!==hud){this.hud.dataset.content=hud;this.hud.innerHTML=hud}
    }
    if(inside&&r&&this.point&&this.dialog.open&&!this.pending&&!this.dragging)this.render()
  }
  private choices(prices=false){
    const total=orderSize(this.order)
    return `<div class="kfc-menu">${MENU.map(i=>`<article><div class="kfc-food-icon">${foodSymbol(i.id)}</div><div><h3>${i.name}</h3><p>${prices?coins(i.price):''}</p></div>
      <div class="kfc-quantity">${button('quantity','−',`data-item="${i.id}" data-delta="-1" aria-label="Remove ${i.name}" ${this.order[i.id]?'':'disabled'}`)}
      <output aria-label="${i.name} quantity">${this.order[i.id]}</output>
      ${button('quantity','+',`data-item="${i.id}" data-delta="1" aria-label="Add ${i.name}" ${this.order[i.id]<4&&total<6?'':'disabled'}`)}</div>
    </article>`).join('')}</div>`
  }
  private menu(r:RestaurantView,lane:number){
    if(r.meal){
      if(r.meal.takeaway)return `<h3>${orderText(orderItems(r.meal))}</h3><p>${r.meal.status==='served'?'Collect your order at queue '+(r.meal.lane+1)+'.':'The kitchen is preparing your takeaway.'}</p>`
      const served=r.meal.status==='served'
      return `<h3>${orderText(orderItems(r.meal))}</h3><p>${served?'Your meal is ready. Have a seat at any free table.':'Your order is in. You can take a seat while the kitchen prepares it.'}</p>`
    }
    const total=orderPrice(this.order)
    return this.choices(true)+`<div class="world-button-row"><button type="button" data-kfc-action="dine-in" aria-pressed="${!this.takeaway}">Dine in</button><button type="button" data-kfc-action="takeaway" aria-pressed="${this.takeaway}">Takeaway</button></div><div class="kfc-bill"><strong>${coins(total)}</strong>${button('buy','Place order',`data-lane="${lane}" ${!total||(this.current?.coins??0)<total?'disabled':''}`,'kfc-primary')}</div>`
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
  private cleaning(r:RestaurantView){
    const job=r.work
    if(!job){
      const mess=r.messes.find(m=>'kfc:clean:'+m.id===this.point)
      return mess?`<p>This ${mess.kind==='mop'?'spill':'table'} needs attention.</p>${button('start',WORK[mess.kind].name,'','kfc-primary')}`:'<p>The area is clean.</p>'
    }
    const options=WORK[job.kind],wait=job.readyAt>this.current!.now
    return `<div class="kfc-work"><div class="kfc-work-lens" data-step="${job.step}" aria-hidden="true">${foodSymbol(job.kind)}</div>
      <ol>${options.steps.map((step,i)=>`<li class="${i<job.step?'done':i===job.step?'current':''}">${step}</li>`).join('')}</ol></div>
      ${button('step',options.steps[job.step],`data-key="${job.key}" data-step="${job.step}" ${wait?'disabled':''}`,'kfc-primary')}`
  }
  private cashier(r:RestaurantView){
    if(this.point==='kfc:deliver'){
      const t=r.tray
      return t?`<h3>${orderText(t.items)}</h3><p>${safeText(t.name)}${t.seat===undefined?' at the counter':' · '+labelTable(t.seat)}</p>${button('deliver','Serve order','','kfc-primary')}`:'<p>Go to the pickup shelf for another order.</p>'
    }
    if(this.point==='kfc:pass'){
      return r.tray?`<p>Deliver the tray to ${r.tray.seat===undefined?safeText(r.tray.name):labelTable(r.tray.seat)}.</p>`
        :r.pickup.length?`<div class="kfc-pickup">${r.pickup.slice(0,8).map(t=>`<article><div><h3>${orderText(t.items)}</h3><p>${safeText(t.name)} · ${t.seat===undefined?'Counter':labelTable(t.seat)}</p></div>${button('pickup','Pick up tray',`data-ticket="${safeText(t.id)}"`)}</article>`).join('')}</div>`
        :'<p>No trays are ready. The kitchen is still working.</p>'
    }
    const ticket=r.queues[r.shift?.slot??0]?.[0]
    if(!ticket)return '<p>Your queue is clear. New guests will join shortly.</p>'
    if(this.draftTicket!==ticket.id){this.draftTicket=ticket.id;this.order=blankOrder()}
    return `<blockquote class="kfc-quote"><strong>${safeText(ticket.name)}</strong><p>“Could I get ${orderText(ticket.items,true)}, please?”</p></blockquote>
      ${this.choices()}
      <div class="kfc-ticket-workspace"><button type="button" class="kfc-paper" data-drag="ticket" data-ticket="${safeText(ticket.id)}"
        aria-label="Send filled ticket to kitchen box" ${orderSize(this.order)?'':'disabled'}>
        <small>KFC · ORDER TICKET</small><strong>${orderText(this.order)||'Add items to the ticket'}</strong>
      </button><div class="kfc-ticket-box" data-drop="ticket"><span aria-hidden="true"></span>Kitchen ticket box</div></div>
      <p>Drag the filled ticket into the box.</p>`
  }
  private dining(r:RestaurantView){
    const meal=r.meal,ready=meal?.status==='served'&&!meal.takeaway
    const status=ready?'Your tray has arrived. Collect it, then choose an item from your inventory.':
      meal?'The kitchen is preparing your order.':'Order at any register when you’re ready.'
    return `<h3>${meal?orderText(orderItems(meal)):'Your table'}</h3><p>${status}</p>
      <div class="kfc-choice">${ready?button('collect','Collect tray','','kfc-primary'):''}${button('stand','Stand up')}</div>`
  }
  private drag(control:HTMLButtonElement){
    const kind=control.dataset.drag!
    const finish=()=>kind==='ticket'?this.run('take',{ticket:control.dataset.ticket,items:{...this.order}}):
      this.run('kitchen',{gesture:kind})
    // Keyboard activation keeps the station workable alongside pointer and touch controls.
    control.onclick=event=>{if(event.detail===0&&!this.dragging)void finish()}
    control.onpointerdown=event=>{
      if(event.button!==0||this.pending)return
      const target=this.host.querySelector(`[data-drop="${kind}"]`)?.getBoundingClientRect()
      if(!target)return
      const start={x:event.clientX,y:event.clientY}
      this.dragging=true;control.setPointerCapture(event.pointerId)
      control.classList.add('kfc-dragging')
      control.onpointermove=e=>{
        if(!this.dragging)return
        control.style.transform=`translate(${e.clientX-start.x}px,${e.clientY-start.y}px)`
      }
      const reset=()=>{
        this.dragging=false;control.classList.remove('kfc-dragging');control.style.transform=''
        control.onpointermove=null;control.onpointerup=null;control.onpointercancel=null;control.onlostpointercapture=null
      }
      control.onpointerup=e=>{
        const dropped=e.clientX>=target.left&&e.clientX<=target.right&&e.clientY>=target.top&&e.clientY<=target.bottom
        const flipped=kind==='flip'&&e.clientY<start.y-36&&Math.abs(e.clientX-start.x)<100
        reset()
        if(dropped||flipped)void finish()
        else this.render()
      }
      control.onpointercancel=reset;control.onlostpointercapture=reset
    }
  }
  private render(){
    const r=this.current?.restaurant
    if(!r||!this.point||this.dragging)return
    const desk=this.point.split(':')[1]
    const title=desk==='collect'?'Collect takeaway':desk==='menu'?'Order at queue '+(Number(this.point.split(':')[2])+1):desk==='manager'?'Speak to the manager':
      desk==='dining'?labelTable(this.current!.you.dining??0):desk==='kitchen'?this.point.endsWith(':fryer')?'Fryer':this.point.endsWith(':soda')?'Soda fountain':'Your cooking station':desk==='clean'?'Cleaning crew':
      desk==='till'?'Take an order':desk==='deliver'?'Serve the table':'Pickup shelf'
    const body=desk==='collect'?r.meal?.takeaway?`<p>${orderText(orderItems(r.meal))}</p>${button('collect','Collect order','','kfc-primary')}`:'<p>Order collected.</p>':desk==='menu'?this.menu(r,Number(this.point.split(':')[2])):desk==='manager'?this.manager(r):
      desk==='dining'?this.dining(r):desk==='clean'?this.cleaning(r):this.cashier(r)
    const markup=`<header class="kfc-header"><div class="kfc-badge">KFC</div><div><span>${RESTAURANT_NAME}</span><h2 id="world-dialog-title">${title}</h2></div><form method="dialog"><button type="submit" aria-label="Close">×</button></form></header>
      <section class="kfc-content">${body}</section><p class="kfc-notice" role="status" ${this.notice?'':'hidden'}>${safeText(this.notice)}</p>`
    if(this.markup===markup)return
    this.markup=markup;this.host.innerHTML=markup
    this.host.querySelectorAll<HTMLButtonElement>('[data-drag]').forEach(control=>this.drag(control))
    this.host.onclick=event=>{
      const control=(event.target as Element).closest<HTMLButtonElement>('button[data-kfc-action]')
      if(!control||this.pending)return
      const command=control.dataset.kfcAction!
      const {item,ticket,key,role,lane,step,delta}=control.dataset
      if(command==='quantity'){
        this.order[item as MenuItem]+=Number(delta);this.notice='';this.render()
        this.host.querySelector<HTMLButtonElement>(`[data-item="${item}"][data-delta="${delta}"]:enabled`)?.focus()
        return
      }
      if(command==='takeaway'||command==='dine-in'){this.takeaway=command==='takeaway';this.render();return}
      if(command==='collect'&&r.meal){void this.run('collect',{id:r.meal.id});return}
      if(command==='buy'){
        const i=Number(lane)
        if(!this.bought||this.bought.lane!==i||this.bought.takeaway!==this.takeaway||!sameItems(this.bought.items,this.order))
          this.bought={id:crypto.randomUUID(),items:{...this.order},lane:i,takeaway:this.takeaway}
        void this.run(command,this.bought)
      }else void this.run(command,{ticket,key,role,step:step===undefined?undefined:Number(step)})
    }
  }
  private async run(command:string,data:object){
    if(this.pending)return
    this.pending=true;this.notice=''
    const controls=[...this.host.querySelectorAll<HTMLButtonElement>('button:not([aria-label=Close]):enabled')]
    controls.forEach(control=>control.disabled=true)
    try{
      await this.send(command,{...data,point:this.point})
      if(command==='buy')this.bought=undefined
      if(command==='collect'||command==='stand'||command==='pickup'||command==='hire'||command==='deliver'||command==='kitchen'&&'gesture' in data&&data.gesture!=='flip')this.dialog.close()
      this.notice=command==='take'?'Ticket sent to the kitchen.':command==='step'&&!this.current?.restaurant?.work?'Task complete. Payment sent.':''
    }catch(error){this.notice=error instanceof Error?error.message:'Please try again.'}
    finally{
      this.pending=false;controls.forEach(control=>control.disabled=false)
      if(this.dialog.open&&this.point)this.render()
    }
  }
}
