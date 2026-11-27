import type {UnitOfWork} from './storage.ts'
import {notify} from './accounts.ts'
import {wallet} from './economy.ts'
import {fromStockUnits,toStockUnits} from '../src/stock-model.ts'

/** Account changes and their receipts commit together, once per deployment batch. */
export function applyAccountUpdates(unit:UnitOfWork){
  const bonus='dima-2000-coins-2026-11-27',greeting='master-hi-warning-2026-11-27'
  const dima=unit.findAccount('DIMA')
  if(dima&&!unit.metadata(bonus)){
    const purse=wallet(dima),balance=toStockUnits(purse.coins)+toStockUnits(2000)
    if(!Number.isSafeInteger(balance))throw new Error('Wallet limit reached')
    purse.coins=fromStockUnits(balance)
    unit.putMetadata(bonus,{account:dima.name,coins:2000,appliedAt:Date.now()})
  }
  const master=unit.findAccount('Master')
  if(master&&!unit.metadata(greeting)){
    notify(master,{kind:'warning',title:'Warning',detail:'hi',code:''})
    unit.putMetadata(greeting,{account:master.name,appliedAt:Date.now()})
  }
}
