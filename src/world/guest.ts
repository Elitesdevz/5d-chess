import {ClubGuest} from '../casino/roulette-cast.ts'
import {batchOpaque} from '../casino/scene/static-batch.ts'

/** City staff always keep the default finger curl as their arms move. */
export class CityGuest extends ClubGuest {
  constructor(...args:ConstructorParameters<typeof ClubGuest>){
    super(...args)
    for(const hand of [this.left.hand,this.right.hand]){
      hand.pose(ClubGuest.idleCurl)
      batchOpaque(hand.root)
    }
  }
  override pose(now:number,lean=0){
    super.pose(now,lean)
  }
}
