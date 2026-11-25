import * as T from 'three'
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js'
import {clone} from 'three/addons/utils/SkeletonUtils.js'
import {WEAPONS,type WeaponId} from './arcade.ts'
import type {HomePose} from './residential.ts'

const files=new Map<string,Promise<GLTF>>()
function asset(name:string){
  let file=files.get(name)
  if(!file){
    file=new GLTFLoader().loadAsync('/chess/overrun/'+name+'.glb')
    files.set(name,file)
    file.catch(()=>files.delete(name))
  }
  return file
}

export class HeldModel extends T.Group {
  private weaponId?:WeaponId
  constructor(private gloves=false){super()}
  setWeapon(id?:WeaponId){
    if(id===this.weaponId)return
    this.weaponId=id;this.clear()
    if(id)void asset(WEAPONS[id].model).then(({scene})=>{
      if(this.weaponId!==id)return
      const model=scene.clone()
      model.traverse(o=>{if(o.name.startsWith('Gloves'))o.visible=this.gloves})
      this.add(model)
    }).catch(()=>{})
  }
}

// Each player needs an independent skeleton and mixer. Textures and geometry stay shared.
export class OverrunPlayer {
  root=new T.Group()
  private mixer:T.AnimationMixer
  private clips:T.AnimationAction[]
  private held=new HeldModel()
  private bones=new Map<string,T.Bone>()
  private pivot=new T.Group()
  private point=new T.Vector3()
  private direction=new T.Vector3()
  private rotation=new T.Quaternion()
  private delta=new T.Quaternion()
  private parentRotation=new T.Quaternion()
  static async load(seed:number){
    return new OverrunPlayer(await asset(seed%2?'ely':'trooper'))
  }
  private constructor(gltf:GLTF){
    const model=clone(gltf.scene)
    model.traverse(n=>{if(n instanceof T.Bone)this.bones.set(n.name.replace(/^mixamorig\d*[:_]?/i,''),n)})
    this.mixer=new T.AnimationMixer(model)
    this.clips=['idle','walk','run'].map((name,i)=>{
      const clip=T.AnimationClip.findByName(gltf.animations,name)!
      return this.mixer.clipAction(clip).setEffectiveWeight(i===0?1:0).play()
    })
    this.mixer.update(0)
    model.updateMatrixWorld(true)
    const bounds=new T.Box3().setFromObject(model,true),scale=1.77/(bounds.max.y-bounds.min.y)
    const foot=this.bones.get('LeftFoot')!,toe=this.bones.get('LeftToeBase')!
    toe.getWorldPosition(this.direction).sub(foot.getWorldPosition(this.point))
    const heading=Math.atan2(this.direction.x,this.direction.z)
    model.rotation.y=Math.round((Math.PI-heading)/(Math.PI/2))*Math.PI/2
    model.scale.multiplyScalar(scale);model.position.y-=bounds.min.y*scale
    this.pivot.add(model,this.held);this.root.add(this.pivot)
  }
  // Rotate a joint toward a direction in the player's frame, independent of the skin's bind axes.
  private pointBone(name:string,childName:string,x:number,y:number,z:number){
    const bone=this.bones.get(name),child=this.bones.get(childName)
    if(!bone||!child)return
    const from=child.getWorldPosition(this.direction).sub(bone.getWorldPosition(this.point)).normalize()
    const toward=this.point.set(x,y,z).normalize().applyQuaternion(this.root.getWorldQuaternion(this.rotation))
    const delta=this.delta.setFromUnitVectors(from,toward)
    const parent=bone.parent!.getWorldQuaternion(this.rotation)
    bone.quaternion.premultiply(this.parentRotation.copy(parent).invert().multiply(delta).multiply(parent))
  }
  pose(dt:number,speed:number,seated:boolean,home:HomePose|undefined,work:boolean,eating:boolean,id?:WeaponId){
    const rest=home?.kind==='rest',moving=!home&&!seated&&speed>.16
    const target=moving?(speed>5.3?2:1):0
    for(const [i,a] of this.clips.entries())a.setEffectiveWeight(T.MathUtils.damp(a.getEffectiveWeight(),i===target?1:0,14,dt))
    this.mixer.update(dt)
    this.root.rotation.x=rest?-Math.PI/2:0
    this.root.position.set(0,rest?home.height+.12:home?home.height-.86:seated?-.19:0,rest?.85:0)
    const bent=seated||home?.kind==='sit'
    if(bent)for(const side of ['Left','Right']){
      this.pointBone(side+'UpLeg',side+'Leg',0,-.12,-1)
      this.pointBone(side+'Leg',side+'Foot',0,-1,.08)
    }
    if(!id)for(const [side,sign] of [['Left',-1],['Right',1]] as const){
      this.pointBone(side+'Arm',side+'ForeArm',sign*.15,-1,work?-.7:-.08)
      this.pointBone(side+'ForeArm',side+'Hand',0,eating&&side==='Right'?.35:-.85,work||eating||bent?-.85:-.2)
    }
    this.held.setWeapon(rest||work||seated?undefined:id)
    if(id){
      const hand=this.bones.get('RightHand')!
      hand.getWorldPosition(this.point);this.held.position.copy(this.pivot.worldToLocal(this.point))
    }
  }
  dispose(){
    this.held.setWeapon(undefined);this.mixer.stopAllAction()
    this.root.traverse(o=>{if(o instanceof T.SkinnedMesh)o.skeleton.dispose()})
    this.root.removeFromParent()
  }
}
