export const BANK_TERMS = [3,7,14,21,30].map(days=>({days:days as BankTerm}))
export const BANK_MIN_LOAN=100
export const BANK_MAX_LOAN=12_000
export const BANK_SHARE_COUNT=500_000
export const BANK_PUBLIC_SHARES=BANK_SHARE_COUNT
export type BankTerm=3|7|14|21|30
export interface BankLoanView {id:string;original:number;principal:number;interest:number;total:number;days:BankTerm;opened:number;due:number;overdue:boolean;rate:number;defaulted:boolean}
export interface BankReceipt {id:string;sequence:number;kind:'borrow'|'repay'|'collection';requested:number|null;amount:number;interest:number;at:number;days?:BankTerm}
export interface BankView {coins:number;limit:number;reserve:number;loan?:BankLoanView;receipts:BankReceipt[];sequence:number;now:number;score:number;rate:number;blockedUntil?:number;recoveryAt?:number;lendingOpen:boolean}
