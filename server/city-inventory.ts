import type {Account} from './accounts.ts'
import {wallet} from './economy.ts'
import {requireSpending} from './credit.ts'
import {blankOrder,MENU,type OrderItems} from '../src/world/restaurant-model.ts'
import {MAX_HP,PRICE,SLOT_COUNT,type Item,type Stack} from '../src/world/arcade.ts'
import {toStockUnits,fromStockUnits} from '../src/stock-model.ts'
import {fail} from './http.ts'

export interface Pack {
  slots:(Stack|null)[]; hp:number; drawers:Record<string,Stack[]>; recovery:Stack[]
  sequence:number;lastShot?:number;stars:number;remaining:number
}
export const foodItem=(item:Item):item is keyof OrderItems=>item!=='cash'&&item!=='blaster'
const limit=(item:Item)=>item==='cash'?Number.MAX_SAFE_INTEGER:item==='blaster'?1:9
export function quantity(value:unknown):number {
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<=0)fail(400,'Choose a positive whole quantity')
  return value
}
function fill(slots:Pack['slots'],item:Item,count:number){
  for(const stack of slots){
    if(stack?.item!==item)continue
    const add=Math.min(count,limit(item)-stack.count)
    count-=add;stack.count+=add
    if(!count)return 0
  }
  if(item==='cash'&&slots.some(s=>s?.item==='cash'))return count
  for(let i=0;i<slots.length&&count;i++){
    if(slots[i])continue
    const add=Math.min(count,limit(item))
    slots[i]={item,count:add};count-=add
  }
  return count
}
export function stash(stacks:Stack[],item:Item,count:number){
  const existing=stacks.find(s=>s.item===item)
  if(existing){if(!Number.isSafeInteger(existing.count+count))fail(409,'Storage limit reached');existing.count+=count}
  else stacks.push({item,count})
}
export function pack(a:Account):Pack {
  if(a.cityPack)return a.cityPack
  const p:Pack={slots:Array(SLOT_COUNT).fill(null),hp:MAX_HP,drawers:{},recovery:[],stars:0,remaining:0,sequence:0}
  a.cityPack=p
  for(const {id} of MENU){
    const amount=a.food?.[id]??0
    if(amount)recover(p,id,amount)
  }
  mirrorFood(a)
  return p
}
export function recover(p:Pack,item:Item,count:number){
  const left=fill(p.slots,item,count)
  if(left)stash(p.recovery,item,left)
}
export function carry(p:Pack,item:Item,count:number){
  if(fill(p.slots,item,quantity(count)))fail(409,'Your nine slots cannot hold that quantity')
}
export function remove(p:Pack,item:Item,count:number){
  let left=quantity(count)
  for(const [i,s] of p.slots.entries()){
    if(s?.item!==item)continue
    const used=Math.min(left,s.count)
    s.count-=used;left-=used
    if(!s.count)p.slots[i]=null
    if(!left)return
  }
  fail(409,'Choose an available quantity')
}
// Compatibility projection for pre-expansion readers. Gameplay always reads the slots.
export function mirrorFood(a:Account){
  const food=blankOrder()
  for(const s of pack(a).slots)if(s&&foodItem(s.item))food[s.item]+=s.count
  a.food=food
  return food
}
export function heal(a:Account,amount:number){const p=pack(a);p.hp=Math.min(MAX_HP,p.hp+amount)}
export function transfer(a:Account,operation:unknown,item:Item,amount:number,atBank:boolean,atShop:boolean,drawer:string|undefined,now:number){
  const p=pack(a)
  if(operation==='withdraw'||operation==='deposit'){
    if(!atBank)fail(409,'Visit the city cash counter')
    const w=wallet(a),units=toStockUnits(w.coins),delta=toStockUnits(amount)
    if(!Number.isSafeInteger(delta))fail(400,'Amount exceeds the wallet limit')
    if(operation==='withdraw'){
      requireSpending(a,now)
      if(units<delta)fail(409,'Insufficient bank balance')
      carry(p,'cash',amount);w.coins=fromStockUnits(units-delta)
    }else{
      if(!Number.isSafeInteger(units+delta))fail(409,'Wallet limit reached')
      remove(p,'cash',amount);w.coins=fromStockUnits(units+delta)
    }
  }else if(operation==='buy'){
    if(!atShop)fail(409,'Visit the arcade gun shop')
    remove(p,'cash',PRICE);carry(p,'blaster',1)
  }else if(operation==='recover'||operation==='take'||operation==='store'){
    if(operation==='recover'?!atBank:!drawer)fail(403,'Open the appropriate storage first')
    if(operation!=='recover'&&foodItem(item))fail(409,'Food belongs in the refrigerator')
    const stacks=operation==='recover'?p.recovery:(p.drawers[drawer!]??=[])
    if(operation==='store'){remove(p,item,amount);stash(stacks,item,amount)}
    else{
      const index=stacks.findIndex(s=>s.item===item&&s.count>=amount)
      if(index<0)fail(409,'Choose an available quantity')
      carry(p,item,amount);stacks[index].count-=amount
      if(!stacks[index].count)stacks.splice(index,1)
    }
  }else fail(400,'Unknown inventory action')
  mirrorFood(a)
}

