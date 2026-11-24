import * as T from 'three'
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js'
/** Merge only explicitly static direct children; jointed hands and eyes stay independent. */
export function batchStatic(parent:T.Object3D,exclude:ReadonlySet<T.Object3D>=new Set()){
 const groups=new Map<T.Material,T.Mesh[]>()
 for(const child of [...parent.children])if(child instanceof T.Mesh&&!(child instanceof T.InstancedMesh)&&!Array.isArray(child.material)&&!exclude.has(child)){const group=groups.get(child.material)??[];group.push(child);groups.set(child.material,group)}
 for(const [material,meshes] of groups){if(meshes.length<3)continue
  const geometries=meshes.map(m=>{m.updateMatrix();const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);return g})
  const merged=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(!merged)continue
  meshes.forEach(m=>{parent.remove(m);m.geometry.dispose()});parent.add(new T.Mesh(merged,material))
 }
}

/** Assemble opaque scenery in the supplied static group. Glass, which
 * Three.js depth-sorts individually, keeps its original scene nodes. */
export function batchOpaque(section:T.Object3D,keep:ReadonlySet<T.Object3D>=new Set()){
  section.updateWorldMatrix(true,true)
  const origin=section.matrixWorld.clone().invert(),transform=new T.Matrix4()
  const groups=new Map<string,T.Mesh[]>()
  function visit(object:T.Object3D){
    if(keep.has(object)||!object.visible)return
    if(object instanceof T.Mesh&&!(object instanceof T.InstancedMesh)&&!Array.isArray(object.material)){
      object.matrixAutoUpdate=false
      const {material,geometry}=object
      const unmirrored=transform.multiplyMatrices(origin,object.matrixWorld).determinant()>0
      if(!material.transparent&&object.frustumCulled&&unmirrored&&object.renderOrder===0&&geometry.drawRange.start===0&&geometry.drawRange.count===Infinity){
        const attributes=Object.keys(geometry.attributes).sort().join(',')
        const key=[material.id,!!geometry.index,attributes,object.castShadow,object.receiveShadow,object.layers.mask].join('/')
        const group=groups.get(key)??[]
        group.push(object);groups.set(key,group)
      }
    }
    for(const child of object.children)visit(child)
  }
  visit(section)
  for(const group of groups.values()){
    if(group.length<3)continue
    const geometries=group.map(object=>object.geometry.clone().applyMatrix4(transform.multiplyMatrices(origin,object.matrixWorld)))
    const merged=mergeGeometries(geometries)
    for(const geometry of geometries)geometry.dispose()
    if(!merged)continue
    const first=group[0]
    const batch=new T.Mesh(merged,first.material)
    batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow
    batch.layers.mask=first.layers.mask;batch.matrixAutoUpdate=false
    merged.computeBoundingSphere()
    // This runs before the first draw. The renderer has never uploaded the
    // old geometry and other assemblies may still share it.
    for(const mesh of group)mesh.removeFromParent()
    section.add(batch)
  }
}
