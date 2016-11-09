// geometry
import {BoxGeometry, DodecahedronGeometry, IcosahedronGeometry, TetrahedronGeometry, OctahedronGeometry} from 'three';
import {Geometry, LineSegments, Points} from 'three';

// core
import {Object3D, Scene, WebGLRenderer} from 'three';
import {GridHelper, PerspectiveCamera} from 'three';

// math
import {Matrix4, Plane, Ray, Vector3} from 'three';

// material
import {Color, LineBasicMaterial, PointsMaterial} from 'three';

import {intersectPolygons, rayFromAngles} from './stuff';
import {OrbitControls} from './OrbitControls';
// import bsc from './catalogs/bsc_filtered.json';
import hd from './catalogs/hd_filtered.json';
import asterisms from './catalogs/asterisms.json';
// import spiraltest from './catalogs/spiraltest.js';
import {getTopology, travel, projectVector, projectLineSegment} from './geometry/topology';
import {getGeometryNet} from './geometry/nets';
import * as svg from './svg';

let connectedStars = new Set([].concat(...asterisms.map(a => a.stars)));

const FRONT = new Vector3(0,0,1);
var scene, renderer, camera;
var controls;
var root;
// var d12 = new TetrahedronGeometry(10);
// var d12 = new BoxGeometry(10, 10, 10);
// var d12 = new OctahedronGeometry(10);
var d12 = new DodecahedronGeometry(10);
// var d12 = new IcosahedronGeometry(10);


var topology = getTopology(d12);

let pointMeshes = topology.polygons.map(() => Object.assign(new Geometry(), {vertices: []}));


function vectorFromAngles(theta, phi) {
	return new Vector3(
		Math.sin(phi) * Math.sin(theta),
		Math.cos(phi),
		Math.sin(phi) * Math.cos(theta)
	).normalize();
}

let stars =
	hd.filter(star => star.mag <= 5.5 || connectedStars.has(star.hd)).map(s => ({xno: s.hd, sdec0: s.decrad - Math.PI/2, sra0: s.rarad, mag: s.mag * 100}))
//bsc.filter(star => star.mag < 350).map(s => Object.assign({}, s, {sdec0: s.sdec0 - Math.PI/2}))
// spiraltest
	// .map(({xno, sra0, sdec0, mag}) => Object.assign({xno, mag}, intersectPolygons(rayFromAngles(sra0, sdec0), topology.polygons) || {}))
	.map(({xno, sra0, sdec0, mag}) => Object.assign({xno, mag}, projectVector(vectorFromAngles(sra0, sdec0), topology	) || {}))
	// .filter(({polygon}) => polygon)
	// .map(({polygon, point}) => {
	// 	pointMeshes[polygon.index].vertices.push(point);
	// 	return point;
	// });

stars.forEach(({polygon, point}) => pointMeshes[polygon.index].vertices.push(point));

let PAIR = (pairs, val) => {
	let pair = pairs[pairs.length-1];
	if (pair.length > 1) pairs.push(pair = []);
	pair.push(val);
	return pairs;
};

function mapAsterism(asterism) {
	return asterism.stars.reduce(PAIR, [[]]).map(pair =>
		projectLineSegment(...pair.map(id => stars.find(s => s.xno === id)))
	);
}

// console.log('catalog size', bsc.length);
console.log('mapped stars', stars.length);

init();
animate();

