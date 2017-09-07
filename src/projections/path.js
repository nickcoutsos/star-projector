import {CurvePath, Matrix4, Quaternion, Vector3} from 'three'
import projectCurves from './curve'

export default function projectCurvePath(topology, path, direction, options) {
  const ra = Math.atan2(direction.z, direction.x)
  const dec = Math.asin(direction.y)
  const scale = options && options.scale || 1
  const rotate = options && options.angle || 0
  const scaleTransform = new Matrix4().makeScale(scale, scale, 1)
  const rotateTransform = new Matrix4().makeRotationZ(rotate * 2 * Math.PI)
  const transformation = new Matrix4()
    .makeRotationFromQuaternion(
			new Quaternion().multiplyQuaternions(
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 3/2*Math.PI - ra),
        new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), dec)
			)
		)
    .multiply(rotateTransform)
    .multiply(scaleTransform)

  const transform = curve => curve.clone().applyMatrix4(transformation)

  const curves = path.curves.map(transform);

  return projectCurves(topology, direction, curves)
    .reduce((paths, {curve, polygon}) => {
      const polygonId = polygon.index
      let path = paths[paths.length - 1]

      if (!path || path.polygonId !== polygonId) {
        paths.push(path = Object.assign(new CurvePath(), {polygonId}))
      }

      path.add(curve)
      return paths
    }, [])
}
