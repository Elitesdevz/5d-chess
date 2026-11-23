export const BANK_TERMS = [
  {days:3,basisPoints:60},
  {days:7,basisPoints:45},
  {days:14,basisPoints:35},
] as const
export const BANK_MIN_LOAN=100
export const BANK_MAX_LOAN=12_000
export const BANK_SHARE_COUNT=5000
export const BANK_PUBLIC_SHARES=1000
export const BANK_DIVIDEND_PERCENT=25
export const BANK_OVERDUE_BPS=90
export const BANK_MAX_INTEREST_PERCENT=25
export type BankTerm=(typeof BANK_TERMS)[number]['days']
export interface BankLoanView {id:string;original:number;principal:number;interest:number;total:number;days:BankTerm;opened:number;due:number;overdue:boolean}
export interface BankReceipt {id:string;sequence:number;kind:'borrow'|'repay';requested:number|null;amount:number;interest:number;at:number;days?:BankTerm}
export interface BankView {coins:number;limit:number;reserve:number;loan?:BankLoanView;receipts:BankReceipt[];sequence:number;now:number}
