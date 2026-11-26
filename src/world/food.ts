import {MENU,type OrderItems,type MenuItem} from './restaurant-model.ts'

export const GROCERIES=[
  ...MENU,
  {id:'bread',name:'Sourdough roll',price:6},
  {id:'apple',name:'Orchard apple',price:4},
  {id:'coffee',name:'House coffee',price:7},
] as const
export type Grocery=typeof GROCERIES[number]['id']
export type Pantry=OrderItems & Partial<Record<Exclude<Grocery,MenuItem>,number>>
export const isGrocery=(item:unknown):item is Grocery=>GROCERIES.some(entry=>entry.id===item)
export const BITE_MS=2400
export type Bite={item:Grocery;ends:number}
export interface FoodView {
  personal: Pantry
  stored?: Pantry
}
export interface FoodAccount {
  food?: Pantry
  fridges?: Record<string,Pantry>
  foodReceipts?: Record<string,string>
}
