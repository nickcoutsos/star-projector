import {Object3D} from 'three';
import {travel} from './topology';
import {getGeometryNet} from './nets';

export function constructHierarchicalMesh(topology) {
  let tree = travel(
    topology.polygons[0].edges[0],
    getGeometryNet(topology)
  );

  return (function build(tree, parent=null) {
    let node = tree.node,
      pivotAxis = node.edge.vector,
      pivotNode = new Object3D(),
      polyNode = new Object3D();


    pivotNode.position.add(node.edge.point);
    if (parent) {
      pivotNode.position.sub(parent.edge.point);
      pivotNode.rotateOnAxis(pivotAxis, topology.dihedral);
      pivotNode.userData.animate = t => {
        // rotations of 0 radians seem to cause sorting issues in the renderer
        let angle = Math.max(0.0001, t * topology.dihedral);
        pivotNode.rotation.set(0, 0, 0);
        pivotNode.rotateOnAxis(pivotAxis, angle);
      };
    }

    polyNode.name = `polygon-${node.poly.index}`;
    polyNode.position.sub(node.edge.point);
    polyNode.userData.node = node;
    polyNode.userData.parent = parent;
    polyNode.userData.children = tree.children;

    return pivotNode.add(
      polyNode,
      ...tree.children.slice(0)
        .map(child => build(child, node))
    );
  })(tree);
}
