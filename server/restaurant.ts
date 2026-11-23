import {randomUUID} from 'node:crypto'
import {income} from './credit.ts'
import {wallet} from './economy.ts'
import {fail} from './http.ts'
import type {ChessStore,UnitOfWork} from './storage.ts'
import {toStockUnits,fromStockUnits} from '../src/stock-model.ts'
import {COUNTERS,GRILLS,KFC_ROLES,MANAGER,MENU,PASS,RESTAURANT,SEATS,STAFF,TABLES,WORK,menuItem,restaurantPoints,type KfcActor,type KfcMeal,type KfcMess,type KfcRole,type KfcShift,type KfcWork,type Meal,type RestaurantView,type TicketView,type WorkKind} from '../src/world/restaurant-model.ts'
import type {WorldPlayer} from '../src/world/model.ts'

type Ticket=TicketView&{player?:string;created:number;changed:number;seatingSince?:number;work:WorkKind[];cook?:string;carrier?:string}
type Mess=KfcMess&{created:number;claim?:string}
type Task=KfcWork&{ticket?:string;mess?:string;started:number}
const NPC={
  cashier:['Nia','Louis','Aya'],cook:['Mika','Eddie','Joy','Mae','Remy'],janitor:['Robin','Sam','Kit'],
}
const CUSTOMERS=['Imani','Olive','Frankie','Alex','Pia','Drew','Billie','Sasha','Hugo','Rosa','Milo','Jules']
const OPENING={x:0,z:6.45}
const CHECK_SECONDS=36_000
const NPC_SIT=24_000
const STEP_DELAY=650
const ACTOR_PAY={cashier:2,deliver:4}
const availableSeats=()=>SEATS.map((_,i)=>i)
type Point={x:number;z:number}
function along(points:Point[],distance:number){
  for(let i=1;i<points.length;i++){
    const p=points[i-1],q=points[i],length=Math.hypot(q.x-p.x,q.z-p.z)
    if(distance<=length){
      const t=length?distance/length:1
      return {x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t,yaw:Math.atan2(p.x-q.x,p.z-q.z)}
    }
    distance-=length
  }
  const p=points.at(-2)!,q=points.at(-1)!
  return {...q,yaw:Math.atan2(p.x-q.x,p.z-q.z)}
}
function tableRoute(seat:number):Point[]{
  const p=SEATS[seat]
  return [{x:0,z:p.z},{x:p.x,z:p.z}]
}
export class Restaurant {
  private staff=new Map<string,KfcShift>()
  private seats=new Map<string,number>()
  private tickets:Ticket[]=[]
  private messes:Mess[]=[]
  private jobs=new Map<string,Task>()
  private pay=new Map<string,{coins:number;id:string}>()
  private departures:{id:string;name:string;seat:number;at:number}[]=[]
  private nextGuest=0
  private guest=0
  private store:ChessStore
  constructor(store:ChessStore){this.store=store}

