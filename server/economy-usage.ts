import type {EquitySymbol,StockSide} from '../src/stock-model.ts'

/** Server-authored fields only. Never serialize request bodies, credentials or internal valuations. */
export interface EconomyUsage {
  action:
    |'order_placed'|'order_canceled'|'order_filled'|'quoted_stock_trade'
    |'loan_opened'|'loan_payment'|'debt_collection'|'credit_changed'|'loan_default'
    |'policy_support'|'ballot_opened'|'ballot_vote'|'ballot_closed'
    |'dividend'|'bankruptcy'|'rescue_support'|'rescue_stage'|'rescue_decision'
    |'housing_purchase'|'housing_lease'|'restaurant_action'|'bar_purchase'|'recapitalization'|'company_recovered'|'corporate_payment'|'desk_opened'|'share_issuance'|'buyback'|'wager_locked'|'wager_settled'
  symbol?:EquitySymbol|string
  side?:StockSide
  coins?:number
  shares?:number
  price?:number
  interest?:number
  score?:number
  days?:number
  value?:number
  policy?:string
  service?:string
  reference?:string
  status?:'yes'|'no'|'approved'|'rejected'|'enabled'|'disabled'|'won'|'lost'|'public'|'cave'|'elo'
}
