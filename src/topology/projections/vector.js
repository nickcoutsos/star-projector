import {Ray, Vector3} from 'three'
import {pointInPolygon} from '../polygons'

export default function projectVector(topology, vector) {
  const ray = new Ray(new Vector3(), vector);
  let point, polygon = topology.polygons.find(polygon => {
    point = ray.intersectPlane(polygon.plane)
    return point && pointInPolygon(point, polygon) && point
  });

  return polygon && {polygon, point}
}
