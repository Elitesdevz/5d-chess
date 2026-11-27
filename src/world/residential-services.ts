import {GROCERIES} from './food.ts'
import type {FoodView} from './food.ts'
import {residentialAt} from './residential.ts'
import {UNITS,RESIDENCES} from './housing.ts'
import type {WorldView} from './model.ts'
import type {DIRECTORY} from './urban-layout.ts'
import {CityServices,coins,date,safeText} from './services.ts'

export class ResidentialServices extends CityServices {
  directory(marker:(typeof DIRECTORY)[number]){
    const rows=marker.nearby.map(p=>'<li>'+safeText(p.name)+' · '+p.direction+' · '+p.metres+' m</li>').join('')
    this.render('YOU ARE HERE',marker.title,'<p>'+safeText(marker.street)+'</p><ul>'+rows+'</ul>')
    if(!this.dialog.open)this.dialog.showModal()
  }
  property(point:string,view:WorldView,acquire:(id:string)=>Promise<void>){
    const key=point.slice(9),block=key.startsWith('desk-')?Number(key.slice(5)):undefined
    const registry=key==='registry'
    const list=UNITS.filter(u=>registry?u.tenure!=='resident':block===undefined?u.id===key:u.block===block)
    this.render('CITY HOUSING',registry?'City housing register':block===undefined?'House listing':RESIDENCES[block].name,(registry?'<input class="world-floor-search" type="search" aria-label="Filter addresses" placeholder="Find a street or building">':'')+list.map(u=>{
      const mine=view.housing?.keys.includes(u.id),occupied=view.housing?.occupied.includes(u.id)||u.tenure==='resident'
      const expiry=view.housing?.expires[u.id]
      const status=mine?(expiry?'Your lease ends '+date.format(expiry):'You own this home'):occupied?'Occupied':u.tenure==='rent'?'Seven-day lease':'For sale'
      return `<section class="world-ballot"><h3>${u.name}</h3><p>${u.block===undefined?'House':'Floor '+u.floor} · ${u.bedrooms} ${u.bedrooms===1?'bedroom':'bedrooms'} · ${u.layout}</p><p>${status}${occupied&&!mine&&u.tenure!=='resident'?' · '+coins(u.price):''}</p>${mine||occupied?'':`<button class="world-primary" data-home="${u.id}">${u.tenure==='rent'?'Rent':'Buy'} · ${coins(u.price)}</button>`}</section>`
    }).join(''))
    if(!this.dialog.open)this.dialog.showModal()
    const search=this.host.querySelector<HTMLInputElement>('input[type=search]')
    if(search)search.oninput=()=>this.host.querySelectorAll<HTMLElement>('.world-ballot').forEach(row=>row.hidden=!row.textContent?.toLowerCase().includes(search.value.trim().toLowerCase()))
    this.host.querySelectorAll<HTMLButtonElement>('[data-home]').forEach(b=>b.onclick=async()=>{
      b.disabled=true
      try{await acquire(b.dataset.home!)}catch(error){this.message(error instanceof Error?error.message:'Unavailable');b.disabled=false}
    })
  }
  residentialLift(zone:string,travel:(level:number)=>Promise<void>){
    const spot=residentialAt(zone)
    if(!spot||spot.building.block===undefined)return
    this.render(RESIDENCES[spot.building.block].name,'Elevator',`<div class="world-button-row residential-bank">${spot.building.levels.map((_,i)=>`<button type="button" data-home-floor="${i}" ${i===spot.level?'disabled aria-current="location"':''}>${i||'G'}</button>`).join('')}</div>`)
    if(!this.dialog.open)this.dialog.showModal()
    this.host.querySelectorAll<HTMLButtonElement>('[data-home-floor]').forEach(button=>button.onclick=async()=>{
      button.disabled=true
      try{await travel(Number(button.dataset.homeFloor))}catch(error){button.disabled=false;this.message(error instanceof Error?error.message:'Elevator unavailable')}
    })
  }
  food(food:FoodView,send:(data:object)=>Promise<void>){
    const renderItems=(storage:boolean)=>GROCERIES.map(item=>{
      const quantity=(storage?food.stored!:food.personal)[item.id]??0
      const transfer=storage?'take':'store',label=storage?'Take':'Store'
      const submit=(op:string,title:string,all=false)=>`<button type="submit" value="${op}" data-all="${all}" ${all||op==='eat'?'formnovalidate':''} ${quantity?'':'disabled'}>${title}</button>`
      return `<form class="world-ballot residential-food" data-food-item="${item.id}"><h3>${item.name} <small>×${quantity}</small></h3><div class="world-button-row">${food.stored?`<input type="number" aria-label="Quantity" name="quantity" min="1" max="${Math.max(1,quantity)}" value="1">${submit(transfer,label)}${submit(transfer,label+' all',true)}`:''}</div></form>`
    }).join('')
    this.render('FOOD',food.stored?'Refrigerator':'Food inventory',`<div class="residential-food-columns"><section><h3>Your food inventory</h3>${renderItems(false)}</section>${food.stored?`<section><h3>Stored here</h3>${renderItems(true)}</section>`:''}</div>`)
    if(!this.dialog.open)this.dialog.showModal()
    this.host.querySelectorAll<HTMLFormElement>('[data-food-item]').forEach(form=>form.onsubmit=async event=>{
      event.preventDefault()
      const button=event.submitter as HTMLButtonElement
      button.disabled=true
      try{await send({id:crypto.randomUUID(),item:form.dataset.foodItem,operation:button.value,
        amount:button.dataset.all==='true'?'all':button.value==='eat'?1:Number(new FormData(form).get('quantity'))})}
      catch(error){button.disabled=false;this.message(error instanceof Error?error.message:'Food unavailable')}
    })
  }
}