function init()
{
	renderer = new WebGLRenderer( {antialias:true} );
	var width = window.innerWidth;
	var height = window.innerHeight;
	renderer.setSize (width, height);
	document.body.appendChild (renderer.domElement);

	scene = new Scene();

	// pointMeshes.forEach((mesh, i) => {
	// 	let obj = new Points(
	// 		mesh,
	// 		new PointsMaterial({
	// 			color: new Color(`hsl(${i * hueStep % 360}, 90%, 80%)`).multiply(new Color(0xff9999)),
	// 			size: 0.06125
	// 		})
	// 	);
	// 	// scene.add(obj);
	// });

	camera = new PerspectiveCamera (85, width/height, 1, 10000);
  camera.position.x = 0;
	camera.position.y = 0;
	camera.position.z = 40;
	camera.lookAt (new Vector3(0,0,0));
  controls = new OrbitControls (camera, renderer.domElement);

	scene.add(new GridHelper(12, 6, new Color(0xff0000), new Color(0xaa4444)));

	let net = getGeometryNet(topology);
	let tree = travel(topology.polygons[0].edges[0], net);

	let flattenedPolygons = {};
	let projectedAsterisms = [].concat(...asterisms.map(mapAsterism)).reduce((map, lines) => {
		lines.forEach(line => {
			if (!map[line.polygon]) map[line.polygon] = [];
			map[line.polygon].push(...line.edge);
		});
		return map;
	}, {});

	function build(tree, parent=null) {
		let node = tree.node,
			points = pointMeshes[node.poly.index].vertices,
			vertices = points.map(v => v.clone()),
			object = new Object3D(),
			offsetNode = new Object3D(),
			fold = parent && node.edge,
			cuts = node.poly.edges.filter(e => e !== fold && tree.children.every(c => c.node.edge.id !== e.id));

		offsetNode.position.sub(node.edge.point);
		offsetNode.userData.polygon = node.poly.index;

		object.userData.pivot = node.edge.vector;
		object.rotateOnAxis(node.edge.vector, topology.dihedral);
		object.position.sub(parent ? parent.edge.point : new Vector3()).add(node.edge.point);

		let flattened = flattenedPolygons[node.poly.index] = {
			index: node.poly.index,
			matrix: offsetNode.matrixWorld,
			edgeFold: fold && fold.id.split('-').map(n => topology.vertices[Number(n)].clone()) || [],
			edgeCuts: cuts.map(e => e.id.split('-').map(n => topology.vertices[Number(n)].clone())),
			lines: projectedAsterisms[node.poly.index] || []
		}

		return object.add(
			offsetNode.add(
				new Points(Object.assign(new Geometry(), {vertices}), new PointsMaterial({color: 0xffffff, size:0.125})),
				new LineSegments(Object.assign(new Geometry(), {vertices: flattened.edgeFold}), new LineBasicMaterial({color: 0x660000, linewidth: 2})),
				Object.assign(new LineSegments(Object.assign(new Geometry(), {vertices: [].concat(...flattened.edgeCuts)}), new LineBasicMaterial({color: 0xff0000, linewidth: 2})), {userData: {type: 'cut'}}),
				Object.assign(new LineSegments(Object.assign(new Geometry(), {vertices: flattened.lines}), new LineBasicMaterial({color: 0x660000})))
			),
			...tree.children.slice(0).map(child => build(child, node))
		);
	}

	root = build(tree);
	root.rotation.set(0,0,0);



	let top = tree.node.poly,
		angle = top.normal.angleTo(FRONT),
		cross = new Vector3().crossVectors(top.normal, FRONT).normalize(),
		rotation = new Matrix4().makeRotationAxis(cross, angle);

	root.applyMatrix(rotation);
	root.updateMatrixWorld();
	console.log(root);

	scene.add(root);

	let edgeCuts = [].concat(...Object.keys(flattenedPolygons).map(i => flattenedPolygons[i]).map(p => p.edgeCuts.map(e => e.map(v => v.clone().applyMatrix4(p.matrix))))),
		edgeFolds = Object.keys(flattenedPolygons).map(i => flattenedPolygons[i]).map(p => p.edgeFold.map(v => v.clone().applyMatrix4(p.matrix))).filter(n => n.length),
		asterismLines = [].concat(...Object.keys(flattenedPolygons).map(i => flattenedPolygons[i]).map(p => p.lines.map(v => v.clone().applyMatrix4(p.matrix))).filter(n => n.length)),
		boundingBox = edgeCuts.reduce(({min, max}, edge) => {
			return{
				min: {x: Math.min(min.x, ...edge.map(p => p.x)), y: Math.min(min.y, ...edge.map(p => p.y))},
				max: {x: Math.max(max.x, ...edge.map(p => p.x)), y: Math.max(max.y, ...edge.map(p => p.y))}
			};
		}
		, {
			min: {x: Infinity, y: Infinity},
			max: {x: -Infinity, y: -Infinity}
		});

	scene.add(
		new LineSegments(
			Object.assign(
				new Geometry(),
				{vertices: [].concat(...edgeCuts)}
			)
		)
	);

	boundingBox.min = new Vector3(boundingBox.min.x, boundingBox.min.y, 0);
	boundingBox.max = new Vector3(boundingBox.max.x, boundingBox.max.y, 0);
	boundingBox.range = new Vector3().subVectors(boundingBox.max, boundingBox.min);

	document.body.appendChild(
		svg.element('svg', {
			id: 'output',
			preserveAspectRatio: 'none',
			viewBox: [
				boundingBox.min.x, boundingBox.min.y,
				boundingBox.range.x, boundingBox.range.y
			].join(' ')
		}, [
			svg.element('g', {stroke: 'red', 'stroke-width': 0.15},
				edgeCuts.map(([a, b]) => svg.element('line', {x1: a.x, y1: a.y, x2: b.x, y2: b.y}))
			),
			svg.element('g', {stroke: 'blue', 'stroke-width': 0.15},
				edgeFolds.map(([a, b]) => svg.element('line', {x1: a.x, y1: a.y, x2: b.x, y2: b.y}))
			),
			svg.element('g', {stroke: 'red', 'stroke-width': 0.05, fill: 'transparent'},
				stars.map(({polygon, mag, point}) => {
					let matrix = (flattenedPolygons[polygon.index] || {}).matrix || new Matrix4(),
						size = Math.max(0.1, (1 - mag / 350)) * 0.25 + .1,
						{x, y} = point.clone().applyMatrix4(matrix);

					return svg.element('circle', {cx: x, cy: y, r: size});
				})
			),
			svg.element('g', {stroke: '#660000', 'stroke-width': 0.1},
				asterismLines
					.reduce(PAIR, [[]])
					.map(([a, b]) =>
						svg.element('line', {x1: a.x, y1: a.y, x2: b.x, y2: b.y})
					)
			)
		])
	);

	window.addEventListener ('resize', onWindowResize, false);
}


function onWindowResize ()
{
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize (window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
}

let animationEnabled = false

let t = 0;
function animate()
{
	let angle = (Math.sin(t) + 1) * 0.5 * topology.dihedral;
	t += 0.0125;
	root.traverse(node => {
		if (node === root) return;
		if (!node.userData.pivot) return;
		node.rotation.set(0, 0, 0);
		node.rotateOnAxis(node.userData.pivot, angle);
	});
	controls.update();
	renderer.render (scene, camera);
	if (animationEnabled) requestAnimationFrame ( animate );
}

window.addEventListener('keydown', e => {
	if (e.keyCode !== 32) return;
	animationEnabled = !animationEnabled;
	animationEnabled && animate();
});
