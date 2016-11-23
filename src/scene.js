import debounce from 'debounce';
import hull from 'convexhull-js';

// geometry
import {DodecahedronGeometry} from 'three';
import {Mesh, Geometry, LineSegments, Points} from 'three';

// core
import {Object3D, Scene, WebGLRenderer} from 'three';
import {PerspectiveCamera} from 'three';

// math
import {Matrix4, Vector3} from 'three';

// material
import {MeshBasicMaterial, LineBasicMaterial, PointsMaterial, DoubleSide} from 'three';

import {OrbitControls} from './OrbitControls';
// import bsc from './catalogs/bsc_filtered.json';
import catalog from './catalogs/hd_filtered.json';
import asterisms from './catalogs/asterisms.json';
// import spiraltest from './catalogs/spiraltest.js';
import {getTopology, travel, projectVector, projectLineSegment} from './geometry/topology';
import {getGeometryNet} from './geometry/nets';
import * as svg from './svg';

asterisms.forEach(asterism => {
	asterism.starCounts = [].concat(...asterism.stars)
		.reduce((index, id) => (index[id] = (index[id] || 0) + 1, index), {});
});

let connectedStars = new Set([].concat(...asterisms.map(a => a.stars)));

var scene, renderer, camera;
var controls;

var topology = getTopology(new DodecahedronGeometry(10));

let pointMeshes = topology.polygons.map(() => Object.assign(new Geometry(), {vertices: []}));


function vectorFromAngles(theta, phi) {
	return new Vector3(
		Math.sin(phi) * Math.sin(theta),
		Math.cos(phi),
		Math.sin(phi) * Math.cos(theta)
	).normalize();
}

let stars = catalog
	.filter(star => star.mag <= 7 || connectedStars.has(star.hd))
	.map(s => ({xno: s.hd, sdec0: s.decrad - Math.PI/2, sra0: s.rarad, mag: s.mag}))
	.map(({xno, sra0, sdec0, mag}) => Object.assign(
		{xno, mag}, projectVector(vectorFromAngles(sra0, sdec0), topology))
	);

stars.forEach(({polygon, point}) => pointMeshes[polygon.index].vertices.push(point));

let PAIR = (pairs, val) => {
	let pair = pairs[pairs.length-1];
	if (pair.length > 1) pairs.push(pair = []);
	pair.push(val);
	return pairs;
};

function mapAsterism(asterism) {
	return Object.assign(
		{}, asterism,
		{segments: asterism.stars
				.reduce(PAIR, [[]])
				.map(pair =>
					projectLineSegment(
						topology,
						...pair.map(id => stars.find(s => s.xno === id).point)
					)
				)
		}
	);
}

init();
render();

