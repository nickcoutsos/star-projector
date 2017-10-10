import {Box2, Matrix4, Triangle, Vector3} from 'three';
import hull from 'convexhull-js';

/**
 * Create a DOM element in the SVG namespace.
 *
 * @param {String} tagname - the element tag name.
 * @param {Object} [attributes={}] a key-value mapping of attributes to add to the node
 * @param {Array<DOMNode>} [children=[]] array of children to append before returning
 * @returns {DOMNode}
 */
export function element(tagname, attributes={}, children=[]) {
  let node = document.createElementNS('http://www.w3.org/2000/svg', tagname);
  Object.keys(attributes).forEach(k => node.setAttribute(k, attributes[k]));
  children.forEach(child => node.appendChild(child));

  return node;
}

const lineDirective = ([ a, b ]) => {
  return `M ${a.x},${a.y} L ${b.x},${b.y}`
}

const pathDirective = path => {
  const curveTo = ([, ...points]) => points.map(({ x, y }) => `${x},${y}`).join(' ')
  const curvePoints = path.curves.map(curve => curve.getControlPoints())
  const [ [first] ] = curvePoints

  return `M${first.x},${first.y} C ${curvePoints.map(curveTo).join(' ')}`
}

const asterismEdgeDirective = edges => {
  const [ first, ...rest ] = edges.filter((_, i) => i === 0 || i % 2 !== 0)
  return `M${first.x},${first.y} L ${rest.map(({x, y}) => `${x} ${y}`).join(' ')}`
}

const polyDirective = (poly, close=false) => {
  const [ first, ...rest ] = poly
  return `M${first.x},${first.y} L ${rest.map(({x, y}) => `${x},${y}`).join(' ')} ${close ? 'Z' : ''}`
}

const getUnfoldedEdges = polygons => [].concat(
  ...polygons.map(({ matrix, cuts }) => (
    cuts.map(cut => cut.line
      .clone()
      .applyMatrix4(matrix)
    )
  ))
)

const getUnfoldedHull = edges => (
  hull([].concat(
    ...edges.map(edge => edge.toPoints())
  ))
)

/**
 * Make a rotation matrix to align the longest edge of a hull with the X-axis
 *
 * @param {Array<Vector3>}
 * @returns {Matrix4}
 */
const getOrientationMatrix = points => {
  const longestEdge = points
    .map((v, i, arr) => ([v, arr[(i+1) % arr.length]]))
    .map(edge => new Vector3().subVectors(...edge))
    .reduce((a, b) => b.lengthSq() > a.lengthSq() ? b : a)

  return new Matrix4().makeRotationZ(
    longestEdge.angleTo(new Vector3(1, 0, 0))
  )
}

const getTabAngle = polygon => {
  const [ edge ] = polygon.edges
  const innerAngle = edge.vector.angleTo(edge.next.vector)
  const remainingAngle = 2*Math.PI - 3*innerAngle

  return remainingAngle
}

