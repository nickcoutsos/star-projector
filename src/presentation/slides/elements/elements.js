import Topology from '../../../topology'
import * as three from 'three'

const geometry = new three.DodecahedronGeometry()
const topology = new Topology(geometry, {})

export const elements = [
  new three.Object3D().add(
    ...topology.vertices.map(v => {
      const mesh = new three.Mesh(
        new three.IcosahedronGeometry(.08, 3),
        new three.MeshStandardMaterial({
          color: 'crimson',
          metalness: 0.1,
          roughness: 0.9,
          flatShading: false
        })
      )

      mesh.position.copy(v)
      mesh.userData.vertexId = v.index
      return mesh
    })
  ),
  new three.Object3D().add(
    ...topology.edges.map(({ id, line, vector }) => {
      const {start} = line
      const tube = new three.Mesh(
        new three.CylinderGeometry(0.05, 0.05, line.distance()),
        new three.MeshStandardMaterial({
          color: 'seagreen',
          metalness: 0.1,
          roughness: 0.9,
          flatShading: false
        })
      )

      tube.position.y = line.distance() / 2

      const offset = new three.Object3D()
      offset.position.copy(start)
      offset.quaternion.setFromUnitVectors(new three.Vector3(0, 1, 0), vector.normalize())
      offset.add(tube)
      offset.userData.edgeId = id

      return offset
    })
  ),
  new three.Object3D().add(
    ...topology.polygons.map(({index, points, triangles}) => {
      const geometry = Object.assign(new three.Geometry(), {
        vertices: points.slice(),
        faces: triangles.map(({a, b, c}) => (
          new three.Face3(
            ...[a,b,c].map(v => points.indexOf(v))
          )
        ))
      })

      geometry.computeVertexNormals()
      const mesh = new three.Mesh(geometry, new three.MeshStandardMaterial({
        color: 'steelblue',
        metalness: 0.1,
        roughness: 0.9,
        flatShading: false
      }))

      mesh.userData.polygonId = index
      return mesh
    })
  )
]

