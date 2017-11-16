/** @jsx threex */
import * as three from 'three'
import { Face3, Geometry, Mesh } from 'three'
import { threex } from '../jsx'
import {regular, active, neighbour} from './materials'
import { constructHierarchicalMesh } from '../../../geometry/hierarchical-mesh'

const polyFace = polygon => (
  <Mesh
    material={regular}
    geometry={
      <Geometry
        vertices={polygon.points.slice()}
        faces={polygon.triangles.map(({a, b, c}, i) => (
          <Face3
            key={i}
            a={polygon.points.indexOf(a)}
            b={polygon.points.indexOf(b)}
            c={polygon.points.indexOf(c)}
          />
        ))}
      />
    }
  />
)

const polyEdge = (edge, material=regular) => {
  const { id, line, vector } = edge
  const { start } = line

  const tube = new three.Mesh(new three.CylinderGeometry(0.05, 0.05, line.distance()))

  tube.position.y = line.distance() / 2
  tube.userData.isElement = true
  tube.userData.edge = edge
  tube.userData.edgeId = id
  tube.material = material

  const offset = new three.Object3D()
  offset.position.copy(start)
  offset.quaternion.setFromUnitVectors(new three.Vector3(0, 1, 0), vector.normalize())
  offset.add(
    tube,
    <Mesh
      geometry={new three.IcosahedronGeometry(.048, 3)}
      material={material}
      userData={{
        vertex: edge.point,
        vertexId: edge.point.index,
        isElement: true
      }}
    />
  )

  return offset
}

export const getObject = topology => {
  const hierarchicalMesh = constructHierarchicalMesh(topology)
  const objectByPolygon = {}

  /// before getting started, fill in some containers for each polygon in the
  /// hierarchical mesh.
  hierarchicalMesh.traverse(obj => {
    let node = obj.userData.node
    if (!node) return

    // now for anything related to a polygon we can lookup the matrix transform
    objectByPolygon[node.poly.index] = obj
  })

  hierarchicalMesh.traverse(obj => {
    const { node, parent, children } = obj.userData
    const polygon = node && node.poly
    if (!polygon) return;

    const fold = parent && node.edge
    const cuts = polygon.edges
      .filter(e => (
        (!parent || e.shared.poly !== parent.poly)
        && children.every(c => c.node.edge.id !== e.id)
      ))

    const polyObj = polyFace(polygon)//,
    polyObj.geometry.computeFaceNormals()

    obj.add(polyObj,
      fold && polyEdge(fold, active) || null,
      ...cuts.map(edge => polyEdge(edge, neighbour))
    )
  })

  let down = new three.Vector3(0, 0, -1)
  let top = hierarchicalMesh.children[0].userData.node.poly,
    angle = top.plane.normal.angleTo(down),
    cross = new three.Vector3().crossVectors(top.plane.normal, down).normalize(),
    rotation = new three.Matrix4().makeRotationAxis(cross, angle)

  hierarchicalMesh.updateMatrixWorld()
  hierarchicalMesh.applyMatrix(rotation)

  // Update the object's matrix with this new transform
  hierarchicalMesh.traverse(node => {
    if (node.isMesh) {
      node.geometry.computeFaceNormals()
    }

    if (!node.userData.animate) {
      return
    }

    node.userData.animate(0)
  })

  hierarchicalMesh.updateMatrixWorld()
  return hierarchicalMesh
}
