import type {OrderItems} from './restaurant-model.ts'

export interface FoodView {
  personal: OrderItems
  stored?: OrderItems
}
export interface FoodAccount {
  food?: OrderItems
  fridges?: Record<string,OrderItems>
  foodReceipts?: Record<string,string>
}