function init()
{
	renderer = new WebGLRenderer( {antialias:true} );
	var width = window.innerWidth;
	var height = window.innerHeight;
	renderer.setSize (width, height);
	document.body.appendChild (renderer.domElement);

	scene = new Scene();
	scene.userData.animate = false;
	scene.userData.time = 0;

	camera = new PerspectiveCamera (85, width/height, 1, 10000);
  camera.position.x = 0;
	camera.position.y = 0;
	camera.position.z = 20;
	camera.lookAt (new Vector3(0,0,0));
  controls = new OrbitControls (camera, renderer.domElement);

	let tree = travel(topology.polygons[0].edges[0], getGeometryNet(topology));

	let flattenedPolygons = {};
	let projectedAsterisms = asterisms
		.filter(a => a.stars.length > 4)
		.filter(a => Math.max(
			...Object.keys(a.starCounts)
				.map(id => a.starCounts[id])
			) > 3)
		.map(mapAsterism)
		.map(asterism => ({name: asterism.name, segments: asterism.segments.reduce((map, lines) => {
			lines.forEach(line => {
				if (!map[line.polygon]) map[line.polygon] = [];
				map[line.polygon].push(...line.edge);
			});
			return map;
		}, {})}));

	console.log('known asterisms', asterisms.length);
	console.log('projected asterisms', projectedAsterisms.length);

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
		object.userData.animate = t => {
			let alpha = 0.5 * (Math.sin(-Math.PI / 2 + t / 1000) + 1);
			let angle = alpha * topology.dihedral;
			object.rotation.set(0, 0, 0);
			object.rotateOnAxis(object.userData.pivot, angle);
		}

		object.rotateOnAxis(node.edge.vector, topology.dihedral);
		object.position.sub(parent ? parent.edge.point : new Vector3()).add(node.edge.point);

		let flattened = flattenedPolygons[node.poly.index] = {
			index: node.poly.index,
			matrix: offsetNode.matrixWorld,
			edgeFold: fold && fold.id.split('-').map(n => topology.vertices[Number(n)].clone()) || [],
			edgeCuts: cuts.map(e => e.id.split('-').map(n => topology.vertices[Number(n)].clone())),
			lines: projectedAsterisms.filter(({segments}) => segments[node.poly.index])
		};

		return object.add(
			offsetNode.add(
				new Points(Object.assign(new Geometry(), {vertices}), new PointsMaterial({color: 0xffffff, size:0.125})),
				new LineSegments(Object.assign(new Geometry(), {vertices: flattened.edgeFold}), new LineBasicMaterial({color: 0x660000, linewidth: 2})),
				Object.assign(new LineSegments(Object.assign(new Geometry(), {vertices: [].concat(...flattened.edgeCuts)}), new LineBasicMaterial({color: 0xff0000, linewidth: 2})), {userData: {type: 'cut'}}),
				...flattened.lines.map(({name, segments}) =>
					Object.assign(
						new LineSegments(Object.assign(new Geometry(), {vertices: segments[node.poly.index]}), new LineBasicMaterial({color: 0x660000})),
						{userData: {asterism: name}}
					)
				),
				new Mesh(
					Object.assign(new Geometry(), {vertices: topology.vertices.slice(), faces: node.poly.faces.slice()}),
					new MeshBasicMaterial({color: 0x440000, transparent: true, opacity: 0.6, side: DoubleSide})
				)
			),
			...tree.children.slice(0).map(child => build(child, node))
		);
	}

	let root = build(tree);
	root.rotation.set(0,0,0);
	root.userData.animate = t => {
		let alpha = 0.5 * (Math.sin(-Math.PI / 2 + t / 1000) + 1);
		root.position.z = (1 - alpha) * -topology.faceRadius;
	}

	// rotate "top" face to point away from camera so that it appears to unfold
	// into a two dimensional image from the viewer's perspective.
	let back = new Vector3(0, 0, -1);
	let top = tree.node.poly,
		angle = top.normal.angleTo(back),
		cross = new Vector3().crossVectors(top.normal, back).normalize(),
		rotation = new Matrix4().makeRotationAxis(cross, angle);

	root.applyMatrix(rotation);
	root.updateMatrixWorld();

	// generate a hull around the flattened mesh to determine how it can be
	// aligned to the X axis.
	let edgeHull = hull(
		[].concat(
			...[].concat(
				...Object.keys(flattenedPolygons)
					.map(i => flattenedPolygons[i])
					.map(p => p.edgeCuts.map(
						e => e.map(v => v.clone().applyMatrix4(p.matrix))
					))
			)
		)
	).map((v, i, points) => ([v, points[(i+1) % points.length]]));

	let longestEdge = edgeHull.map(([a, b]) => a.clone().sub(b)).reduce((a, b) => b.lengthSq() > a.lengthSq() ? b : a),
		aaRotation = longestEdge.angleTo(new Vector3(1, 0, 0));

	root.applyMatrix(new Matrix4().makeRotationAxis(new Vector3(0, 0, 1), -aaRotation));
	root.updateMatrixWorld();
	root.position.add(top.edges[0].point.clone().applyMatrix4(root.matrixWorld));

	scene.add(root);

	let edgeCuts = [].concat(...Object.keys(flattenedPolygons).map(i => flattenedPolygons[i]).map(p => p.edgeCuts.map(e => e.map(v => v.clone().applyMatrix4(p.matrix))))),
		edgeFolds = Object.keys(flattenedPolygons).map(i => flattenedPolygons[i]).map(p => p.edgeFold.map(v => v.clone().applyMatrix4(p.matrix))).filter(n => n.length),
		asterismLines = projectedAsterisms.map(({name, segments}) => ({name, lines: [].concat(...Object.keys(segments).map(p => segments[p].map(v => v.clone().applyMatrix4(flattenedPolygons[p].matrix))))})),
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
						size = Math.max(0.1, (1 - mag / 7)) * 0.25 + .1,
						{x, y} = point.clone().applyMatrix4(matrix);

					return svg.element('circle', {cx: x, cy: y, r: size});
				})
			),
			svg.element('g', {id: 'asterisms-groups'},
				asterismLines.map(({name, lines}) =>
					svg.element('g', {id: `${name}-lines`, stroke: '#660000', 'stroke-width': 0.1},
						lines
							.reduce(PAIR, [[]])
							.map(([a, b]) =>
								svg.element('line', {x1: a.x, y1: a.y, x2: b.x, y2: b.y})
							)
					)
				)
			)
		])
	);

	let list = document.createElement('ul');
	list.setAttribute('id', 'asterisms');
	document.body.appendChild(list);
	projectedAsterisms.forEach(({name}) => {
		let node = document.createElement('li');
		node.innerText = name;
		list.appendChild(node);
	});

	list.addEventListener('mouseover', e => {
		let target = e.target.innerText;
		scene.traverse(node => {
			if (!node.userData.asterism) return;
			node.material = node.userData.asterism === target
				? new LineBasicMaterial({color: 0xffff00})
				: new LineBasicMaterial({color: 0x660000});
		});

		[].slice.call(document.querySelectorAll(`svg g#asterisms-groups > g:not([stroke="transparent"])`))
			.forEach(element => element.setAttribute('stroke', '#660000'));
		document.querySelector(`svg g[id="${target}-lines"]`).setAttribute('stroke', '#ff7700');

		animate();
	});

	list.addEventListener('click', e => {
		let target = e.target.innerText;
		e.target.classList.toggle('disabled');
		scene.traverse(node => {
			if (node.userData.asterism !== target) return;
			node.visible = !e.target.classList.contains('disabled');
			document.querySelector(`svg g[id="${target}-lines"]`).setAttribute(
				'stroke', node.visible ? '#660000' : 'transparent'
			);
		});

		animate();
	});

	window.addEventListener ('resize', onWindowResize, false);
}


function onWindowResize ()
{
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize (window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
}

let animate;

function render() {
	scene.traverse(node => {
		if (typeof node.userData.animate !== 'function') return;
		node.userData.animate(scene.userData.time);
	});

	renderer.render(scene, camera);

	if (scene.userData.animate) {
		scene.userData.time += 16;
		requestAnimationFrame (animate);
	}
}

animate = debounce(render, 16);
controls.addEventListener('change', animate);

renderer.domElement.addEventListener('click', () => {
	scene.userData.animate = !scene.userData.animate;
	scene.userData.animate && animate();
});
