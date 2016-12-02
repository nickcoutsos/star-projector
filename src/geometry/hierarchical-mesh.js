import {Object3D, Vector3} from 'three';
import {travel} from './topology';
import {getGeometryNet} from './nets';

export function constructHierarchicalMesh(topology) {
  let tree = travel(
    topology.polygons[0].edges[0],
    getGeometryNet(topology)
  );

  return (function build(tree, parent=null) {
    let node = tree.node,
      object = new Object3D(),
      offset = new Object3D(),
      pivot = node.edge.vector;

    object.rotateOnAxis(pivot, topology.dihedral);
    object.userData.pivot = pivot;
    object.userData.animate = t => {
			let alpha = 0.5 * (Math.sin(-Math.PI / 2 + t / 1000) + 1);
			let angle = alpha * topology.dihedral;
			object.rotation.set(0, 0, 0);
			object.rotateOnAxis(pivot, angle);
		};
    object.position
      .sub(parent ? parent.edge.point : new Vector3())
      .add(node.edge.point);

    offset.name = `polygon-${node.poly.index}`;
    offset.position.sub(node.edge.point);
    offset.userData.node = node;
    offset.userData.parent = parent;
    offset.userData.children = tree.children;

    return object.add(
      offset,
      ...tree.children.slice(0)
        .map(child => build(child, node))
    );
  })(tree);
}
