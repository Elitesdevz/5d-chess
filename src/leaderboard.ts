import {profileHref} from './profile-model.ts'
import {api,getSession,initShell} from './shell.ts'
import {framedAvatar} from './cosmetic-art.ts'
interface Player {name:string;avatar:string;frame?:string;rating?:number;coins?:number;games?:number;rank:number}
interface Rankings {players:Player[];me:{rating?:number;coins?:number;rank:number|null}}
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T
const coins=new URLSearchParams(location.search).get('mode')==='coins'
const format=new Intl.NumberFormat('en',{maximumFractionDigits:4})
if(coins){el('full-rankings-title').textContent='Coin leaderboard';el('full-rankings-caption').textContent='Ranked by coin balance';el('full-ranking-table').dataset.mode='coins'}
let rows:Player[]=[],page=0,name=''
function render(){
 const search=el<HTMLInputElement>('leaderboard-search').value.trim().toLocaleLowerCase(),filtered=rows.filter(p=>p.name.toLocaleLowerCase().includes(search)),pages=Math.max(1,Math.ceil(filtered.length/100));page=Math.min(page,pages-1)
 const table=document.createElement('table');table.innerHTML=`<thead><tr><th scope="col">Rank</th><th scope="col">Player</th>${coins?'':'<th scope="col">Rated games</th>'}<th scope="col">${coins?'Coins':'Elo'}</th></tr></thead><tbody></tbody>`
 for(const p of filtered.slice(page*100,(page+1)*100)){
  const row=document.createElement('tr');row.classList.toggle('self',p.name===name);row.innerHTML=`<td></td><td><a class="rank-player player-profile-link" href="${profileHref(p.name)}"><span class="small-avatar">${framedAvatar(p.avatar,p.frame)}</span><strong></strong></a></td>${coins?'':'<td></td>'}<td></td>`
  row.cells[0].textContent=String(p.rank);row.querySelector('strong')!.textContent=p.name;if(!coins)row.cells[2].textContent=String(p.games);row.cells[coins?2:3].textContent=format.format((coins?p.coins:p.rating)??0);table.tBodies[0].append(row)
 }
 el('full-ranking-table').replaceChildren(table);if(!filtered.length){const empty=document.createElement('p');empty.className='card-empty';empty.textContent='No players match your search.';el('full-ranking-table').append(empty)}
 el('leaderboard-count').textContent=`${filtered.length} ${filtered.length===1?'player':'players'}${search?' found':''} · ${rows.length} total`
 el('ranking-page').textContent=`Page ${page+1} of ${pages}`;el<HTMLButtonElement>('ranking-prev').disabled=page===0;el<HTMLButtonElement>('ranking-next').disabled=page>=pages-1
}
async function init(){await initShell();const session=await getSession();if(!session.user){location.replace('/chess/login.html');return}name=session.user;const data=await api<Rankings>(coins?'/leaderboard/coins/full':'/leaderboard/full');rows=data.players;el('leaderboard-self').textContent=`Your ${coins?'coins':'Elo'}: ${format.format((coins?data.me.coins:data.me.rating)??0)}${data.me.rank?` · #${data.me.rank}`:''}`;render();el('leaderboard-search').oninput=()=>{page=0;render()};el('ranking-prev').onclick=()=>{page--;render()};el('ranking-next').onclick=()=>{page++;render()}}
void init().catch(cause=>{el('leaderboard-error').textContent=cause instanceof Error?cause.message:'Could not load leaderboard';el('leaderboard-error').hidden=false})
