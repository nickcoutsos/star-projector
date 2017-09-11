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

const curveDirective = curve => {
  const [start, ...points] = curve.getControlPoints()
  return `M${start.x},${start.y} C ${points.map(({x, y}) => `${x} ${y}`).join(' ')}`
}

const asterismEdgeDirective = edges => {
  const [ first, ...rest ] = edges.filter((_, i) => i === 0 || i % 2 !== 0)
  return `M${first.x},${first.y} L ${rest.map(({x, y}) => `${x} ${y}`).join(' ')}`
}

export function drawSVG(matrices, stars, asterisms, edges) {
  const { starPaths } = stars.reduce((results, { polygonId, paths, star, point }) => {
    if (polygonId !== undefined) {
      results.starPoints.push(Object.assign(
        {radius: Math.max(0.1, (1 - star.magnitude / 7)) * 0.025 + .001},
        point.clone().applyMatrix4(matrices[polygonId])
      ))
    } else if (paths) {
      paths.forEach(({curves, polygonId}) => {
        const matrix = matrices[polygonId]
        const transformed = curves.map(curve => (
          curve.clone().applyMatrix4(matrix)
        ))

        results.starPaths.push(...transformed)
      })
    }

    return results
  }, {
    starPoints: [],
    starPaths: []
  })

  let cuts = [].concat(...edges.map(({polygonId, cuts}) => cuts.map(cut => cut.map(p => p.clone().applyMatrix4(matrices[polygonId]))))),
    folds = edges.map(({polygonId, fold}) => fold && fold.map(p => p.clone().applyMatrix4(matrices[polygonId]))).filter(fold => fold);


  let edgeHull = hull([].concat(...cuts))
      .map(
        (v, i, points) => ([v, points[(i+1) % points.length]])
      );

  let longestEdge = edgeHull.map(([a, b]) => a.clone().sub(b)).reduce((a, b) => b.lengthSq() > a.lengthSq() ? b : a),
    aaRotation = new Matrix4().makeRotationAxis(new Vector3(0, 0, 1), longestEdge.angleTo(new Vector3(1, 0, 0))),
    align = p => p.clone().applyMatrix4(aaRotation),
    alignEdge = edge => edge.map(align);

  const boundingBox = new Box2().setFromPoints([].concat(...cuts.map(alignEdge)))

  const offset = boundingBox.min.clone().negate()
  const scale = 100 / boundingBox.getSize().x
  const height = boundingBox.getSize().y * scale

  const viewbox = [0, 0, 100, height]
  const viewboxTransform = new Matrix4()
    .multiply(new Matrix4().makeScale(scale, scale, 1))
    .multiply(new Matrix4().makeTranslation(offset.x, offset.y, 0))
    .multiply(aaRotation)

  const transform = p => p.clone().applyMatrix4(viewboxTransform)
  const transformEdge = edge => edge.map(transform)

  cuts = cuts.map(transformEdge)
  folds = folds.map(transformEdge);
  starPaths.map(curve => curve.applyMatrix4(viewboxTransform))

  asterisms = asterisms.map(
    ({asterism, polygonId, quad}) =>
    ({ asterism, quad: quad.map(p => p.clone().applyMatrix4(matrices[polygonId]))})
  ).reduce((asterisms, {asterism, quad}) => {
    if (!asterisms[asterism.name]) asterisms[asterism.name] = [];
    asterisms[asterism.name].push(quad.map(transform))
    return asterisms;
  }, {});

  function segment([a, b]) {
    return element(
      'line',
      {
        x1: a.x, x2: b.x,
        y1: a.y, y2: b.y
      }
    );
  }

  const cutStrokeAttrs = {
    stroke: 'red',
    'stroke-width': '0.01pt',
    fill: 'transparent'
  }

  document.body.appendChild(
		element('svg', {
			id: 'output',
			preserveAspectRatio: 'none',
			viewBox: viewbox.join(' ')
		}, [
      element('g', cutStrokeAttrs, [element('rect', { x: 0, y: 0, width: 2.54, height: 2.54 })]),
			element('g', cutStrokeAttrs, cuts.map(segment)),
			element('g', {stroke: 'blue', 'stroke-width': 0.015}, folds.map(segment)),
      element('g', cutStrokeAttrs,
        starPaths.map(curve =>
          element('path', {
            d: curveDirective(curve)
          }))
      ),
			element('g', Object.assign({id: 'asterisms-groups'}, cutStrokeAttrs),
        Object.keys(asterisms).map(name =>
          element('g', {id: `${name}-lines`}, (
            asterisms[name].map(quad => (
              element('path', {d: asterismEdgeDirective(quad) })
            ))
          ))
        )
			)
		])
	);
}
