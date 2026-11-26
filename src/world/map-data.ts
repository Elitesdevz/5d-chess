import data from '../../.meridian/shared.json' with {type:'json'}
import type {compile} from '../../world/meridian/compile.ts'
export const shared=data as unknown as ReturnType<typeof compile>['shared']
