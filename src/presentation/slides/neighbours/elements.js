import * as three from 'three'
import {regular} from './materials'

export const getVertices = topology => (
  new three.Object3D().add(
    ...topology.vertices.map(v => {
      const mesh = new three.Mesh(new three.IcosahedronGeometry(.08, 3), regular)

      mesh.position.copy(v)
      mesh.userData.vertex = v
      mesh.userData.vertexId = v.index
      mesh.userData.isElement = true
      return mesh
    })
  )
)

export const getEdges = topology => (
  new three.Object3D().add(
    ...topology.edges.map(edge => {
      const { id, line, vector } = edge
      const { start } = line
      const tube = new three.Mesh(new three.CylinderGeometry(0.05, 0.05, line.distance()))

      tube.position.y = line.distance() / 2
      tube.userData.isElement = true
      tube.userData.edge = edge
      tube.userData.edgeId = id
      tube.material = regular

      const offset = new three.Object3D()
      offset.position.copy(start)
      offset.quaternion.setFromUnitVectors(new three.Vector3(0, 1, 0), vector.normalize())
      offset.add(tube)

      return offset
    })
  )
)

export const getFaces = topology => (
  new three.Object3D().add(
    ...topology.polygons.map(polygon => {
      const {index, points, triangles} = polygon
      const geometry = Object.assign(new three.Geometry(), {
        vertices: points.slice(),
        faces: triangles.map(({a, b, c}) => (
          new three.Face3(
            ...[a,b,c].map(v => points.indexOf(v))
          )
        ))
      })

      geometry.computeVertexNormals()
      const mesh = new three.Mesh(geometry, regular)

      mesh.userData.polygon = polygon
      mesh.userData.polygonId = index
      mesh.userData.isElement = true
      return mesh
    })
  )
)