  private log(name:string,command:string,coins?:number,value?:number){
    this.store.transaction(u=>u.economyUsage(name,'/api/world/restaurant',{action:'restaurant_action',service:command,coins,value}))
  }
  private credit(u:UnitOfWork,player:string,coins:number,service:string,now:number){
    const account=u.users.get(player)??fail(401,'Log in first')
    wallet(account)
    const credited=income(account,toStockUnits(coins),now)
    u.economyUsage(player,'/api/world/restaurant',{action:'restaurant_action',service,coins},now)
    return fromStockUnits(credited)
  }
  private notePay(player:string,coins:number){this.pay.set(player,{coins,id:randomUUID()})}
  private wage(player:string,coins:number,service:string,now:number){
    this.notePay(player,this.store.transaction(u=>this.credit(u,player,coins,service,now)))
  }
  hasTray(name:string){return this.tickets.some(t=>t.carrier===name)}
  workerRole(name:string){return this.staff.get(name)?.role}
  jobKind(name:string){return this.jobs.get(name)?.kind}
  private taskRelease(name:string){
    const task=this.jobs.get(name)
    if(task?.ticket){
      const ticket=this.tickets.find(t=>t.id===task.ticket)
      if(ticket?.cook===name)delete ticket.cook
    }
    if(task?.mess){
      const mess=this.messes.find(m=>m.id===task.mess)
      if(mess?.claim===name)delete mess.claim
    }
    this.jobs.delete(name)
  }
  private endShift(name:string){
    this.staff.delete(name);this.taskRelease(name)
    for(const t of this.tickets){
      if(t.carrier!==name)continue
      t.phase='ready';delete t.carrier
    }
  }
  leave(name:string){
    this.seats.delete(name);this.endShift(name);this.pay.delete(name)
    // Paid meals live with the account and are restored at the counter on return.
    this.tickets=this.tickets.filter(t=>t.player!==name)
  }
  private tableFor(ticket:Ticket){
    return ticket.player?this.seats.get(ticket.player):ticket.seat
  }
  private shiftAt(role:KfcRole,slot:number){
    return [...this.staff].find(([,shift])=>shift.role===role&&shift.slot===slot)?.[0]
  }
  private taken(){return [...new Set([...this.seats.values(),...this.tickets.flatMap(t=>t.player||t.seat===undefined?[]:[t.seat])])]}
  private queue(lane:number){return this.tickets.filter(t=>t.lane===lane&&t.phase==='queue')}
  private transition(t:Ticket,phase:Ticket['phase'],now:number){
    if(t.phase==='queue'&&phase==='kitchen')t.seatingSince=now
    t.phase=phase;t.changed=now
  }
  private restore(name:string,now:number){
    if(this.tickets.some(t=>t.player===name))return
    const saved=this.meal(name)
    if(saved?.status==='paid')this.tickets.push(this.ticket(saved,name,now,true))
  }
  private meal(name:string){
    return this.store.restaurantMeal(name)
  }
  private ticket(meal:KfcMeal,name:string,now:number,human=false):Ticket{
    const item=menuItem(meal.item)!
    return {id:meal.id,item:item.id,lane:meal.lane,name,phase:'queue',player:human?name:undefined,
      created:now,changed:now,work:[...item.work]}
  }
  private serve(ticket:Ticket,now:number,employee?:string){
    if(ticket.player||employee){
      const wage=this.store.transaction(u=>{
        if(ticket.player){
          const account=u.users.get(ticket.player)
          if(account?.restaurant?.id!==ticket.id)fail(409,'That meal was already served')
          account.restaurant.status='served'
          u.economyUsage(account.name,'/api/world/restaurant',{action:'restaurant_action',service:'meal_served',reference:ticket.id},now)
        }
        return employee?this.credit(u,employee,ACTOR_PAY.deliver,'deliver_order',now):undefined
      })
      if(employee&&wage!==undefined)this.notePay(employee,wage)
    }
    if(ticket.player){this.tickets=this.tickets.filter(t=>t!==ticket);return}
    this.transition(ticket,'served',now);delete ticket.carrier
  }
  private mess(kind:Mess['kind'],x:number,z:number,now:number){
    if(this.messes.length>=8||this.messes.some(m=>Math.hypot(m.x-x,m.z-z)<.38))return
    this.messes.push({id:randomUUID(),kind,x,z,created:now})
  }
  tick(now:number){
    const activeCook=[...this.staff.values()].some(s=>s.role==='cook')
    this.departures=this.departures.filter(p=>now-p.at<7000)
    for(const [name,job] of this.jobs)if(now-job.started>CHECK_SECONDS)this.taskRelease(name)
    for(const t of [...this.tickets]){
      const age=now-t.changed
      if(t.phase==='queue'){
        if(this.queue(t.lane)[0]!==t)continue
        if(age>=(this.shiftAt('cashier',t.lane)?26_000:5000))this.transition(t,'kitchen',now)
      }else if(t.phase==='kitchen'){
        if(!t.cook&&age>=(activeCook?26_000:6200)){
          t.work.shift()
          this.transition(t,t.work.length?'kitchen':'ready',now)
        }
      }else if(t.phase==='ready'){
        if(age>=(this.shiftAt('cashier',t.lane)?28_000:8500))this.serve(t,now)
      }else if(t.phase==='carrying'){
        if(age>=CHECK_SECONDS){delete t.carrier;this.transition(t,'ready',now)}
      }else if(!t.player&&age>=NPC_SIT&&t.seat!==undefined){
        const table=TABLES[SEATS[t.seat].table]
        this.mess('wipe',table.x,table.z,now)
        if((Number(t.id.split('-').at(-1))||0)%3===0)this.mess('mop',table.x*.58,table.z+.31,now)
        this.departures.push({id:t.id,name:t.name,seat:t.seat,at:now})
        this.tickets=this.tickets.filter(ticket=>ticket!==t)
      }
    }
    const playerJanitor=[...this.staff.values()].some(s=>s.role==='janitor')
    this.messes=this.messes.filter(m=>m.claim||now-m.created<(playerJanitor?44_000:18_000))
    if(now>=this.nextGuest&&this.tickets.filter(t=>!t.player).length<7){
      const taken=this.taken()
      const free=availableSeats().filter(n=>!taken.includes(n))
      if(free.length){
        const index=this.guest++,item=MENU[(index*3+index%4)%MENU.length],lane=index%3
        const t=this.ticket({id:'guest-'+index,item:item.id,lane,status:'paid',bites:0},CUSTOMERS[index%CUSTOMERS.length],now)
        t.seat=free[(index*5)%free.length]
        this.tickets.push(t)
        if(index%4===1)this.mess('mop',lane-1,3.82+(index%3)*.47,now)
      }
      this.nextGuest=now+8200
    }
  }
  private publicTicket(t:Ticket):TicketView{
    const {id,item,lane,name,phase}=t
    return {id,item,lane,name,phase,seat:this.tableFor(t)}
  }
  view(name:string,now:number,inside:boolean):RestaurantView{
    if(inside)this.restore(name,now)
    const staff=Object.fromEntries(KFC_ROLES.map(role=>[role,NPC[role].map((npc,i)=>{
      const player=this.shiftAt(role,i)
      return {name:player??npc,player:!!player}
    })])) as RestaurantView['staff']
    const tray=this.tickets.find(t=>t.carrier===name)
    const mealsAt=this.tickets.flatMap(t=>!t.player&&t.phase==='served'&&t.seat!==undefined?[{seat:t.seat,item:t.item}]:[])
    for(const [user,seat] of this.seats){
      const meal=this.meal(user)
      if(meal?.status==='served')mealsAt.push({seat,item:meal.item})
    }
    return {staff,queues:COUNTERS.map((_,i)=>this.queue(i).slice(0,6).map(t=>this.publicTicket(t))),
      pickup:this.tickets.filter(t=>t.phase==='ready').map(t=>this.publicTicket(t)),
      messes:this.messes.map(({id,x,z,kind})=>({id,x,z,kind})),actors:this.actors(now),taken:this.taken(),mealsAt,
      meal:inside?this.meal(name):undefined,shift:this.staff.get(name),work:this.jobs.get(name),tray:tray?this.publicTicket(tray):undefined,pay:this.pay.get(name)}
  }

