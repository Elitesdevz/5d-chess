export const RESTAURANT_NAME='Krulliversal Fried Chicken'
export const RESTAURANT={x:63,z:-.65,width:6.3,back:-7,front:6.5}
export const MENU=[
  {id:'burger',name:'Krull burger',description:'Griddled patty on a toasted bun',price:14},
  {id:'fries',name:'Seasoned fries',description:'Bagged hot from the fryer',price:9},
  {id:'cola',name:'Soda',description:'Cold cola from the fountain',price:8},
] as const
export type MenuItem=(typeof MENU)[number]['id']
export type Meal=MenuItem|'chicken'|'combo'
export type OrderItems=Record<MenuItem,number>
export const blankOrder=():OrderItems=>({burger:0,fries:0,cola:0})
export const legacyItems=(meal:Meal):OrderItems=>meal==='combo'?{burger:1,fries:1,cola:1}:{...blankOrder(),[meal==='chicken'?'burger':meal]:1}
export const orderSize=(items:OrderItems)=>MENU.reduce((count,i)=>count+items[i.id],0)
export const orderPrice=(items:OrderItems)=>MENU.reduce((total,i)=>total+items[i.id]*i.price,0)
export const orderItems=(meal:{items?:OrderItems;item?:Meal})=>meal.items??(meal.item?legacyItems(meal.item):blankOrder())
export const sameItems=(a:OrderItems,b:OrderItems)=>MENU.every(i=>a[i.id]===b[i.id])
const words=['no','one','two','three','four','five','six']
export function orderText(items:OrderItems,spoken=false){
  const names={burger:'burger',fries:'bag of fries',cola:'soda'}
  const plurals={burger:'burgers',fries:'bags of fries',cola:'sodas'}
  const parts=MENU.flatMap(({id})=>{
    const n=items[id]
    return n>0?[(spoken?words[n]:String(n))+' '+(n===1?names[id]:plurals[id])]:[]
  })
  return spoken?new Intl.ListFormat('en',{type:'conjunction'}).format(parts):parts.join(' · ')
}
export const KFC_ROLES=['cashier','cook','janitor'] as const
export type KfcRole=(typeof KFC_ROLES)[number]
export const STAFF={cashier:3,cook:5,janitor:3} satisfies Record<KfcRole,number>
export const COUNTERS=[-2.25,0,2.25] as const
export const GRILLS=[-4.66,-3.12,-1.58,-.04,1.5] as const
export const MANAGER={x:4.75,z:-5}
export const PASS={x:3.5,z:-1.68}
export const SUPPLIES={
  tickets:{x:.3,z:-2.54},bun:{x:-5.33,z:-4.34},raw:{x:-5.33,z:-2.88},
  bag:{x:-3.65,z:-3.71},cup:{x:-1.91,z:-3.71},fryer:{x:2.4,z:-4.81},soda:{x:2.42,z:-3.40},
} as const
export const stationPoint=(slot:number)=>({x:GRILLS[slot],z:-5.46})
export type Ingredient='bun'|'raw'|'bag'|'cup'
export type KitchenMotion={x:number;y:number}
export type KitchenHand=Ingredient|MenuItem|'tray'
export type Patty='empty'|'raw'|'flipped'
export type KitchenJob={ticket:TicketView;done:OrderItems;hand?:KitchenHand;bun:boolean;patty:Patty;readyAt:number}
export type KitchenPoint='tickets'|'bun'|'raw'|'bag'|'cup'|'fryer'|'soda'|'station'|'send'
export const kitchenPay={burger:4,fries:3,cola:2} satisfies Record<MenuItem,number>
export const handNames:Record<KitchenHand,string>={bun:'Bun',raw:'Raw patty',bag:'Fries bag',cup:'Empty cup',burger:'Burger',fries:'Bag of fries',cola:'Soda',tray:'Order tray'}
export function kitchenStationLabel(job:KitchenJob,now:number){
  if(job.hand==='bun')return 'Set bun on the board'
  if(job.hand==='raw')return 'Put patty on the grill'
  if(job.hand&&job.hand!=='tray')return 'Place '+handNames[job.hand].toLowerCase()+' on the tray'
  if(job.patty==='raw')return now<job.readyAt?'Patty is cooking':'Flip the patty'
  if(job.patty==='flipped')return now<job.readyAt?'Patty is cooking':'Assemble burger'
  return 'Lift the finished tray'
}
export const TABLES=[-4.62,4.62].flatMap(x=>[.75,3,5.25].map(z=>({x,z})))
export const SEATS=TABLES.flatMap(({x,z},table)=>[-1,1].map(side=>({x:x+side*.84,z,yaw:side*Math.PI/2,table})))
export type WorkKind='mop'|'wipe'
export const WORK={
  mop:{name:'Mop the spill',steps:['Wet the mop','Mop the spill','Dry the floor'],pay:3},
  wipe:{name:'Clean the table',steps:['Clear the tray','Spray the table','Wipe the table'],pay:3},
} satisfies Record<WorkKind,{name:string;steps:string[];pay:number}>
export type KfcShift={role:KfcRole;slot:number}
export type KfcMeal={id:string;item?:Meal;items?:OrderItems;lane:number;status:'paid'|'served';bites:number;takeaway?:boolean}
export type TicketPhase='queue'|'kitchen'|'ready'|'carrying'|'served'
export type TicketView={id:string;items:OrderItems;lane:number;name:string;phase:TicketPhase;seat?:number}
export type KfcMess={id:string;kind:'wipe'|'mop';x:number;z:number}
export type KfcWork={key:string;kind:WorkKind;step:number;readyAt:number}
export type KfcActor={id:string;name:string;x:number;z:number;yaw:number;pose:'walk'|'work'|'eat'|'sit'|'tray'|'mop'|'wipe';role?:KfcRole|'manager';items?:OrderItems}
export type RestaurantView={
  staff:Record<KfcRole,KfcShiftOwner[]>;queues:TicketView[][];pickup:TicketView[];messes:KfcMess[];actors:KfcActor[];
  taken:number[];mealsAt:{seat:number;items:OrderItems}[];
  tickets:number;now:number;kitchen?:KitchenJob;stations:{slot:number;bun:boolean;patty:Patty;done:OrderItems;lifted:boolean}[];meal?:KfcMeal;shift?:KfcShift;work?:KfcWork;tray?:TicketView;pay?:{coins:number;id:string};
}
type KfcShiftOwner={name:string;player:boolean}
export type KfcPoint={id:`kfc:${string}`;label:string;x:number;z:number;range?:number}
export function restaurantPoints(view?:RestaurantView,seat?:number):KfcPoint[]{
  if(seat!==undefined)return [{id:'kfc:dining',label:'Your table',...SEATS[seat]}]
  if(!view)return []
  const shift=view.shift,points:KfcPoint[]=[{id:'kfc:manager',label:'Speak to the manager',...MANAGER}]
  if(view.meal?.takeaway&&view.meal.status==='served')points.push({id:'kfc:collect',label:'Collect takeaway',x:COUNTERS[view.meal.lane],z:-.55,range:1.32})
  COUNTERS.forEach((x,i)=>{
    if(!(view.meal?.takeaway&&view.meal.status==='served'&&view.meal.lane===i))points.push({id:`kfc:menu:${i}`,label:`Order food · Queue ${i+1}`,x,z:-.55,range:1.2})
    if(shift?.role==='cashier'&&shift.slot===i)points.push({id:`kfc:till:${i}`,label:'Take the next order',x,z:-2.72,range:1.25})
  })
  SEATS.forEach(({x,z},i)=>{
    if(!view.taken.includes(i)&&view.tray?.seat!==i)points.push({id:`kfc:sit:${i}`,label:'Sit at table '+(SEATS[i].table+1),x,z,range:1.02})
  })
  if(shift?.role==='cook'){
    const job=view.kitchen
    const add=(id:KitchenPoint,label:string,point:{x:number;z:number},range=.84)=>points.push({id:`kfc:kitchen:${id}`,label,...point,range})
    if(!job){if(view.tickets)add('tickets','Take a kitchen ticket',SUPPLIES.tickets,1.02)}
    else if(job.hand==='tray')add('send','Leave tray at pickup',PASS,1.05)
    else if(job.hand==='bag')add('fryer','Scoop fries into bag',SUPPLIES.fryer)
    else if(job.hand==='cup')add('soda','Fill cup with soda',SUPPLIES.soda)
    else {
      const more=(item:MenuItem)=>job.done[item]<job.ticket.items[item]
      if(!job.hand&&job.patty==='empty'){
        if(more('burger'))add(job.bun?'raw':'bun',job.bun?'Pick up a raw patty':'Pick up a bun',job.bun?SUPPLIES.raw:SUPPLIES.bun)
        if(more('fries'))add('bag','Pick up a fries bag',SUPPLIES.bag)
        if(more('cola'))add('cup','Pick up an empty cup',SUPPLIES.cup)
      }
      if(job.hand||job.patty!=='empty'||orderSize(job.done)===orderSize(job.ticket.items))
        add('station',kitchenStationLabel(job,view.now),stationPoint(shift.slot),.91)
    }
  }
  if(shift?.role==='cashier'){
    points.push({id:'kfc:pass',label:'Pick up an order',...PASS,range:1.25})
    const table=view.tray?.seat
    if(table!==undefined){
      const {x,z}=SEATS[table]
      points.push({id:'kfc:deliver',label:'Serve table '+(SEATS[table].table+1),x,z,range:1.25})
    }else if(view.tray)points.push({id:'kfc:deliver',label:'Hand the order to '+view.tray.name,x:COUNTERS[view.tray.lane],z:-2.72,range:1.25})
  }
  if(shift?.role==='janitor')view.messes.forEach(m=>points.push({id:`kfc:clean:${m.id}`,label:WORK[m.kind].name,x:m.x,z:m.z,range:1.22}))
  return points
}
export function restaurantObstacle(x:number,z:number){
  if(Math.abs(x)<3.15&&Math.abs(z+1.67)<.54||Math.abs(x-4)<.32&&Math.abs(z+1.7)<.50)return true
  if(x< -5.65&&(Math.abs(z-SUPPLIES.bun.z)<.53||Math.abs(z-SUPPLIES.raw.z)<.53))return true
  if(x>2.74&&x<3.35&&z> -5.34&&z< -3.02)return true
  if(x> -4.28&&x< -1.29&&Math.abs(z+4.27)<.31)return true
  if(Math.abs(x)<2.4&&z< -6.1)return true
  if(Math.abs(x+4.66)<.8&&z< -6.1||Math.abs(x+3.12)<.8&&z< -6.1)return true
  if(Math.abs(x-3.32)<.2&&z< -3.17)return true
  if(Math.abs(z+3.17)<.18&&x>3.15&&Math.abs(x-4.75)>.63)return true
  if(Math.abs(x-4.75)<.86&&z< -5.76)return true
  return TABLES.some(t=>Math.abs(x-t.x)<.62&&Math.abs(z-t.z)<.68)
}
