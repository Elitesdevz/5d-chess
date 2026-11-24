import * as T from 'three'

const pointLightsStart='#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )'
const spotLightsStart='#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )'

function installLightRangeCheck(){
  const chunk=T.ShaderChunk.lights_fragment_begin
  if(chunk.includes('cityPointEnd'))return true
  const start=chunk.indexOf(pointLightsStart),end=chunk.indexOf(spotLightsStart,start)
  if(start<0||end<0)return false
  T.ShaderChunk.lights_fragment_begin=chunk.slice(0,start)+`
#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
`+chunk.slice(start,end)+`
#elif ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
  // A zero-intensity record carries the length of the visible light list.
  // Ordinary light arrays have positive decay and use their full length.
  bool cityLightList = pointLights[ 0 ].decay < 0.0;
  int cityPointEnd = cityLightList ? clamp( int( -pointLights[ 0 ].decay ), 1, NUM_POINT_LIGHTS ) : NUM_POINT_LIGHTS;
  for ( int cityPoint = cityLightList ? 1 : 0; cityPoint < cityPointEnd; cityPoint++ ) {
    PointLight cityLight = pointLights[ cityPoint ];
    vec3 offset = cityLight.position - geometryPosition;
    if ( cityLight.color != vec3( 0.0 ) &&
         ( cityLight.distance <= 0.0 || dot( offset, offset ) < cityLight.distance * cityLight.distance ) ) {
      getPointLightInfo( cityLight, geometryPosition, directLight );
      RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
    }
  }
#endif

`+chunk.slice(end)
  return true
}

type CityLight={bounds:T.Sphere;color:T.Color;intensity:number;distance:number;decay:number;parent:T.Object3D|null}

export class CityLighting {
  private view=new T.Frustum()
  private projection=new T.Matrix4()
  private sources:CityLight[]=[]
  private slots:T.PointLight[]=[]
  private lengthRecord?:T.PointLight

  constructor(scene:T.Scene){
    scene.updateMatrixWorld(true)
    const lights:T.PointLight[]=[]
    scene.traverse(node=>{if(node instanceof T.PointLight)lights.push(node)})
    // Keep the renderer's normal lighting path for shadow-casting or dynamic
    // lighting rigs. The city currently has only static finite point lights.
    if(!lights.length||lights.some(light=>light.castShadow||light.distance<=0)||!installLightRangeCheck())return
    for(const light of lights){
      this.sources.push({
        bounds:new T.Sphere(light.getWorldPosition(new T.Vector3()),light.distance+.5),
        color:light.color.clone(),intensity:light.intensity,distance:light.distance,decay:light.decay,parent:light.parent,
      })
      this.slots.push(light)
      light.removeFromParent()
    }
    this.lengthRecord=new T.PointLight(0,0,1,-1)
    scene.add(this.lengthRecord,...this.slots)
  }

  update(camera:T.Camera){
    if(!this.lengthRecord)return
    this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)
    this.view.setFromProjectionMatrix(this.projection)
    let count=0
    for(const source of this.sources){
      let visible=this.view.intersectsSphere(source.bounds)
      for(let room=source.parent;visible&&room;room=room.parent)visible=room.visible
      if(!visible)continue
      const slot=this.slots[count++]
      slot.position.copy(source.bounds.center)
      slot.color.copy(source.color)
      slot.intensity=source.intensity
      slot.distance=source.distance
      slot.decay=source.decay
    }
    this.lengthRecord.decay=-(count+1)
  }
}
