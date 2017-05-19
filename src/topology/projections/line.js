import {Plane} from 'three'
import {pointInPolygon, isSimilarNormal} from '../polygons'

export default function projectLineSegment(topology, a, b) {
  const polygonA = topology.polygons.find(p => pointInPolygon(a, p))
  const polygonB = topology.polygons.find(p => pointInPolygon(b, p))
  const coplane = new Plane(a.clone().cross(b), 0)

  // If both points are on the same polygon a straight line can connect them.
  if (polygonA === polygonB) {
    return [{
      polygonId: polygonA.index,
      edge: [a, b]
    }]
  }

  // Find all point intersection between the topology's edges and the plane
  // defined by points `a`, `b`, and the origin excluding those which lie
  // outside of the arc of `a` and `b`
  const intersections = topology.edges
    .reduce((intersections, edge) => {
      const point = coplane.intersectLine(edge.line)
      if (point && areVectorsInOrder(a, point, b)) {
        intersections.push({ edge, point })
      }

      return intersections
    }, [])

  return segmentsFromIntersections(intersections, polygonA, a, polygonB, b)
}

/**
 * Determine whether or not coplanar vectors a,b,c wind in a consistent direction
 *
 * @param {Vector3} ...vectors two or more coplanar vectors
 * @returns {Boolean}
 */
const areVectorsInOrder = (...vectors) => {
  const normal = vectors[0].clone().cross(vectors[vectors.length - 1])
  const normalIsCloseEnough = isSimilarNormal(normal)

  return vectors
    .slice(0, -1)
    .map((v, i) => v.clone().cross(vectors[i + 1]))
    .map(normal => ({normal}))
    .every(normalIsCloseEnough)
}

/**
 * Generate line segments connecting pointA in polygonA to pointB in polygonB
 *
 * @param {Array} intersections
 * @param {Object} polygonA
 * @param {Vector3} pointA
 * @param {Object} polygonB
 * @param {vector3} pointB
 * @returns {Array<Object>} segments ({polygonIndex, [points]})
 */
const segmentsFromIntersections = (intersections, polygonA, pointA, polygonB, pointB) => {
  // Pick arbitrary intersection point from polygonA
  const start = intersections.find(
    ({edge}) => polygonA.edges.find(
      ({id}) => edge.id === id
    )
  )

  // Order points according to their angular distance `start`
  intersections.forEach(intersection => intersection.angle = intersection.point.angleTo(start.point));
  intersections.sort((a, b) => a.angle - b.angle);

  // For each intersection generate two points referencing each of the polygons
  // adjacent to the intersected edge, and in a sequence
  // Then reduce this sequence of points to pairs of vertices forming the
  // divided line segments
  return intersections.reduce((intersectionPoints, {edge, point}) => {
    const last = intersectionPoints.slice(0, -1)[0]
    const polygons = [edge.poly.index, edge.shared.poly.index]
    if (polygons[1] === last) polygons.reverse()

    intersectionPoints.push(
      { point, polygonIndex: polygons[0] },
      { point, polygonIndex: polygons[1] }
    )

    return intersectionPoints
  }, [{
    polygonId: polygonA.index,
    edge: [
      pointA,
      intersections[0].point
    ]
  }]).concat({
    polygonId: polygonB.index,
    point: pointB
  }).reduce((segments, {polygonIndex, point}, i, points) => {
    const {point: next} = points[i+1] || {}

    if (next) {
      segments.push({
        polygonIndex,
        edge: [ point, next ]
      })
    }

    return segments
  }, [])
}
