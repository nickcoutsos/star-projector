import {Box2, Matrix4, Vector3} from 'three';
import hull from 'convexhull-js';

const PAIR = (pairs, val) => {
	let pair = pairs[pairs.length-1];
	if (pair.length > 1) pairs.push(pair = []);
	pair.push(val);
	return pairs;
};


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


export function drawSVG(matrices, stars, asterisms, edges) {
  stars = stars.map(
    ({star, polygon, point}) =>
    Object.assign(
      {radius: Math.max(0.1, (1 - star.mag / 7)) * 0.25 + .1},
      point.clone().applyMatrix4(matrices[polygon.index].matrixWorld)
    )
  );

  let cuts = [].concat(...edges.map(({polygon, cuts}) => cuts.map(cut => cut.map(p => p.clone().applyMatrix4(matrices[polygon.index].matrixWorld))))),
    folds = edges.map(({polygon, fold}) => fold && fold.map(p => p.clone().applyMatrix4(matrices[polygon.index].matrixWorld))).filter(fold => fold);


  let edgeHull = hull([].concat(...cuts))
      .map(
        (v, i, points) => ([v, points[(i+1) % points.length]])
      );


  let longestEdge = edgeHull.map(([a, b]) => a.clone().sub(b)).reduce((a, b) => b.lengthSq() > a.lengthSq() ? b : a),
		aaRotation = new Matrix4().makeRotationAxis(new Vector3(0, 0, 1), -longestEdge.angleTo(new Vector3(1, 0, 0))),
    align = p => p.clone().applyMatrix4(aaRotation),
    alignEdge = edge => edge.map(align);

  cuts = cuts.map(alignEdge);
  folds = folds.map(alignEdge);
  stars = stars.map(star => Object.assign(star, align(new Vector3(star.x, star.y))));

  asterisms = asterisms.map(
    ({asterism, polygon, edge}) =>
    ({asterism, edge: edge.map(p => p.clone().applyMatrix4(matrices[polygon].matrixWorld))})
  ).reduce((asterisms, {asterism, edge}) => {
    if (!asterisms[asterism.name]) asterisms[asterism.name] = [];
    asterisms[asterism.name].push(alignEdge(edge));
    return asterisms;
  }, {});

  let boundingBox = new Box2().setFromPoints([].concat(...cuts));

  function segment([a, b]) {
    return element(
      'line',
      {
        x1: a.x, x2: b.x,
        y1: a.y, y2: b.y
      }
    );
  }


  document.body.appendChild(
		element('svg', {
			id: 'output',
			preserveAspectRatio: 'none',
			viewBox: [
				boundingBox.min.x, boundingBox.min.y,
				boundingBox.getSize().x, boundingBox.getSize().y
			].join(' ')
		}, [
			element('g', {stroke: 'red', 'stroke-width': 0.15}, cuts.map(segment)),
			element('g', {stroke: 'blue', 'stroke-width': 0.15}, folds.map(segment)),
			element('g', {stroke: 'red', 'stroke-width': 0.05, fill: 'transparent'},
				stars.map(({radius, x, y}) => element('circle', {cx: x, cy: y, r: radius}))
			),
			element('g', {id: 'asterisms-groups'},
        Object.keys(asterisms).map(name =>
          element('g', {id: `${name}-lines`, stroke: '#660000', 'stroke-width': 0.1},
          [].concat(...asterisms[name])
            .reduce(PAIR, [[]])
            .map(segment)
          )
        )
			)
		])
	);
}
