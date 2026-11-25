import {existsSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {ChessStore} from '../server/storage.ts'
import {book,release} from '../server/custody.ts'

const [operation,name,flag,...extra]=process.argv.slice(2)
if(!process.env.DATA_DIR||!name||extra.length||!['jail','release'].includes(operation)||
    flag!==undefined&&(operation!=='jail'||flag!=='--no-release'))throw Error('Set DATA_DIR and use jail USER [--no-release] or release USER')
const dir=resolve(process.env.DATA_DIR)
if(!existsSync(join(dir,'chess.sqlite')))throw Error('Choose an existing game database')
const store=new ChessStore(dir)
try{
  const result=store.transaction(tx=>{
    const user=tx.findAccount(name)?.name
    if(!user)throw Error('Unknown account')
    if(operation==='release'){release(tx,user);return 'Released'}
    const booking=book(tx,user,5,Date.now(),true,flag==='--no-release')
    if(!booking)throw Error('All 50 cells are occupied')
    return booking.name+' assigned'
  })
  console.log(result)
}finally{store.close()}