export function drawSVG(polygons, stars, asterisms) {
  const edges = getUnfoldedEdges(polygons)
  const edgeHull = getUnfoldedHull(edges)
  const aaRotation = getOrientationMatrix(edgeHull)
  const boundingBox = new Box2().setFromPoints(
    edgeHull.map(p => p.applyMatrix4(aaRotation))
  )

  // TODO: refactor this section into a function that allows for scaling based
  // on desired radius or edge length or maximum unfolded dimensions
  const offset = boundingBox.min.clone().negate()
  // const scale = 100 / boundingBox.getSize().x
  const scale = 12.584086145276297
  const edgeLength = polygons[0].polygon.edges[0].line.distance()
  const tabHeight = edgeLength / 6
  const width = (boundingBox.getSize().x + tabHeight*2) * scale
  const height = (boundingBox.getSize().y + tabHeight*2) * scale

  const viewbox = [0, 0, width, height]
  const viewboxTransform = new Matrix4()
    .multiply(new Matrix4().makeScale(scale, scale, 1))
    .multiply(new Matrix4().makeTranslation(offset.x + tabHeight, offset.y + tabHeight, 0))
    .multiply(aaRotation)

  const transformations = polygons.map(({ matrix }) => (
    matrix.clone().premultiply(viewboxTransform)
  ))

  const tabAngle = getTabAngle(polygons[0].polygon)
  const tabs = polygons.reduce((tabs, { polygon, normal, matrix, cuts }, polygonId) => {
    const transform = transformations[polygonId]

    cuts.forEach(({ id, line, shared }) => {
      const existing = tabs.find(edge => edge.id === id)
      if (existing) {
        return
      }


      // TODO: Apparently this is wrong. For length/6 we get the desired results
      // but any other fraction of the original length is giving the wrong tab
      // height.
      const transformed = line.clone().applyMatrix4(transform)
      const transformedVector = transformed.delta()
      const length = transformed.distance()
      const potentialHeight = length/2 * Math.tan(tabAngle)
      const desiredHeight = length / 6
      const resultingLength = 2 * (potentialHeight - desiredHeight) * Math.tan(tabAngle)
      const lengthOffsetFactor = resultingLength / length

      const outward = transformed.getCenter()
        .sub(polygon.center.clone().applyMatrix4(transform))
        .normalize()
        .multiplyScalar(desiredHeight)

      const outerEdgeStart = transformed.at(1 - lengthOffsetFactor).add(outward)
      const outerEdgeEnd = transformed.at(lengthOffsetFactor).add(outward)

      const targetTransform = transformations[shared.poly.index]
      const targetLine = shared.line.clone().applyMatrix4(targetTransform)
      const targetVector = targetLine.delta().negate()
      const cross = transformedVector.clone().cross(targetVector)
      const rotation = transformedVector.angleTo(targetVector) * Math.sign(cross.z)

      const toOrigin = transformed.start.clone().negate()
      const toTargetPoint = targetLine.end.clone()

      const toTarget = new Matrix4()
        .multiply(new Matrix4().makeTranslation(...toTargetPoint.toArray()))
        .multiply(new Matrix4().makeRotationZ(rotation))
        .multiply(new Matrix4().makeTranslation(...toOrigin.toArray()))

      // TODO: generate a transformation matrix based on the shared edge's
      // position and angle relative to this one

      const tabQuad = [transformed.start, outerEdgeStart, outerEdgeEnd, transformed.end]
      const overlapQuad = tabQuad.map(p => p.clone().applyMatrix4(toTarget))

      tabs.push({
        id, polygonId,
        toTab: new Matrix4().getInverse(toTarget),
        quad: tabQuad,
        overlap: overlapQuad,
        poly: {
          triangles: [
            new Triangle(overlapQuad[0], overlapQuad[3], overlapQuad[1]),
            new Triangle(overlapQuad[3], overlapQuad[2], overlapQuad[1])
          ]
        }
      })
    })

    return tabs
  }, [])

  const { cuts, folds } = polygons.reduce((results, { cuts, fold }, polygonId) => {
    const transform = transformations[polygonId]
    const mapEdge = edge => edge.line.clone().applyMatrix4(transform).toPoints()

    fold && results.folds.push(mapEdge(fold))
    cuts.forEach(cut => {
      // render edges with tabs defined as folds instead of cuts
      const container = tabs.find(tab => tab.id === cut.id && tab.polygonId === polygonId)
        ? results.folds
        : results.cuts

      container.push(mapEdge(cut))
    })

    return results
  }, { cuts: [], folds: [] })

  const starPaths = stars.reduce((results, { paths }) => {
    paths.forEach(path => {
      const { polygonId } = path
      const { polygon } = polygons[polygonId]
      const transform = transformations[polygonId]
      const transformed = path.clone().applyMatrix4(transform)

      results.push(transformed)

      const potentialOverlaps = tabs.filter(tab => (
        tab.polygonId !== polygonId &&
        polygon.edges.some(edge => edge.id === tab.id)
      ))

      potentialOverlaps.forEach(tab => {
        const overlap = transformed.curves.some(curve => {
          return curve.getControlPoints().some(point => (
            tab.poly.triangles.some(triangle => triangle.containsPoint(point))
          ))
        })

        // TODO: find intersections between overlapped curves and tabs and
        // discard sections that fall outside of the tab's boundary.
        if (overlap) {
          const copy = transformed.clone().applyMatrix4(tab.toTab)
          results.push(copy)
        }
      })
    })

    return results
  }, [])

  const asterismQuads = asterisms.reduce((results, { polygonId, quad }) => {
    const { polygon } = polygons[polygonId]
    const transform = transformations[polygonId]
    const mapped = quad.map(p => p.clone().applyMatrix4(transform))
    const result = [mapped]

    const potentialOverlaps = tabs.filter(tab => (
      tab.polygonId !== polygonId &&
      polygon.edges.some(edge => edge.id === tab.id)
    ))

    potentialOverlaps.forEach(tab => {
      const overlap = mapped.some(point => (
        tab.poly.triangles.some(triangle => triangle.containsPoint(point))
      ))

      // TODO: intersect overlapped quad with tab and discard sections that fall
      // outside of the tab's boundary.
      if (overlap) {
        result.push(mapped.map(p => p.clone().applyMatrix4(tab.toTab)))
      }
    })

    return [...results, ...result]
  }, [])

  const stroke = { 'stroke-width': '0.01pt', fill: 'none' }
  const strokeRed = Object.assign({}, stroke, { stroke: 'red' })
  const strokeBlue = Object.assign({}, stroke, { stroke: 'blue' })
  // const strokeDotBlack = Object.assign({}, stroke, { stroke: 'black', 'stroke-width': '.035pt', 'stroke-dasharray': '.2, .3' })

  document.body.appendChild(
    element('svg', {
      id: 'output',
      preserveAspectRatio: 'xMinYMin',
      viewBox: viewbox.join(' '),
      width: `${width}cm`,
      height: `${height}cm`
    }, [
      element('g', strokeRed, [element('rect', { x: 0, y: 0, width: 2.54, height: 2.54 })]),
      element('g', strokeRed, cuts.map(cut => (
        element('path', { d: lineDirective(cut) })
      ))),
      element('g', strokeBlue, folds.map(fold => (
        element('path', { d: lineDirective(fold) })
      ))),
      element('g', strokeRed,
        starPaths.map(path => element('path', { d: pathDirective(path) }))
      ),
      element('g', strokeRed, asterismQuads.map(quad => (
        element('path', { d: asterismEdgeDirective(quad) })
      ))),
      element('g', strokeRed, tabs.map(({ quad }) => (
        element('path', { d: polyDirective(quad) })
      ))),
      // element('g', strokeDotBlack, tabs.map(({ overlap }) => (
      //   element('path', { d: polyDirective(overlap) })
      // )))
    ])
  );
}
