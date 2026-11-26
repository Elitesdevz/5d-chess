void import('./client.ts').catch(()=>{
  const notice=document.getElementById('world-unavailable')!
  document.getElementById('city-world')!.dataset.unavailable='true'
  notice.querySelector('p')!.textContent='Meridian could not load its map. Retry to load the current version.'
  notice.hidden=false
})
