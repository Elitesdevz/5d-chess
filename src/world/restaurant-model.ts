export const RESTAURANT_NAME='Krulliversal Fried Chicken'
export const RESTAURANT={x:36.6,z:22,width:6.3,back:-7,front:6.5}
export const MENU=[
  {id:'chicken',name:'Crispy chicken',description:'Two pieces, fried until golden',price:12,work:['pack']},
  {id:'burger',name:'Krull burger',description:'Crispy chicken, lettuce and house sauce',price:14,work:['flip']},
  {id:'fries',name:'Seasoned fries',description:'Golden fries with Krull seasoning',price:9,work:['fries']},
  {id:'cola',name:'Cola',description:'Cold and served over ice',price:8,work:['pack']},
  {id:'combo',name:'Krull combo',description:'Krull burger, seasoned fries and cola',price:22,work:['flip','fries']},
] as const
export type Meal=(typeof MENU)[number]['id']
export const menuItem=(id:unknown)=>MENU.find(item=>item.id===id)
export const KFC_ROLES=['cashier','cook','janitor'] as const
export type KfcRole=(typeof KFC_ROLES)[number]
export const STAFF={cashier:3,cook:5,janitor:3} satisfies Record<KfcRole,number>
export const COUNTERS=[-2.25,0,2.25] as const
export const GRILLS=[-4.66,-3.12,-1.58,-.04,1.5] as const
export const MANAGER={x:4.75,z:-5}
export const PASS={x:3.5,z:-1.68}
export const TABLES=[-4.62,4.62].flatMap(x=>[.75,3,5.25].map(z=>({x,z})))
export const SEATS=TABLES.flatMap(({x,z},table)=>[-1,1].map(side=>({x:x+side*.84,z,yaw:side*Math.PI/2,table})))
export type WorkKind='fries'|'flip'|'pack'|'mop'|'wipe'
export const WORK={
  fries:{name:'Bag the fries',steps:['Scoop fries','Fill the bag','Seal the bag'],pay:3},
  flip:{name:'Cook the burger',steps:['Place patty','Flip burger','Plate burger'],pay:4},
  pack:{name:'Pack the order',steps:['Set out packaging','Pack the item','Seal the order'],pay:2},
  mop:{name:'Mop the spill',steps:['Wet the mop','Mop the spill','Dry the floor'],pay:3},
  wipe:{name:'Clean the table',steps:['Clear the tray','Spray the table','Wipe the table'],pay:3},
} satisfies Record<WorkKind,{name:string;steps:string[];pay:number}>
export type KfcShift={role:KfcRole;slot:number}
export type KfcMeal={id:string;item:Meal;lane:number;status:'paid'|'served';bites:number}
export type TicketPhase='queue'|'kitchen'|'ready'|'carrying'|'served'
export type TicketView={id:string;item:Meal;lane:number;name:string;phase:TicketPhase;seat?:number}
export type KfcMess={id:string;kind:'wipe'|'mop';x:number;z:number}
export type KfcWork={key:string;kind:WorkKind;step:number;readyAt:number}
export type KfcActor={id:string;name:string;x:number;z:number;yaw:number;pose:'walk'|'work'|'eat'|'sit'|'tray'|'mop';role?:KfcRole|'manager'}
export type RestaurantView={
  staff:Record<KfcRole,KfcShiftOwner[]>;queues:TicketView[][];pickup:TicketView[];messes:KfcMess[];actors:KfcActor[];
  taken:number[];mealsAt:{seat:number;item:Meal}[];meal?:KfcMeal;shift?:KfcShift;work?:KfcWork;tray?:TicketView;pay?:{coins:number;id:string};
}
type KfcShiftOwner={name:string;player:boolean}
export type KfcPoint={id:`kfc:${string}`;label:string;x:number;z:number;range?:number}
export function restaurantPoints(view?:RestaurantView,seat?:number):KfcPoint[]{
  if(seat!==undefined)return [{id:'kfc:dining',label:'Your table',...SEATS[seat]}]
  if(!view)return []
  const shift=view.shift,points:KfcPoint[]=[{id:'kfc:manager',label:'Speak to the manager',...MANAGER}]
  COUNTERS.forEach((x,i)=>{
    points.push({id:`kfc:menu:${i}`,label:`Order food · Queue ${i+1}`,x,z:-.55,range:1.2})
    if(shift?.role==='cashier'&&shift.slot===i)points.push({id:`kfc:till:${i}`,label:'Take the next order',x,z:-2.72,range:1.25})
  })
  SEATS.forEach(({x,z},i)=>{
    if(!view.taken.includes(i))points.push({id:`kfc:sit:${i}`,label:'Sit at table '+(SEATS[i].table+1),x,z,range:1.02})
  })
  if(shift?.role==='cook')points.push({id:'kfc:cook',label:'Work at kitchen station '+(shift.slot+1),x:GRILLS[shift.slot],z:-5.47,range:1.25})
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
  if(Math.abs(x)<2.4&&z< -6.1)return true
  if(Math.abs(x+4.66)<.8&&z< -6.1||Math.abs(x+3.12)<.8&&z< -6.1)return true
  if(Math.abs(x-3.32)<.2&&z< -3.17)return true
  if(Math.abs(z+3.17)<.18&&x>3.15&&Math.abs(x-4.75)>.63)return true
  if(Math.abs(x-4.75)<.86&&z< -5.76)return true
  return TABLES.some(t=>Math.abs(x-t.x)<.62&&Math.abs(z-t.z)<.68)
}
