import { flatten } from 'lodash'
import Topology from '../../../topology'
import * as three from 'three'

const geometry = new three.DodecahedronGeometry()
const topology = new Topology(geometry, {})
const vertices = flatten(topology.edges.map(({ line }) => line.toPoints()))

export const elements = [
  Object.assign(
    new three.Points(
      new three.DodecahedronGeometry(),
      new three.PointsMaterial({color: 'red', size: 0.1})
    ),
    {visible: false}
  ),
  Object.assign(
    new three.LineSegments(
      Object.assign(
        new three.Geometry(),
        {vertices: vertices.slice()}
      ),
      new three.LineBasicMaterial({color: 'green'})
    ),
    {visible: false}
  ),
  Object.assign(
    new three.Mesh(
      geometry,
      new three.MeshStandardMaterial({
        color: 'lightslategray',
        metalness: 0.5,
        roughness: 0.9,
        flatShading: true
      })
    ),
    {visible: false}
  )
]
