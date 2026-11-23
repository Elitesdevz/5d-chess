import {profileHref} from './profile-model.ts'
import {api,getSession,initShell} from './shell.ts'
import {framedAvatar} from './cosmetic-art.ts'
import {rankingMode,rankingModes,rankingValue,type RankedPlayer,type RankingPage} from './ranking-model.ts'

const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T
const mode=rankingMode(new URLSearchParams(location.search).get('mode')),config=rankingModes[mode],rated=mode==='elo'
el('full-rankings-title').textContent=config.title
el('full-rankings-caption').textContent=config.caption
el('full-ranking-table').dataset.mode=mode
let rows:RankedPlayer[]=[],page=0,name=''
function render(){
 const search=el<HTMLInputElement>('leaderboard-search').value.trim().toLocaleLowerCase(),filtered=rows.filter(p=>p.name.toLocaleLowerCase().includes(search)),pages=Math.max(1,Math.ceil(filtered.length/100));page=Math.min(page,pages-1)
 const table=document.createElement('table');table.innerHTML=`<thead><tr><th scope="col">Rank</th><th scope="col">Player</th>${rated?'<th scope="col">Rated games</th>':''}<th scope="col">${config.label}</th></tr></thead><tbody></tbody>`
 for(const p of filtered.slice(page*100,(page+1)*100)){
  const row=document.createElement('tr');row.classList.toggle('self',p.name===name);row.innerHTML=`<td></td><td><a class="rank-player player-profile-link" href="${profileHref(p.name)}"><span class="small-avatar">${framedAvatar(p.avatar,p.frame)}</span><strong></strong></a></td>${rated?'<td></td>':''}<td></td>`
  row.cells[0].textContent=String(p.rank);row.querySelector('strong')!.textContent=p.name;if(rated)row.cells[2].textContent=String(p.games);row.cells[rated?3:2].textContent=rankingValue(p,mode);table.tBodies[0].append(row)
 }
 el('full-ranking-table').replaceChildren(table);if(!filtered.length){const empty=document.createElement('p');empty.className='card-empty';empty.textContent='No players match your search.';el('full-ranking-table').append(empty)}
 el('leaderboard-count').textContent=`${filtered.length} ${filtered.length===1?'player':'players'}${search?' found':''} · ${rows.length} total`
 el('ranking-page').textContent=`Page ${page+1} of ${pages}`;el<HTMLButtonElement>('ranking-prev').disabled=page===0;el<HTMLButtonElement>('ranking-next').disabled=page>=pages-1
}
async function init(){await initShell();const session=await getSession();if(!session.user){location.replace('/chess/login.html');return}name=session.user;const data=await api<RankingPage>(config.path+'/full');rows=data.players;el('leaderboard-self').textContent=`${config.summary}: ${rankingValue(data.me,mode)}${data.me.rank?` · #${data.me.rank}`:''}`;render();el('leaderboard-search').oninput=()=>{page=0;render()};el('ranking-prev').onclick=()=>{page--;render()};el('ranking-next').onclick=()=>{page++;render()}}
void init().catch(cause=>{el('leaderboard-error').textContent=cause instanceof Error?cause.message:'Could not load leaderboard';el('leaderboard-error').hidden=false})
