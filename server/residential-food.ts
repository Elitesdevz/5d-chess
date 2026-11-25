import {pack,carry,remove,releaseFridge,heal,mirrorFood} from './city-inventory.ts'
import {blankOrder,MENU,type MenuItem} from '../src/world/restaurant-model.ts'
import type {FoodView} from '../src/world/food.ts'
import {access} from '../src/world/residential.ts'
import type {Account} from './accounts.ts'
import type {ChessStore} from './storage.ts'
import {fail} from './http.ts'

export function residentialFood(store:ChessStore,name:string,keys:readonly string[],unit?:string,command?:Record<string,unknown>):FoodView {
  if(unit&&!access(unit,keys))fail(409,'Open an accessible refrigerator first')
  if(!command){
    const payload=store.accountJson(name)??fail(401,'Log in first')
    const account=JSON.parse(payload) as Account
    if(account.cityPack&&!Object.keys(account.fridges??{}).some(id=>!access(id,keys))){
      return {personal:account.food??blankOrder(),stored:unit?(account.fridges?.[unit]??blankOrder()):undefined}
    }
  }
  return store.transaction(tx=>{
    const account=tx.users.get(name)??fail(401,'Log in first')
    const p=pack(account)
    for(const id of Object.keys(account.fridges??{}))if(!access(id,keys))releaseFridge(account,id)
    const personal=mirrorFood(account)
    const stored=unit?(account.fridges?.[unit]??blankOrder()):undefined
    if(command){
      const {id,item,operation,amount}=command
      if(typeof id!=='string'||!/^[-\w]{12,80}$/.test(id)||!MENU.some(entry=>entry.id===item)||
        (operation!=='eat'&&operation!=='store'&&operation!=='take'))fail(400,'Choose a valid food action')
      if(operation!=='eat'&&(!stored||!unit||!access(unit,keys)))fail(409,'Open an accessible refrigerator first')
      const type=item as MenuItem
      const source=operation==='take'?stored!:personal
      const quantity=amount==='all'?source[type]:amount
      const receipt=JSON.stringify([operation,type,amount,operation==='eat'?null:unit])
      const receipts=account.foodReceipts??={}
      if(receipts[id]!==undefined){
        if(receipts[id]!==receipt)fail(409,'This request has already been used')
      }else{
        if(typeof quantity!=='number'||!Number.isSafeInteger(quantity)||quantity<1||quantity>source[type])fail(409,'Choose an available quantity')
        if(operation==='take'){carry(p,type,quantity);stored![type]-=quantity}
        else remove(p,type,quantity)
        if(operation==='eat')heal(account,quantity*20)
        if(operation==='store')stored![type]+=quantity
        if(stored&&unit)(account.fridges??={})[unit]=stored
        mirrorFood(account)
        p.sequence++
        receipts[id]=receipt
        tx.economyUsage(name,'/api/world/food',{action:'restaurant_action',service:'food_'+operation,reference:type,value:quantity},Date.now())
      }
    }
    return {personal:account.food!,stored}
  })
}
