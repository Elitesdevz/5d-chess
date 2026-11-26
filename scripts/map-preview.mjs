// A self-contained map proof. Browser zoom works directly on the SVG on disk.
export function preview({shared:m,visual}){
  const safe=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
  const svg=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="-85 -99 171 153" width="1539" height="1377" style="background:#d5dfc6;font:1.1px sans-serif"><title>Meridian frontage and walking map</title>']
  function rect(x,z,w,d,color){svg.push(`<rect x="${x}" y="${z}" width="${w}" height="${d}" fill="${color}"/>`)}
  function label(p,name){svg.push(`<text x="${p.x}" y="${p.z}" text-anchor="middle" fill="#182d36" stroke="#f9f5e9" stroke-width=".24" paint-order="stroke">${safe(name)}</text>`)}
  for(const park of m.parks)rect(park.x-park.w/2,park.z-park.d/2,park.w,park.d,'#a6c49b')
  rect(m.pond.x-m.pond.w/2,m.pond.z-m.pond.d/2,m.pond.w,m.pond.d,'#76a9ac')
  for(const off of [-1,1]){
    const line=Array.from({length:43},(_,i)=>{const x=-84+i*4;return x+','+(m.rail.z-4.8*Math.min(1,Math.max(0,(Math.abs(x)-32)/105))**2+off)})
    svg.push(`<polyline points="${line.join(' ')}" fill="none" stroke="#788188" stroke-width=".27"/>`)
  }
  svg.push(`<circle cx="${m.circle.x}" cy="${m.circle.z}" r="${m.circle.radius}" fill="none" stroke="#687879" stroke-width="${m.circle.width}"/>`)
  for(const [x,z,r,b,l] of visual.surfaces)rect(x,z,r-x,b-z,['','#c1b9ac','#e6dbc4','#818886','#687879'][l])
  for(const p of m.paths)svg.push(`<polyline points="${p.points.map(v=>v.x+','+v.z).join(' ')}" fill="none" stroke="${p.purpose==='drive'?'#b5aba0':'#ebdaba'}" stroke-width="${p.width}"/>`)
  for(const t of visual.inlays)svg.push(`<rect x="${-t.w/2}" y="${-t.d/2}" width="${t.w}" height="${t.d}" fill="#${t.color.toString(16)}" transform="translate(${t.x} ${t.z}) rotate(${-t.yaw*180/Math.PI})"/>`)
  for(const c of m.crossings)for(let k=-c.width/2+.25;k<c.width/2;k+=.55){
    if(c.axis==='z')rect(c.x-.76,c.z+k,1.52,.21,'#f6ebd5')
    else rect(c.x+k,c.z-.76,.21,1.52,'#f6ebd5')
  }
  for(const lot of m.lots)rect(lot.x-lot.w/2,lot.z-lot.d/2,lot.w,lot.d,/^(block-|house-)/.test(lot.id)?'#ac9481':'#9bb4bb')
  for(const p of m.directory)rect(p.x-.42,p.z-.42,.84,.84,'#226762')
  for(const p of m.props)svg.push(`<circle cx="${p.x}" cy="${p.z}" r="${Math.max(.28,p.radius*.75)}" fill="${p.kind==='tree'?'#508a53':p.kind==='lamp'?'#b87a23':'#795543'}"><title>${safe(p.id)}</title></circle>`)
  for(const e of m.entrances)svg.push(`<circle cx="${e.x}" cy="${e.z}" r=".37" fill="#a2372c"><title>${safe(e.id)} entrance</title></circle>`)
  for(const s of m.streets)label({x:(s.a.x+s.b.x)/2,z:(s.a.z+s.b.z)/2},s.name)
  for(const l of [...m.parks,...m.landmarks])label(l,l.name)
  label(m.civic.origins.gunshop,'Arcade Armory')
  for(const id of ['hotel','casino','bank','exchange','kfc'])label(m.rooms[id],id.toUpperCase())
  label({x:0,z:-94},'MERIDIAN  ·  N ↑  ·  Doors in red   /   Lamps in gold')
  return svg.join('\n')+'\n</svg>\n'
}
