import {roster} from './custody.ts'
import {BIO_LIMIT,type ShowcaseSkin,type PlayerCard,type ProfileEditor,type HistoryEntry,type HistoryPage} from '../src/profile-model.ts'
import {KINDS,PLAYERS,type Player} from '../src/model.ts'
import {itemById,covers,setById,SETS,planSet} from '../src/collection.ts'
import type {CasinoState} from '../src/casino-model.ts'
import type {Account} from './accounts.ts'
import {profile} from './accounts.ts'
import {equip,wallet} from './economy.ts'
import type {ChessStore,UnitOfWork} from './storage.ts'
import type {Reply} from './model.ts'
import {fail} from './http.ts'

function available(account:Account,itemId:string,kind?:ShowcaseSkin['kind']){const set=setById(itemId);return set?planSet(account.wallet?.inventory??[],set).complete:account.wallet?.inventory.some(o=>covers(o,itemId,kind)&&!o.pending&&!o.listed)??false}
export function profileCard(store:ChessStore,account:Account,viewer:string):PlayerCard{
 const rank=store.leaderboard().find(p=>p.name===account.name),identity=account.publicIdentity
 return {name:account.name,avatar:account.wallet?.loadout.icon??'default',frame:account.wallet?.loadout.frame,rating:Math.round(account.rating?.value??1200),games:account.rating?.games??0,rank:rank?.rank??0,bio:identity?.bio??'',showcase:(identity?.showcase??[]).filter(s=>!!(itemById(s.itemId)||setById(s.itemId))&&available(account,s.itemId,s.kind)),owner:account.name===viewer,record:store.profileRecord(account.name)}
}
function editor(account:Account):ProfileEditor{
 const identity=account.publicIdentity,w=wallet(account),usable=w.inventory.filter(o=>!o.pending&&!o.listed),ids=[...new Set(usable.map(o=>o.itemId))]
 return {bio:identity?.bio??'',showcase:(identity?.showcase??[]).filter(s=>available(account,s.itemId,s.kind)),revision:identity?.revision??0,avatar:w.loadout.icon,frame:w.loadout.frame??'default',icons:ids.filter(id=>itemById(id)?.type==='icon'),frames:ids.filter(id=>itemById(id)?.type==='frame'),skins:[...ids.filter(id=>!!itemById(id)).map(itemId=>({itemId,kinds:['skin','shape'].includes(itemById(itemId)!.type)?KINDS.filter(k=>available(account,itemId,k)):[...KINDS]})),...SETS.filter(set=>planSet(usable,set).complete).map(set=>({itemId:set.id,kinds:[...KINDS]}))]}
}
function save(account:Account,data:Record<string,unknown>){
 if(!Number.isSafeInteger(data.revision)||data.revision!==(account.publicIdentity?.revision??0))fail(409,'Your profile changed in another tab. Reload the editor before saving.')
 if(typeof data.bio!=='string'||data.bio.length>BIO_LIMIT||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(data.bio))fail(400,`Description must be plain text of at most ${BIO_LIMIT} characters`)
 if(!Array.isArray(data.showcase)||data.showcase.length>3)fail(400,'Choose up to three different items')
 const showcase:ShowcaseSkin[]=[]
 for(const raw of data.showcase){
  if(!raw||typeof raw!=='object'||typeof raw.itemId!=='string'||!(itemById(raw.itemId)||setById(raw.itemId))||!KINDS.includes(raw.kind)||!PLAYERS.includes(raw.color))fail(400,'Choose valid items, piece types and faction colors')
  if(showcase.some(s=>s.itemId===raw.itemId))fail(400,'Choose three different items')
  if(!available(account,raw.itemId,raw.kind))fail(409,'A showcased item is no longer available in your inventory')
  showcase.push({itemId:raw.itemId,kind:raw.kind,color:raw.color})
 }
 // Validate the entire appearance on a copy before changing any live fields.
 const candidate=structuredClone(account)
 for(const [slot,id] of [['icon',data.avatar],['frame',data.frame]] as const){
  if(typeof id!=='string'||id!=='default'&&itemById(id)?.type!==slot)fail(400,'Choose a valid avatar and frame')
  const owned=id==='default'?'default':wallet(candidate).inventory.find(o=>o.itemId===id&&!o.pending&&!o.listed)?.uid
  if(!owned)fail(409,'That avatar or frame is no longer available')
  equip(candidate,slot,owned)
 }
 wallet(account).loadout=wallet(candidate).loadout
 account.publicIdentity={bio:(data.bio as string).replace(/\r\n?/g,'\n').replace(/\t/g,' ').trim(),showcase,revision:Number(data.revision)+1}
}
function cursor(raw:string|null){if(!raw)return {time:Number.MAX_SAFE_INTEGER,id:'z',gameId:Number.MAX_SAFE_INTEGER};const match=/^(\d{1,16})\|([gce]:[a-z0-9]{1,24})$/.exec(raw);if(!match||!Number.isSafeInteger(Number(match[1])))fail(400,'Invalid history cursor');const id=match![2];if(id.startsWith('g:')?!/^g:\d{1,16}$/.test(id)||!Number.isSafeInteger(Number(id.slice(2))):! /^[ce]:[a-f0-9]{24}$/.test(id))fail(400,'Invalid history cursor');return {time:Number(match![1]),id,gameId:id.startsWith('g:')?Number(id.slice(2)):0}}
export function profileHistory(store:ChessStore,account:Account,viewer:string,tab:string,raw:string|null):HistoryPage{
 if(!['games','casino'].includes(tab))fail(400,'Choose game or gambling history')
 const before=cursor(raw),entries:HistoryEntry[]=[]
 if(tab==='games')for(const row of store.profileGameRows(account.name,before.time,before.gameId,21)){
  const summary=JSON.parse(row.summary),seats=JSON.parse(row.seats) as Record<Player,string>,eliminated=JSON.parse(row.eliminated) as Player[],seat=PLAYERS.find(p=>seats[p]===account.name)!,canSee=!summary.protected||Object.values(seats).includes(viewer),draw=summary.draw?!eliminated.includes(seat):eliminated.length>=summary.maxPlayers,won=summary.finished&&!eliminated.includes(seat)&&!draw,changes=JSON.parse(row.changes) as Record<Player,{delta:number}>
  entries.push({id:'g:'+String(row.id).padStart(12,'0'),created:row.created,kind:'match',title:canSee?summary.title:'Private match',status:summary.finished?draw?'Draw':won?'Victory':'Defeat':summary.players<summary.maxPlayers?'Waiting':'In progress',delta:summary.ai?(summary.aiReward??0):(changes[seat]?.delta??0),unit:summary.ai?'coins':'elo',opponents:canSee?Object.values(seats).filter(n=>n!==account.name):[],movement:summary.movement,players:summary.maxPlayers,rated:summary.rated,ai:summary.ai,...(canSee?{href:'/chess/online.html?code='+encodeURIComponent(row.code)}:{})})
 }
 const recent=(account as Account&{casino?:CasinoState}).casino?.recent??[]
 for(const round of recent){
  if(round.currency==='elo'){
   if(tab==='games'&&!round.won)entries.push({id:'e:'+round.id,created:round.created,kind:'anomaly',title:'?????',status:'?????',delta:-(round.eloLost??round.stake),unit:'elo'})
   if(tab==='casino'&&round.won)entries.push({id:'e:'+round.id,created:round.created,kind:'anomaly',title:'?????',status:'?????',delta:round.credited,unit:'coins'})
  }else if(tab==='casino')entries.push({id:'c:'+round.id,created:round.created,kind:round.game,title:round.game==='dice'?'Dice':'Roulette',status:round.won?'Won':'Lost',delta:round.net,unit:'coins'})
 }
 const rows=entries.filter(e=>e.created<before.time||e.created===before.time&&e.id.localeCompare(before.id)<0).sort((a,b)=>b.created-a.created||b.id.localeCompare(a.id)),items=rows.slice(0,20),last=items.at(-1)
 return {items,next:rows.length>20&&last?last.created+'|'+last.id:null}
}
export function playerProfileApi(store:ChessStore,unit:UnitOfWork,source:Account,url:URL,method:string,data:Record<string,unknown>):Reply|undefined{
 if(!['/api/profile','/api/profile/edit','/api/profile/history'].includes(url.pathname))return
 const name=url.searchParams.get('user')??source.name;if(!name.trim()||name.length>32)fail(400,'Invalid player name')
 const bookings=roster(store,Date.now()),inmate=bookings.find(b=>b.name===name)
 if(!inmate&&bookings.some(b=>b.user.toLowerCase()===name.toLowerCase()))fail(404,'Player not found')
 const account=unit.findAccount(inmate?.user??name)??fail(404,'Player not found')
 if(url.pathname==='/api/profile'&&method==='GET')return {status:200,value:inmate?{...profileCard(store,account,source.name),bio:'',showcase:[]}:profileCard(store,account,source.name)}
 if(url.pathname==='/api/profile/history'&&method==='GET')return {status:200,value:profileHistory(store,account,source.name,url.searchParams.get('tab')??'games',url.searchParams.get('before'))}
 if(account.name!==source.name)fail(403,'You can only edit your own profile')
 if(url.pathname==='/api/profile/edit'&&method==='GET')return {status:200,value:editor(account)}
 if(url.pathname==='/api/profile'&&method==='POST'){save(account,data);return {status:200,value:{card:profileCard(store,account,source.name),profile:profile(account)}}}
 fail(405,'Method not allowed')
}
