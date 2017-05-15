import {Matrix4, Quaternion, Vector3} from 'three'
import projectCurves from './curve'

export default function projectCurvePath(topology, curves, direction) {
  const ra = Math.atan2(direction.z, direction.x)
  const dec = Math.asin(direction.y)
  let transformation = new Matrix4()
    .makeRotationFromQuaternion(
				new Quaternion().multiplyQuaternions(
          new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 3/2*Math.PI - ra),
          new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), dec)
				)
			)

  curves = curves.map(curve => curve.clone().applyMatrix4(transformation));

  return projectCurves(topology, direction, curves)
}
