export type GuestFloor='hotel:2'|'hotel:3'
export const guestFloor=(zone:string|undefined):zone is GuestFloor=>zone==='hotel:2'||zone==='hotel:3'
export const HOTEL_LIFT={x:2.9,z:5.85}
export const STAY_MS=60*60*1000
export const TIERS=[
  {name:'Backstage Single',price:8,note:'A faded quilt, a narrow single and a humming icebox.'},
  {name:'Courtyard Double',price:22,note:'A walnut double with a tiled washroom.'},
  {name:'Velvet King',price:48,note:'A velvet headboard, reading lamps and a rainfall shower.'},
  {name:'Terrace Suite',price:95,note:'A separate sitting area, king bed and jade-tiled bath.'},
  {name:'Aureate Penthouse',price:180,note:'A private salon, oversized bed and a gold-trimmed marble bathroom.'},
] as const
type Bay={floor:GuestFloor;side:number;back:number;front:number}
export type HotelRoom=Bay&{number:number;tier:number;id:string}
const room=(number:number,side:number,back:number,front:number,tier:number):HotelRoom=>({
  number,side,back,front,tier,id:'hotel-'+number,floor:number<300?'hotel:2':'hotel:3',
})
export const ROOMS=[
  room(201,-1,-1,4,0),room(202,1,-1,4,0),room(203,-1,-7,-1,1),room(204,1,-7,-1,1),
  room(205,-1,-13,-7,2),room(206,1,-13,-7,2),room(301,-1,-2,4,2),room(302,1,-3,4,2),
  room(303,-1,-10,-2,3),room(304,1,-11,-3,3),room(305,-1,-23,-10,4),
]
export const venues=[
  {floor:'hotel:2',side:-1,back:-23,front:-13,name:'The Card Salon'},
  {floor:'hotel:2',side:1,back:-23,front:-13,name:'Starlight Arcade'},
  {floor:'hotel:3',side:1,back:-23,front:-11,name:'Palm Baths'},
] as const
const bays=[...ROOMS,...venues]
export const center=(bay:Bay)=>(bay.back+bay.front)/2
export const roomAt=(floor:string,x:number,z:number)=>ROOMS.find(b=>b.floor===floor&&b.side*x>1.7&&z>b.back&&z<b.front)
export const bedAt=(r:HotelRoom)=>({x:r.side*7.65,z:r.front-1.53})
export const fridgeAt=(r:HotelRoom)=>({x:r.side*3.1,z:r.front-.67})
export const dresserAt=(r:HotelRoom)=>({x:r.side*4.75,z:r.front-.56})
export const bathAt=(r:HotelRoom)=>({x:r.side*7.9,z:r.back+.85})
export const liftPoint={id:'resort:lift',label:'Hotel lift',...HOTEL_LIFT,range:1.28}
export const gameStations=[
  {id:'poker',label:'Five-card draw',x:-4.65,z:-15.1},
  {id:'blackjack',label:'Blackjack',x:-4.65,z:-20.4},
  ...[-15.3,-18,-20.7].map(z=>({id:'slots',label:'Play Starlight Slots',x:7.45,z})),
]
export const bathSeats=[-14.36,-19.46]
export function resortPoints(zone:string,keys:readonly string[]=[]){
  if(zone==='hotel')return [liftPoint,{id:'resort:desk',label:'Book a room',x:-6.25,z:-4.96},
    {id:'resort:lottery',label:'Weekly lottery & shares',x:5.8,z:-4.85}]
  if(!guestFloor(zone))return []
  return [liftPoint,...(zone==='hotel:3'?[...bathSeats.map((z,i)=>({id:'bath-seat:'+i,label:'Sit by the pool',x:2.98,z,range:.82})),{id:'resort:billiards',label:'Play three-ball pool',x:-5.6,z:4.76,range:.95}]:[]),...(zone==='hotel:2'?gameStations.map(s=>({...s,id:'resort:'+s.id,range:1.28})):[]),
    ...ROOMS.filter(r=>r.floor===zone&&keys.includes(r.id)).flatMap(roomPoints)]
}
export function roomPoints(r:HotelRoom){
  return [
    {id:'fridge:'+r.id,label:'Open minibar fridge',x:r.side*3.1,z:r.front-1.58,range:.91},
    {id:'drawer:'+r.id,label:'Open dresser drawer',x:dresserAt(r).x,z:r.front-1.43,range:.84},
    {id:'resort:bed:'+r.number,label:'Lie down',x:r.side*6.18,z:bedAt(r).z,range:1},
    {id:'resort:bath:'+r.number,label:'Use the shower',x:r.side*6.65,z:bathAt(r).z,range:1},
  ]
}
export function poolDepth(x:number,z:number){
  if(x<3.5||x>8.45||z< -21.9||z> -12.1)return 0
  return Math.min(1.14,(-12.1-z)*.75,(z+21.9)*.75,(x-3.5)*1.6,(8.45-x)*1.6)
}
export function resortWalkable(zone:GuestFloor,x:number,z:number,keys:readonly string[]){
  const side=Math.abs(x)
  if(side>9.21||z< -22.74||z>7.48)return false
  if(zone==='hotel:3'&&bathSeats.some(seat=>Math.abs(z-seat)<.78&&Math.abs(x-2.35)<.43))return false
  if(zone==='hotel:3'&&Math.abs(x+5.6)<1.92&&Math.abs(z-6.05)<.91)return false
  if(side<1.44||z>4.28)return true
  for(const bay of bays){
    if(bay.floor!==zone||x*bay.side<0)continue
    if(Math.abs(z-bay.front)<.24||Math.abs(z-bay.back)<.24)return false
    if(z<=bay.back||z>=bay.front)continue
    if(side<1.98&&Math.abs(z-center(bay))>.54)return false
    if('id' in bay&&!keys.includes(bay.id))return false
    if('tier' in bay){
      const r=bay
      const dresser=dresserAt(r)
      if(Math.abs(x-dresser.x)<.89&&Math.abs(z-dresser.z)<.51)return false
      if(side>4.24&&side<8.45&&Math.abs(z-r.back-1.89)<.23)return false
      if(r.tier>=3&&Math.abs(side-4.72)<.68&&Math.abs(z-center(r))<1.19)return false
      if(side>6.44&&Math.abs(z-bedAt(r).z)<1.22||Math.abs(side-3.1)<.57&&Math.abs(z-fridgeAt(r).z)<.55)return false
    }
    if(zone==='hotel:2'&&bay.back===-23){
      if(x<0&&gameStations.slice(0,2).some(s=>Math.abs(x+6)<1.3&&Math.abs(z-s.z)<1.37))return false
      if(x>8&&gameStations.slice(2).some(s=>Math.abs(z-s.z)<.72))return false
    }
  }
  return true
}

