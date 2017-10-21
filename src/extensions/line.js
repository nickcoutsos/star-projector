import {Line3, Plane, Vector3} from 'three'
import './vector'

Line3.prototype.toPoints = function() {
  return [
    this.start,
    this.end
  ]
}

Line3.prototype.toArray = function() {
  return [
    this.start.toArray(),
    this.end.toArray()
  ]
}

Line3.fromArray = function([a, b]) {
  return new Line3(
    new Vector3(...a),
    new Vector3(...b)
  )
}

Line3.prototype.containsPoint = function(point) {
  const t = this.closestPointToPointParameter(point)
  return (
    t >= 0 && t <= 1 &&
    this.at(t).distanceToSquared(point) < 1e-6
  )
}

Line3.prototype.intersectLine = function(line) {
  const orthogonal = this.delta().applyAxisAngle(new Vector3(0, 0, 1), Math.PI/2)
  const plane = new Plane().setFromNormalAndCoplanarPoint(orthogonal, this.start)
  const point = plane.intersectLine(line)
  const t = point && line.closestPointToPointParameter(point)

  if (!point) {
    return null
  } else if (t < 0 || t > 1) {
    console.log('wtf', t)
    return null
  }

  return point
}
