import {CubicBezierCurve3, Matrix4, Ray, Vector3} from 'three'
import projectVector from './vector'
import '../../extensions'

const EPSILON = 1e-6

export default function projectCurves(topology, direction, curves) {
  const projectedCurves = []

  curves.forEach(curve => {
    const last = projectedCurves[projectedCurves.length -1]
    projectedCurves.push(...projectCurve(
      topology, direction, curve, last && (last.next || last.polygon), projectedCurves.length
    ))
  })

  return projectedCurves
}

/**
 * Project a single bezier curve onto the target topology.
 *
 * A projected curve may be split into multiple curves
 */
function projectCurve(topology, direction, curve, preferPolygon=null) {
  const [first, ...rest] = curve.getControlPoints();
  let polygon, point;

  if (preferPolygon) {
    polygon = preferPolygon;
    point = new Ray(first.clone(), direction).intersectPlane(polygon.plane)
  } else {
    ({polygon, point} = projectVector(topology, direction, first))
  }

  const projected = new CubicBezierCurve3(
    point,
    ...rest.map(point => {
      return new Ray(
        point.clone(),
        direction
      ).intersectPlane(polygon.plane)
    })
  );

  const intersection = findFirstCurvePolygonIntersection(projected, polygon)

  if (!intersection) {
    return [{curve: projected, polygon}]
  }

  const initial = projected.splitAt(intersection.t)[0]
  const remainder = curve.splitAt(intersection.t)[1]

  // If the "intersection" happens (for all practical uses) at the very end of
  // the curve then go ahead and return the full curve becaue otherwise the next
  // curve will think it's intersecting "too close" to the beginning for the
  // intersection to be genuine. Instead we also indicate that the next curve
  // should project onto the polygon sharing the intersected edge.
  if (1 - intersection.t < EPSILON) {
    return [{
      curve: initial,
      next: intersection.edge.shared.poly,
      polygon
    }]
  }

  return [
    {curve: initial, polygon},
    ...projectCurve(
      topology, direction, remainder, intersection.edge.shared.poly
    )
  ]
}

function curveEndsCloseEnoughToLine(curve, line) {
  const t = line.closestPointToPointParameter(curve.v3)

  return (
    t > 0 &&
    t < 1 &&
    line.at(t)
      .distanceToSquared(curve.v3) < EPSILON*EPSILON
  )
}

function findFirstCurvePolygonIntersection(curve, polygon) {
  let {edges} = polygon
  const back = new Vector3(0, 0, 1)
  const angle = back.angleTo(polygon.plane.normal)
  const axis = new Vector3().crossVectors(polygon.plane.normal, back).normalize()
  const matrix = new Matrix4().makeRotationAxis(axis, angle)


  edges = polygon.edges.map(edge => Object.assign({}, edge, {line: edge.line.clone().applyMatrix4(matrix)}))
  curve = curve.clone().applyMatrix4(matrix)
  curve.getControlPoints().forEach(point => { point.z = 0 })
  edges.forEach(({line}) => { line.start.z = line.end.z = 0 })

  for (let edge of edges) {
    const intersections = curve.intersectLine(edge.line).filter(({t}) => t > EPSILON)
    if (!intersections.length) {
      if (curveEndsCloseEnoughToLine(curve, edge.line)) {
        return {edge, t: 1}
      }

      continue;
    }

    return {t: intersections[0].t, edge}
  }
}
