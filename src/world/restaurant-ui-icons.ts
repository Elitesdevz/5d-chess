export function foodSymbol(name:string){
  const kind=name==='flip'?'burger':name==='pack'?'chicken':name==='mop'||name==='wipe'?'clean':name
  return `<span class="kfc-food kfc-food-${kind}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`
}
