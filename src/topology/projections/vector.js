import {Ray, Vector3} from 'three'
import {pointInPolygon} from '../polygons'

export default function projectVector(topology, vector, origin = new Vector3()) {
  const ray = new Ray(origin, vector);
  let point, polygon = topology.polygons.find(polygon => {
    point = ray.intersectPlane(polygon.plane)
    return point && pointInPolygon(point, polygon) && point
  });

  return polygon && {polygonId: polygon.index, point}
}
