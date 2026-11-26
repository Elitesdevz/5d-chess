import release from '../../.meridian/manifest.json' with {type:'json'}
export const mapVersion=release.version
const base='/chess/maps/meridian/'
const update='Meridian is updating. Retry when the city and its map are on the same version.'
let manifest:Promise<typeof release>|undefined
async function current(){
  const response=await fetch(base+'manifest.json',{cache:'no-cache'})
  if(!response.ok)throw Error(update)
  const data=await response.json() as typeof release
  if(data.schema!==release.schema||data.version!==mapVersion||data.area!==release.area)throw Error(update)
  return data
}
export async function loadSection(key:keyof typeof release.sections){
  const data=await (manifest??=current()),entry=release.sections[key]
  if(data.sections[key]?.sha256!==entry.sha256)throw Error(update)
  const response=await fetch(base+entry.file)
  if(!response.ok)throw Error(update)
  const bytes=await response.arrayBuffer()
  if(bytes.byteLength!==entry.bytes)throw Error(update)
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))
  if(Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('')!==entry.sha256)throw Error(update)
  return JSON.parse(new TextDecoder().decode(bytes))
}
