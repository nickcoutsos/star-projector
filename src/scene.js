import {BoxGeometry, DodecahedronGeometry, IcosahedronGeometry, TetrahedronGeometry, OctahedronGeometry} from 'three';
import {Object3D, Color, Geometry, GridHelper, Matrix4, LineSegments, LineBasicMaterial, LineDashedMaterial, Mesh, MeshBasicMaterial, PerspectiveCamera, PointLight, Points, PointsMaterial, Quaternion, Raycaster, Scene, Vector2, Vector3, WebGLRenderer} from 'three';
import {intersectPolygons, rayFromAngles} from './stuff';
import {OrbitControls} from './OrbitControls';
import bsc from './catalogs/bsc_filtered.json';
// import spiraltest from './catalogs/spiraltest.js';
import {getTopology, travel} from './geometry/topology';
import {getGeometryNet} from './geometry/nets';
import * as svg from './svg';

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


let stars = bsc.filter(star => star.mag < 350).map(s => Object.assign({}, s, {sdec0: s.sdec0 - Math.PI/2}))
// spiraltest
	.map(({xno, sra0, sdec0, mag}) => Object.assign({xno, mag}, intersectPolygons(rayFromAngles(sra0, sdec0), topology.polygons) || {}))
	.filter(({polygon}) => polygon)
	// .map(({polygon, point}) => {
	// 	pointMeshes[polygon.index].vertices.push(point);
	// 	return point;
	// });

stars.forEach(({polygon, point}) => pointMeshes[polygon.index].vertices.push(point));

console.log('catalog size', bsc.length);
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
			edgeCuts: cuts.map(e => e.id.split('-').map(n => topology.vertices[Number(n)].clone()))
		}

		return object.add(
			offsetNode.add(
				new Points(Object.assign(new Geometry(), {vertices}), new PointsMaterial({color: 0xffffff, size:0.125})),
				new LineSegments(Object.assign(new Geometry(), {vertices: flattened.edgeFold}), new LineBasicMaterial({color: 0x660000, linewidth: 2})),
				Object.assign(new LineSegments(Object.assign(new Geometry(), {vertices: [].concat(...flattened.edgeCuts)}), new LineBasicMaterial({color: 0xff0000, linewidth: 2})), {userData: {type: 'cut'}})
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

	let output = svg.element('svg', {
		id: 'output',
		preserveAspectRatio: 'none',
		viewBox: [
			boundingBox.min.x, boundingBox.min.y,
			boundingBox.range.x, boundingBox.range.y
		].join(' ')
	});

	document.body.appendChild(output);

	edgeCuts.forEach(edge => output.appendChild(makeLine(...edge, 'red')));
	edgeFolds.forEach(edge => output.appendChild(makeLine(...edge, 'blue')));

	function makeLine(p1, p2, stroke) {
		let line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
		line.setAttribute('x1', p1.x);
		line.setAttribute('x2', p2.x);
		line.setAttribute('y1', p1.y);
		line.setAttribute('y2', p2.y);
		line.setAttribute('stroke', stroke);
		line.setAttribute('stroke-width', '0.1');
		return line;
	}

	function makePoint({x, y}, radius, stroke) {
		let point = document.createElementNS("http://www.w3.org/2000/svg", 'circle');
		point.setAttribute('cx', x);
		point.setAttribute('cy', y);
		point.setAttribute('r', radius);
		point.setAttribute('stroke', stroke);
		point.setAttribute('stroke-width', '0.05');
		point.setAttribute('fill', 'transparent');
		return point;
	}

	stars.forEach(star => {
		let matrix = (flattenedPolygons[star.polygon.index] || {}).matrix || new Matrix4(),
			size = (1 - star.mag / 350) * 0.25 + .1;


		output.appendChild(makePoint(star.point.clone().applyMatrix4(matrix), size, 'red'));
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