  private actors(now:number):KfcActor[]{
    const actors:KfcActor[]=[{id:'manager',name:'Manager',x:4.78,z:-5.42,yaw:Math.PI,pose:'work',role:'manager'}]
    for(const role of KFC_ROLES)NPC[role].forEach((name,slot)=>{
      if(this.shiftAt(role,slot))return
      const look={id:role+slot,name,role}
      if(role==='cook'){
        actors.push({...look,x:GRILLS[slot],z:-5.78,yaw:0,pose:'work'})
      }else if(role==='cashier'){
        const ticket=this.tickets.find(t=>t.lane===slot&&(t.phase==='ready'||t.phase==='served'&&now-t.changed<2500))
        const counter={x:COUNTERS[slot],z:-2.26},table=ticket&&this.tableFor(ticket)
        const route=table===undefined?[counter,PASS]:[counter,{x:3.48,z:-2.5},{x:3.48,z:-.35},{x:0,z:-.18},...tableRoute(table)]
        const pos=ticket?along(route,ticket.phase==='served'?Math.max(0,9-(now-ticket.changed)*.0036):(now-ticket.changed)*.00215):{...counter,yaw:Math.PI}
        actors.push({...look,...pos,pose:ticket?'tray':'work'})
      }else{
        const m=this.messes.filter(x=>!x.claim)[slot]
        const home={x:slot===0?-3.26:3.2,z:4.9-slot*2.11}
        const target=m&&{x:m.x-(m.kind==='wipe'?Math.sign(m.x)*.83:0),z:m.z}
        const pos=m&&target?along([home,{x:home.x,z:target.z},target],Math.max(0,(now-m.created)/415)):{...home,yaw:Math.PI}
        actors.push({...look,...pos,pose:m?m.kind:'work'})
      }
    })
    for(const ticket of this.tickets){
      if(ticket.player||ticket.seat===undefined)continue
      const seat=SEATS[ticket.seat],line=this.queue(ticket.lane).indexOf(ticket)
      const order={x:COUNTERS[ticket.lane],z:.19+Math.max(0,line)*.57}
      const elapsed=(now-ticket.created)/1000
      const pos=line>=0?along([OPENING,{x:order.x,z:5.45},order],elapsed*2.25)
        :along([order,{x:0,z:.18},...tableRoute(ticket.seat)],Math.max(0,now-(ticket.seatingSince??now))*.0028)
      const seated=line<0&&Math.hypot(seat.x-pos.x,seat.z-pos.z)<.12
      actors.push({id:ticket.id,name:ticket.name,...pos,yaw:seated?seat.yaw:pos.yaw,pose:seated?ticket.phase==='served'?'eat':'sit':'walk'})
    }
    for(const p of this.departures)actors.push({id:p.id,name:p.name,
      ...along([SEATS[p.seat],{x:0,z:SEATS[p.seat].z},OPENING],(now-p.at)*.0021),pose:'walk'})
    return actors
  }

