import {mkdir,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {compile} from '../world/meridian/compile.ts'
import {preview} from './map-preview.mjs'
import {meridian} from '../world/meridian/source.ts'
const output='.meridian', area=meridian.area, schema=1
const hash=value=>createHash('sha256').update(value).digest('hex')
await mkdir(output,{recursive:true})
const compiled=compile(),sections={}
for(const [key,value] of Object.entries(compiled)){
  const bytes=Buffer.from(JSON.stringify(value)),sha256=hash(bytes)
  sections[key]={file:key+'-'+sha256+'.json',bytes:bytes.length,sha256}
  await writeFile(output+'/'+key+'.json',bytes)
}
const version=hash(JSON.stringify({schema,area,sections}))
await writeFile(output+'/manifest.json',JSON.stringify({schema,area,version,sections}))
await writeFile(output+'/preview.svg',preview(compiled))
console.log('Compiled Meridian '+version.slice(0,12)+' · '+Object.values(sections).map(s=>s.bytes+' B').join(' + '))
