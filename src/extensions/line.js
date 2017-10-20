import {Line3, Vector3} from 'three'
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
