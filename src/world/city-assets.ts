import * as T from 'three'

const BATCH_SIZE=48
const WARM_DISTANCE=105

/** Upload nearby static assets in short batches before they can interrupt a turn. */
export class CityAssets {
  private meshes:T.Mesh[]=[]
  private textures:T.Texture[]=[]
  private meshCursor=0
  private textureCursor=0
  private shadersReady=false
  private shaderFailure=false
  private scratch=new T.Scene()
  private camera=new T.Camera()
  private target=new T.WebGLRenderTarget(1,1)
  private placeholder=new T.BufferGeometry()
  private preparationMaterial=new T.MeshBasicMaterial({colorWrite:false,depthWrite:false})
  private plain=Array.from({length:BATCH_SIZE},()=>new T.Mesh(this.placeholder,this.preparationMaterial))
  private instanced=Array.from({length:BATCH_SIZE},()=>new T.InstancedMesh(this.placeholder,this.preparationMaterial,0))
  private renderer:T.WebGLRenderer

  constructor(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera){
    this.renderer=renderer
    const textures=new Set<T.Texture>(),geometries=new Set<T.BufferGeometry>(),center=new T.Vector3()
    if(scene.background instanceof T.Texture)textures.add(scene.background)
    scene.updateMatrixWorld(true)
    scene.traverseVisible(object=>{
      if(!(object instanceof T.Mesh))return
      const bounds=(object instanceof T.InstancedMesh?object.boundingSphere:object.geometry.boundingSphere)
      if(bounds)center.copy(bounds.center).applyMatrix4(object.matrixWorld)
      else center.setFromMatrixPosition(object.matrixWorld)
      if(center.distanceToSquared(camera.position)>WARM_DISTANCE**2)return
      if(!geometries.has(object.geometry)||object instanceof T.InstancedMesh){
        geometries.add(object.geometry)
        this.meshes.push(object)
      }
      for(const material of Array.isArray(object.material)?object.material:[object.material]){
        for(const value of Object.values(material))if(value instanceof T.Texture)textures.add(value)
      }
    })
    this.textures=[...textures]
    for(const probe of [...this.plain,...this.instanced])probe.frustumCulled=false
    void renderer.compileAsync(scene,camera).then(()=>{this.shadersReady=true},()=>{this.shaderFailure=true})
  }

  step(){
    if(this.shaderFailure)throw new Error('City shaders could not load.')
    const renderer=this.renderer,deadline=performance.now()+4
    // Cap each batch as well as its CPU budget so GLES uploads stay bounded
    // even when the driver queues transfers quickly on the caller thread.
    let texturesUploaded=0
    while(this.textureCursor<this.textures.length&&texturesUploaded<6&&performance.now()<deadline){
      renderer.initTexture(this.textures[this.textureCursor++]);texturesUploaded++
    }
    const ranges=new Map<T.BufferGeometry,number>()
    let count=0
    while(this.meshCursor<this.meshes.length&&count<BATCH_SIZE){
      const source=this.meshes[this.meshCursor++]
      const probe=source instanceof T.InstancedMesh?this.instanced[count]:this.plain[count]
      probe.geometry=source.geometry
      if(!ranges.has(source.geometry)){
        ranges.set(source.geometry,source.geometry.drawRange.count)
        source.geometry.drawRange.count=0
      }
      if(probe instanceof T.InstancedMesh&&source instanceof T.InstancedMesh){
        probe.instanceMatrix=source.instanceMatrix
        probe.instanceColor=source.instanceColor
      }
      this.scratch.add(probe)
      count++
    }
    if(count){
      // A zero-sized draw binds the real index and vertex buffers without
      // drawing the model. Restore all ranges before rendering the live scene.
      const target=renderer.getRenderTarget(),sorting=renderer.sortObjects
      try{
        renderer.setRenderTarget(this.target)
        renderer.sortObjects=false
        renderer.render(this.scratch,this.camera)
      }finally{
        renderer.sortObjects=sorting
        renderer.setRenderTarget(target)
        this.scratch.clear()
        for(const [geometry,count] of ranges)geometry.drawRange.count=count
      }
    }
    return this.shadersReady&&this.meshCursor===this.meshes.length&&this.textureCursor===this.textures.length
  }

  dispose(){
    this.target.dispose()
    this.placeholder.dispose()
    this.preparationMaterial.dispose()
  }
}
