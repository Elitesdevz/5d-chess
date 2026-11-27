import {GROCERIES} from './food.ts'
import type {STOREFRONTS} from './storefronts.ts'
import type {WorldView} from './model.ts'
import {safeText,coins} from './services.ts'

type Front=typeof STOREFRONTS[number]
const lessons=[
  ['First moves','Start with pawns and learn to submit a plan.',1],
  ['Beyond the board','Move through time and across universes.',16],
  ['The complete plan','Coordinate orders on multiple boards.',26],
] as const
export function streetCounter(dialog:HTMLDialogElement,front:Front,v:WorldView,receipt:string,
  order:(op:string,item?:string)=>Promise<void>,travel:(to:string)=>Promise<void>){
  const host=dialog.querySelector<HTMLElement>('.world-dialog-body')!
  const link=(url:string,title:string,detail:string)=>`<a class="street-row" href="${url}"><span><strong>${title}</strong><small>${detail}</small></span><b aria-hidden="true">↗</b></a>`
  let body=''
  for(const id of front.stock??[]){
    const item=GROCERIES.find(g=>g.id===id)!,count=v.arcade?.slots.reduce((n,s)=>n+(s?.item===id?s.count:0),0)??0
    body+=`<div class="street-row"><span><strong>${item.name}</strong><small>${count} carried</small></span><button data-order="${id}" ${v.coins<item.price?'disabled':''}>Buy · ${coins(item.price)}</button></div>`
  }
  if(front.care){
    const {cost,hp}=front.care,health=v.arcade?.hp??100
    body=`<div class="street-row"><span><strong>${health} / 100 HP</strong><small>Restore up to ${hp} HP</small></span><button data-order="care" ${health===100||v.coins<cost?'disabled':''}>${cost?'Treat · '+coins(cost):'First aid · Free'}</button></div>`
  }
  if(front.id==='station')body=[['city','Meridian Square'],['casino','Royal Hotel'],['bank','Bank Steps'],['stocks','Exchange Tower'],['kfc','Restaurant Row']].map(([id,name])=>`<button class="street-row" data-travel="${id}"><strong>${name}</strong><span>Travel →</span></button>`).join('')
  if(front.id==='barber')body=link('/chess/profile.html#dressing-mirror','Personal dressing mirror','Choose an owned avatar and frame on your player card.')
  if(front.id==='school')body=lessons.map(([title,detail,id])=>link('/chess/puzzles.html?lesson='+id,title,detail)).join('')
  host.innerHTML=`<header class="world-service-head"><div><span>${front.stock?'TAKEAWAY':front.care?'WALK-IN CARE':front.id==='station'?'DEPARTURES':'MERIDIAN CITY'}</span><h2 id="world-dialog-title">${front.name}</h2></div><form method="dialog"><button aria-label="Close">×</button></form></header><section class="street-counter">${body}</section><p role="status">${receipt}</p>`
  if(!dialog.open)dialog.showModal()
  if(front.id==='books'){
    const shelf=host.querySelector<HTMLElement>('.street-counter')!
    void import('../puzzle-model.ts').then(({PUZZLES,PUZZLE_CHAPTERS})=>{
      if(!shelf.isConnected)return
      shelf.innerHTML=PUZZLE_CHAPTERS.map((name,i)=>{
        const reading=PUZZLES[i*5]
        return `<details class="street-reading"><summary>${safeText(name)}</summary><h3>${safeText(reading.title)}</h3>${reading.lesson.map(p=>'<p>'+safeText(p)+'</p>').join('')}${link('/chess/puzzles.html?lesson='+reading.id,'Play this position',reading.objective)}</details>`
      }).join('')
    }).catch(()=>{shelf.innerHTML=link('/chess/puzzles.html','Open the puzzle library','Browse all thirty lessons.')})
  }
  host.querySelectorAll<HTMLButtonElement>('[data-order],[data-travel]').forEach(b=>b.onclick=async()=>{
    b.disabled=true
    try{
      if(b.dataset.travel){await travel(b.dataset.travel);return}
      const id=b.dataset.order!
      await order(id==='care'?'treatment':'groceries',id)
    }catch(error){host.querySelector('[role=status]')!.textContent=error instanceof Error?error.message:'Counter unavailable';b.disabled=false}
  })
}
