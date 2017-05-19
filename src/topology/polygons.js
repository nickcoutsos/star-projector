import {Plane, Triangle} from 'three'
import '../extensions'

const EPSILON = 1e-6

export default function organizePolygons(faces, vertices) {
  const triangleFactory = makeTriangleFactory(vertices)
  return groupFacesByNormal(faces)
    .map((group, index) => Object.assign(
      getPolygonFromGroup(group, triangleFactory),
      { index }
    ))
}

export const pointInPolygon = (point, {plane, triangles}) => (
  Math.abs(plane.distanceToPoint(point)) < EPSILON &&
  triangles.some(triangle => triangle.containsPoint(point))
)

const groupFacesByNormal = faces => faces.reduce(
  (groups, face) => {
    let group = groups.find(isSimilarNormal(face.normal))
    if (!group) {
      groups.push(group = {
        normal: face.normal,
        faces: []
      })
    }

    group.faces.push(face)
    return groups
  },
  []
)

const getPolygonFromGroup = ({normal, faces}, makeTriangle) => {
  const triangles = faces.map(makeTriangle)
  const points = triangles.map(t => t.toArray())
    .reduce((a, b) => a.concat(b))
    .reduce(uniqueVertices, [])

  const center = points
    .reduce((a, b) => a.clone().add(b))
    .divideScalar(points.length)

  return {
    plane: new Plane().setFromNormalAndCoplanarPoint(normal, center),
    points: sortPoints(points, normal, center),
    triangles,
    center
  }
}

const sortPoints = (points, normal, center) => {
  const vectors = points.map(p => ({p, vector: p.clone().sub(center)}))
  const initial = vectors[0].vector

  vectors.forEach(v => {
    const angle = v.vector.angleTo(initial)
    const cross = initial.clone().cross(v.vector)
    v.angle = cross.angleTo(normal) > EPSILON
      ? 2 * Math.PI - angle
      : angle
  })

  vectors.sort((a, b) => a.angle - b.angle)
  return vectors.map(({p}) => p)
}

export const isSimilarNormal = normal => (
  group => normal.angleTo(group.normal) < EPSILON
)

const uniqueVertices = (vertices, vertex) => {
  if (!vertices.find(v => v.index === vertex.index)) {
    vertices.push(vertex)
  }

  return vertices
}

const makeTriangleFactory = vertices => (
  face => new Triangle(...face.toArray().map(n => vertices[n]))
)
