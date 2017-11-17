import { CylinderGeometry, Mesh, Object3D, Vector3 } from 'three'

const up = new Vector3(0, 1, 0)

const cylinderLine = (start, end, radius, material) => {
  const vector = end.clone().sub(start)
  const length = vector.length()
  const tube = new Mesh(new CylinderGeometry(radius, radius, length))
  tube.material = material
  tube.position.y = length / 2

  const offset = new Object3D()
  offset.position.copy(start)
  offset.quaternion.setFromUnitVectors(up, vector.normalize())
  offset.add(tube)

  return offset
}

export default cylinderLine
