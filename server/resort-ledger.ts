import {wallet} from './economy.ts'
import {requireSpending} from './credit.ts'
import {fromStockUnits,toStockUnits} from '../src/stock-model.ts'
import {fail} from './http.ts'
import type {Account} from './accounts.ts'
import type {UnitOfWork} from './storage.ts'

export function debit(account:Account,coins:number,now:number){
  const purse=wallet(account)
  requireSpending(account,now)
  if(purse.coins<coins)fail(409,'Insufficient coins')
  purse.coins=fromStockUnits(toStockUnits(purse.coins)-toStockUnits(coins))
}
export function resortAccount(unit:UnitOfWork,name:string){
  return unit.users.get(name)??fail(404,'Account unavailable')
}
export function quantity(value:unknown,max:number){
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<1||value>max)fail(400,'Choose 1–'+max+' whole units')
  return value
}
