import {pathToFileURL} from 'node:url'
import {join} from 'node:path'
import {ChessStore} from '../server/storage.ts'
import {mergedChanges,eloChanges,eliminationCredits} from '../server/accounts.ts'
import {players,playerCount,survivors} from '../src/model.ts'

export const BATCH='legacy-elo-backfill-1200-v1'
/** Replay archived, pre-mode multiplayer in creation order. Current balances never price a result. */
export function planLegacyRatings(rooms){
 const virtual=new Map(),pools=new Map(),games=[]
 for(const room of rooms.filter(r=>!r.ai&&!r.state.movement&&r.results.length&&survivors(r.state).length<=1).sort((a,b)=>a.created-b.created||a.code.localeCompare(b.code))){
  if(room.ratingSettled||room.ratingChanges)throw new Error('A legacy room already has a settlement; review its existing ledger first')
  if(!Number.isFinite(room.created))throw new Error('Legacy room is missing its chronology')
  const seats=players(room.state),names=seats.map(p=>room.seats[p]);if(names.some(n=>!n)||new Set(names).size!==seats.length)throw new Error('Legacy room has incomplete or duplicate seats')
  const deaths=[...new Set(room.results.flatMap(r=>r.eliminated))].sort();if(JSON.stringify(deaths)!==JSON.stringify([...room.state.eliminated].sort()))throw new Error('Legacy finish order is incomplete')
  const placement=seats.map(p=>{const i=room.results.findIndex(r=>r.eliminated.includes(p));return i<0?room.results.length:i}),kills=eliminationCredits(room),before=names.map(n=>virtual.get(n)??1200),pool=playerCount(room.state)===2?'live-duel':'live-multi',statsBefore=names.map(n=>pools.get(n+':'+pool)??1200)
  const deltas=mergedChanges(before,placement,seats.map(p=>kills[p]??0)),stats=eloChanges(statsBefore,placement)
  if(deltas.reduce((a,b)=>a+b,0)!==0)throw new Error('Unbalanced legacy rating result')
  names.forEach((n,i)=>{virtual.set(n,before[i]+deltas[i]);pools.set(n+':'+pool,statsBefore[i]+stats[i])})
  games.push({code:room.code,created:room.created,seats,names,before,deltas,after:names.map(n=>virtual.get(n)),pool,statsBefore,stats})
 }
 return {baseline:1200,order:'creation-ascending',games,totals:Object.fromEntries([...virtual].map(([name,elo])=>[name,elo-1200]))}
}
export function applyLegacyRatings(store,plan,now=Date.now()){
 return store.transaction(unit=>{
  const existing=unit.metadata(BATCH);if(existing)return {...existing,alreadyApplied:true}
  const applied=[]
  for(const game of plan.games){
   const room=unit.rooms.get(game.code);if(!room||room.state.movement||room.ai||room.ratingSettled||room.ratingChanges||survivors(room.state).length>1)throw new Error('Legacy game changed before settlement')
   room.ratingStart={};room.statsStart={};room.ratingChanges={}
   for(const [i,seat]of game.seats.entries()){
    const account=unit.users.get(game.names[i]);if(!account)throw new Error('Missing legacy player')
    account.rating??={value:1200,games:0};account.ratings??={};account.ratings[game.pool]??={value:1200,games:0}
    const before=account.rating.value;account.rating.value+=game.deltas[i];account.rating.games++;account.ratings[game.pool].value+=game.stats[i];account.ratings[game.pool].games++
    room.ratingStart[seat]=game.before[i];room.statsStart[seat]=game.statsBefore[i];room.ratingChanges[seat]={before:game.before[i],after:game.after[i],delta:game.deltas[i]}
    applied.push({game:game.code,name:account.name,delta:game.deltas[i],balanceBefore:before,balanceAfter:account.rating.value})
   }
   room.rated=true;room.ratingSettled=true;room.legacyEloBackfill={batch:BATCH,appliedAt:now,baseline:1200}
  }
  const report={...plan,appliedAt:now,applied,coinsChanged:false};unit.putMetadata(BATCH,report);return report
 })
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const apply=process.argv.includes('--apply'),directory=process.env.DATA_DIR??'data',store=new ChessStore(directory,{readOnly:!apply})
 try{
  const snapshot=store.snapshot();if(snapshot[BATCH])console.log(JSON.stringify({...snapshot[BATCH],alreadyApplied:true},null,2))
  else{const plan=planLegacyRatings(snapshot.rooms);if(!apply)console.log(JSON.stringify({dryRun:true,...plan},null,2));else{const backup=join(directory,'backups','before-legacy-elo-'+Date.now()+'.sqlite');await store.backup(backup);console.log(JSON.stringify({backup,...applyLegacyRatings(store,plan)},null,2));console.log(JSON.stringify(store.check()))}}
 }finally{store.close()}
}
