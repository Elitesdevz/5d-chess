import data from '../../.meridian/visual.json' with {type:'json'}
import type {compile} from '../../world/meridian/compile.ts'
export const visual=data as unknown as ReturnType<typeof compile>['visual']