  private closeTo(member:WorldPlayer,id:string,now:number){
    const p=restaurantPoints(this.view(member.name,now,true),member.dining).find(p=>p.id===id)
    return !!p&&Math.hypot(member.x-RESTAURANT.x-p.x,member.z-RESTAURANT.z-p.z)<=(p.range??1.65)+.1
  }
  private requirePoint(member:WorldPlayer,id:string,now:number){
    if(!this.closeTo(member,id,now))fail(409,'Move closer to that station first')
  }
  private buy(member:WorldPlayer,data:Record<string,unknown>,now:number){
    const item=menuItem(data.item),lane=data.lane
    if(!item||typeof lane!=='number'||!Number.isInteger(lane)||lane<0||lane>=COUNTERS.length||typeof data.id!=='string'||!/^[\w-]{12,80}$/.test(data.id))fail(400,'Choose a menu item')
    this.requirePoint(member,'kfc:menu:'+lane,now)
    this.store.transaction(u=>{
      const a=u.users.get(member.name)??fail(401,'Log in first'),purse=wallet(a)
      const receipt=a.restaurantOrders?.find(o=>o.id===data.id)
      if(receipt){
        if(receipt.item!==item.id||receipt.lane!==lane)fail(409,'This receipt belongs to another meal')
        return
      }
      if(a.restaurant?.id===data.id||a.restaurantLast===data.id)return
      if(a.restaurant)fail(409,'Finish the meal you already ordered first')
      const balance=toStockUnits(purse.coins)-toStockUnits(item.price)
      if(balance<0)fail(409,'You need '+item.price+' coins for this order')
      purse.coins=fromStockUnits(balance)
      a.restaurant={id:data.id as string,item:item.id,lane,status:'paid',bites:0}
      a.restaurantOrders=[{id:a.restaurant.id,item:item.id,lane},...(a.restaurantOrders??[])].slice(0,40)
      u.economyUsage(member.name,'/api/world/restaurant',{action:'restaurant_action',service:'meal_ordered',reference:a.restaurant.id,coins:item.price},now)
    })
    this.restore(member.name,now)
  }
  private hire(member:WorldPlayer,role:unknown,now:number){
    this.requirePoint(member,'kfc:manager',now)
    if(!KFC_ROLES.some(r=>r===role))fail(400,'Choose a shift')
    const r=role as KfcRole,existing=this.staff.get(member.name)
    if(existing?.role===r)return
    const slot=Array.from({length:STAFF[r]},(_,i)=>i).find(i=>!this.shiftAt(r,i))
    if(slot===undefined)fail(409,'All '+r+' shifts are taken')
    this.log(member.name,'shift_'+r)
    this.endShift(member.name)
    this.staff.set(member.name,{role:r,slot})
  }
  private start(member:WorldPlayer,point:string,now:number){
    this.requirePoint(member,point,now)
    const name=member.name,shift=this.staff.get(name)
    if(this.jobs.has(name))fail(409,'Finish your current task first')
    if(point==='kfc:cook'&&shift?.role==='cook'){
      const t=this.tickets.find(t=>t.phase==='kitchen'&&!t.cook)
      if(!t)fail(409,'No kitchen tickets yet')
      t.cook=name;this.jobs.set(name,{key:randomUUID(),kind:t.work[0],step:0,readyAt:now,started:now,ticket:t.id})
    }else if(point.startsWith('kfc:clean:')&&shift?.role==='janitor'){
      const m=this.messes.find(m=>'kfc:clean:'+m.id===point)
      if(!m||m.claim)fail(409,'That cleanup is already covered')
      m.claim=name;this.jobs.set(name,{key:randomUUID(),kind:m.kind,step:0,readyAt:now,started:now,mess:m.id})
    }else fail(409,'You are not assigned to this station')
  }
  private step(member:WorldPlayer,data:Record<string,unknown>,now:number){
    const job=this.jobs.get(member.name)
    if(!job||job.key!==data.key||job.step!==data.step||now<job.readyAt)fail(409,'That step is not ready')
    this.requirePoint(member,job.ticket?'kfc:cook':'kfc:clean:'+job.mess,now)
    if(job.step<WORK[job.kind].steps.length-1){job.step++;job.readyAt=now+STEP_DELAY;return}
    const ticket=this.tickets.find(t=>t.id===job.ticket),mess=this.messes.find(m=>m.id===job.mess)
    if(!ticket&&!mess)fail(409,'That task is finished')
    this.wage(member.name,WORK[job.kind].pay,job.kind,now)
    this.taskRelease(member.name)
    if(ticket){ticket.work.shift();this.transition(ticket,ticket.work.length?'kitchen':'ready',now)}
    if(mess)this.messes=this.messes.filter(m=>m!==mess)
  }
  private cashier(member:WorldPlayer,command:string,data:Record<string,unknown>,now:number){
    const name=member.name,shift=this.staff.get(name)
    if(shift?.role!=='cashier')fail(409,'Ask the manager for a cashier shift first')
    if(command==='take'){
      this.requirePoint(member,'kfc:till:'+shift.slot,now)
      const t=this.queue(shift.slot)[0]
      if(!t||t.id!==data.ticket)fail(409,'That customer has moved on')
      if(t.item!==data.item)fail(409,'Choose the item the customer asked for')
      this.wage(name,ACTOR_PAY.cashier,'take_order',now)
      this.transition(t,'kitchen',now)
    }else if(command==='pickup'){
      this.requirePoint(member,'kfc:pass',now)
      if(this.tickets.some(t=>t.carrier===name))fail(409,'Deliver the tray you already have')
      const t=this.tickets.find(t=>t.phase==='ready'&&t.id===data.ticket)
      if(!t)fail(409,'That order is already being served')
      t.carrier=name;this.transition(t,'carrying',now)
    }else{
      this.requirePoint(member,'kfc:deliver',now)
      const t=this.tickets.find(t=>t.carrier===name)
      if(!t)fail(409,'Pick up a tray first')
      this.serve(t,now,name)
    }
  }
  act(member:WorldPlayer,command:unknown,data:Record<string,unknown>,now:number){
    if(member.zone!=='kfc')fail(409,'Visit Krulliversal Fried Chicken first')
    this.restore(member.name,now)
    if(command==='buy')this.buy(member,data,now)
    else if(command==='hire')this.hire(member,data.role,now)
    else if(command==='quit'){this.requirePoint(member,'kfc:manager',now);this.endShift(member.name)}
    else if(command==='start'&&typeof data.point==='string')this.start(member,data.point,now)
    else if(command==='step')this.step(member,data,now)
    else if(command==='take'||command==='pickup'||command==='deliver')this.cashier(member,command,data,now)
    else if(command==='sit'){
      const n=data.seat
      if(typeof n!=='number'||!Number.isInteger(n)||!SEATS[n])fail(400,'Choose a free seat')
      this.requirePoint(member,'kfc:sit:'+n,now)
      if(this.taken().includes(n))fail(409,'That seat is taken')
      this.seats.set(member.name,n);member.dining=n
      const p=SEATS[n]
      Object.assign(member,{x:RESTAURANT.x+p.x,z:RESTAURANT.z+p.z,yaw:p.yaw})
    }else if(command==='stand'){
      this.seats.delete(member.name);delete member.dining;delete member.eatingUntil
    }else if(command==='eat'){
      if(member.dining===undefined)fail(409,'Sit down to enjoy your meal')
      if((member.eatingUntil??0)>now)fail(409,'Finish that bite first')
      this.store.transaction(u=>{
        const a=u.users.get(member.name)??fail(401,'Log in first')
        const meal=a.restaurant
        if(meal?.status!=='served')fail(409,'Your meal is still being prepared')
        meal.bites++
        if(meal.bites>=3){
          delete a.restaurant
          u.economyUsage(member.name,'/api/world/restaurant',{action:'restaurant_action',service:'meal_finished',reference:meal.id},now)
        }
      })
      member.eatingUntil=now+900
    }else fail(400,'Choose a restaurant action')
  }
}
