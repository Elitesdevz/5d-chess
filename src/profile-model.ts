import type {Kind,Player} from './model.ts'
import type {Profile} from './account-model.ts'
export const BIO_LIMIT=280
export interface ShowcaseSkin{itemId:string;kind:Kind;color:Player}
export interface PublicIdentity{bio:string;showcase:ShowcaseSkin[];revision:number}
export interface PlayerCard{name:string;avatar:string;frame?:string;rating:number;games:number;rank:number;bio:string;showcase:ShowcaseSkin[];owner:boolean;record:{played:number;wins:number;draws:number;losses:number}}
export interface ProfileEditor extends PublicIdentity{avatar:string;frame:string;icons:string[];frames:string[];skins:{itemId:string;kinds:Kind[]}[]}
export interface HistoryEntry{id:string;created:number;kind:'match'|'dice'|'roulette'|'anomaly';title:string;status:string;delta:number;unit:'elo'|'coins';opponents?:string[];movement?:string;players?:number;href?:string;rated?:boolean;ai?:string}
export interface HistoryPage{items:HistoryEntry[];next:string|null}
export interface ProfileSave{card:PlayerCard;profile:Profile}
export const profileHref=(name:string)=>'/chess/profile.html?user='+encodeURIComponent(name)
