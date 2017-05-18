import {CurvePath, Matrix4, Quaternion, Vector3} from 'three'
import projectCurves from './curve'

export default function projectCurvePath(topology, path, direction) {
  const ra = Math.atan2(direction.z, direction.x)
  const dec = Math.asin(direction.y)
  const transformation = new Matrix4()
    .makeRotationFromQuaternion(
				new Quaternion().multiplyQuaternions(
          new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 3/2*Math.PI - ra),
          new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), dec)
				)
			)

  const transform = curve => curve.clone().applyMatrix4(transformation)

  const curves = path.curves.map(transform);

  return projectCurves(topology, direction, curves)
    .reduce((paths, {curve, polygon}) => {
      const polygonId = polygon.index
      let path = paths.find(path => path.polygonId === polygonId)
      if (!path) paths.push(path = Object.assign(new CurvePath(), {polygonId}))

      path.add(curve)
      return paths
    }, [])
}
