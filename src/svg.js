import {Box2, Matrix4, Vector3} from 'three';
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

export function drawSVG(polygons, stars, asterisms) {
  const edges = getUnfoldedEdges(polygons)
  const edgeHull = getUnfoldedHull(edges)
  const aaRotation = getOrientationMatrix(edgeHull)
  const boundingBox = new Box2().setFromPoints(
    edgeHull.map(p => p.applyMatrix4(aaRotation))
  )

  const offset = boundingBox.min.clone().negate()
  // const scale = 100 / boundingBox.getSize().x
  const scale = 12.584086145276297
  const width = boundingBox.getSize().x * scale
  const height = boundingBox.getSize().y * scale

  const viewbox = [0, 0, width, height]
  const viewboxTransform = new Matrix4()
    .multiply(new Matrix4().makeScale(scale, scale, 1))
    .multiply(new Matrix4().makeTranslation(offset.x, offset.y, 0))
    .multiply(aaRotation)

  const transformations = polygons.map(({ matrix }) => (
    matrix.clone().premultiply(viewboxTransform)
  ))

  const { cuts, folds } = polygons.reduce((results, { cuts, fold }, polygonId) => {
    const transform = transformations[polygonId]
    const mapEdge = edge => edge.line.clone().applyMatrix4(transform).toPoints()

    fold && results.folds.push(mapEdge(fold))
    results.cuts.push(...cuts.map(mapEdge))
    return results
  }, { cuts: [], folds: [] })

  const starPaths = stars.reduce((results, { paths }) => {
    paths.forEach(path => {
      const { polygonId } = path
      const transform = transformations[polygonId]
      results.push(path.clone().applyMatrix4(transform))
    })

    return results
  }, [])

  const asterismQuads = asterisms.reduce((results, { polygonId, quad }) => {
    const transform = transformations[polygonId]
    const mapQuad = p => p.clone().applyMatrix4(transform)

    return [...results, quad.map(mapQuad)]
  }, [])

  const cutStrokeAttrs = { stroke: 'red', 'stroke-width': '0.01pt', fill: 'transparent' }

  document.body.appendChild(
    element('svg', {
      id: 'output',
      preserveAspectRatio: 'none',
      viewBox: viewbox.join(' ')
    }, [
      element('g', cutStrokeAttrs, [element('rect', { x: 0, y: 0, width: 2.54, height: 2.54 })]),
      element('g', cutStrokeAttrs, cuts.map(cut => (
        element('path', { d: lineDirective(cut) })
      ))),
      element('g', {stroke: 'blue', 'stroke-width': 0.015}, folds.map(fold => (
        element('path', { d: lineDirective(fold) })
      ))),
      element('g', cutStrokeAttrs,
        starPaths.map(path => element('path', { d: pathDirective(path) }))
      ),
      element('g', cutStrokeAttrs, asterismQuads.map(quad => (
        element('path', { d: asterismEdgeDirective(quad) })
      )))
    ])
  );
}
