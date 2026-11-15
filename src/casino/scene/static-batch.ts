import * as T from 'three'
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js'
/** Merge only explicitly static direct children; jointed hands and eyes stay independent. */
export function batchStatic(parent:T.Object3D,exclude:ReadonlySet<T.Object3D>=new Set()){
 const groups=new Map<T.Material,T.Mesh[]>()
 for(const child of [...parent.children])if(child instanceof T.Mesh&&!Array.isArray(child.material)&&!exclude.has(child)){const group=groups.get(child.material)??[];group.push(child);groups.set(child.material,group)}
 for(const [material,meshes] of groups){if(meshes.length<3)continue
  const geometries=meshes.map(m=>{m.updateMatrix();const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);return g})
  const merged=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(!merged)continue
  meshes.forEach(m=>{parent.remove(m);m.geometry.dispose()});parent.add(new T.Mesh(merged,material))
 }
}