export const TICKET_PRICE=10, SHARE_PRICE=25, LOT_SHARES=1000, TABLE_STAKE=10
export type CardGame='poker'|'blackjack'
export interface TableView{
  id:string;revision:number;phase:'waiting'|'play'|'settled';until:number
  seats:{name:string;cards:number[];count:number;done:boolean;paid?:number}[]
  dealer:number[];result?:string;turn?:string;bet?:boolean;actions:string[];hands?:{name:string;cards:number[];stake:number;active:boolean}[]
}
export interface LotteryView{
  until:number;pool:number;npc:number;tickets:number;mine:number;shares:number;available:number
  last?:{winner:string;prize:number;dividend:number};dividends:number
}
export interface ResortView{
  lottery?:LotteryView;table?:TableView;slots?:{reels:number[];paid:number};sequence:number
}
export const slotSymbols=['Cherry','Lemon','Plum','Bell','Crown','Star'] as const
export const slotPays=[18,22,30,35,45,55] as const // 205 winning units per 216 equiprobable stops
export function blackjackTotal(cards:number[]){
  let total=0,aces=0
  for(const card of cards){
    const rank=card%13+2
    total+=rank===14?1:Math.min(rank,10)
    if(rank===14)aces++
  }
  return aces&&total<=11?total+10:total
}
export function cardLabel(card:number){return '23456789TJQKA'[card%13]+'♣♦♥♠'[Math.floor(card/13)%4]}
