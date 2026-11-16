import {DatabaseSync} from 'node:sqlite'
import {resolve,join} from 'node:path'
import {writeFileSync} from 'node:fs'
const [command,name,destination]=process.argv.slice(2),path=join(resolve(process.env.DATA_DIR??'data'),'telemetry.sqlite')
if(!['summary','export'].includes(command)||command==='export'&&(!name||!destination))throw new Error('Usage: DATA_DIR=... node scripts/telemetry-admin.mjs summary | export <exact-username> <new-jsonl-file>')
const db=new DatabaseSync(path,{readOnly:true})
try{
 if(command==='summary')console.log(JSON.stringify(db.prepare('SELECT account,bytes,events FROM usage_totals ORDER BY account').all(),null,2))
 else{const rows=db.prepare('SELECT payload FROM usage_events WHERE account=? ORDER BY id').all(name);writeFileSync(resolve(destination),rows.map(r=>r.payload).join('\n')+(rows.length?'\n':''),{flag:'wx',mode:0o600});console.log(JSON.stringify({account:name,events:rows.length,destination:resolve(destination)}))}
}finally{db.close()}
