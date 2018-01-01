import { Line3, Matrix4, Triangle } from 'three'

export const getTabAngle = polygon => {
  const [ edge ] = polygon.edges
  const edgeAngle = Math.PI - edge.vector.angleTo(edge.next.vector)
  const innerAngle = edgeAngle > Math.PI
    ? edgeAngle - Math.PI
    : edgeAngle

  const remainingAngle = (2*Math.PI) % innerAngle
  const tabAngle = remainingAngle < 1e-6 ? innerAngle : remainingAngle

  return tabAngle
}

export const getTabDimensions = (transformations, tabScale, polygon) => {
  const edge = polygon.edges[0]
  const tabAngle = getTabAngle(polygon)
  const transform = transformations[polygon.index]
  const transformed = edge.line.clone().applyMatrix4(transform)
  const base = transformed.distance()

  const potentialHeight = base/2 * Math.tan(tabAngle)
  const desiredHeight = base * tabScale
  const resultingBase = 2 * (potentialHeight - desiredHeight) / Math.tan(tabAngle)
  const baseOffsetFactor = (resultingBase > 0 ? resultingBase : base) / base

  return { desiredHeight, baseOffsetFactor }
}

export const getTabMaker = (transformations, tabScale, polygon) => {
  const { desiredHeight, baseOffsetFactor } = getTabDimensions(transformations, tabScale, polygon)

  return edge => {
    const transform = transformations[edge.poly.index]
    const transformed = edge.line.clone().applyMatrix4(transform)
    const transformedVector = transformed.delta()

    const outward = transformed.getCenter()
      .sub(edge.poly.center.clone().applyMatrix4(transform))
      .normalize()
      .multiplyScalar(desiredHeight)

    const outerEdgeStart = transformed.at(.5 - baseOffsetFactor/2).add(outward)
    const outerEdgeEnd = transformed.at(.5 + baseOffsetFactor/2).add(outward)

    const targetTransform = transformations[edge.shared.poly.index]
    const targetLine = edge.shared.line.clone().applyMatrix4(targetTransform)
    const targetVector = targetLine.delta().negate()
    const cross = transformedVector.clone().cross(targetVector)

    const rotation = transformedVector.angleTo(targetVector) * (
      Math.abs(cross.z) > 1e-6 ? Math.sign(cross.z) : 1
    )

    const toOrigin = transformed.start.clone().negate()
    const toTargetPoint = targetLine.end.clone()

    const toTarget = new Matrix4()
      .multiply(new Matrix4().makeTranslation(...toTargetPoint.toArray()))
      .multiply(new Matrix4().makeRotationZ(rotation))
      .multiply(new Matrix4().makeTranslation(...toOrigin.toArray()))

    const tabQuad = [transformed.start, outerEdgeStart, outerEdgeEnd, transformed.end]
    const overlapQuad = tabQuad.map(p => p.clone().applyMatrix4(toTarget))
    const triangles = [
      new Triangle(overlapQuad[0], overlapQuad[3], overlapQuad[1]),
      new Triangle(overlapQuad[3], overlapQuad[2], overlapQuad[1])
    ]

    const overlapEdges = [
      new Line3(overlapQuad[0], overlapQuad[1]),
      new Line3(overlapQuad[1], overlapQuad[2]),
      new Line3(overlapQuad[2], overlapQuad[3]),
      new Line3(overlapQuad[3], overlapQuad[0]),
    ]

    return {
      id: edge.id,
      polygonId: edge.poly.index,
      toTab: new Matrix4().getInverse(toTarget),
      quad: tabQuad,
      overlap: overlapQuad,
      overlapEdges,
      poly: {
        containsPoint: (point, excludeEdges=false) => {
          const inTriangles = triangles.some(tri => tri.containsPoint(point))
          const inEdges = overlapEdges.some(edge => edge.containsPoint(point))

          return inTriangles && (!excludeEdges || !inEdges)
        },
        triangles
      }
    }
  }
}
