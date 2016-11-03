import {BoxGeometry, DodecahedronGeometry, IcosahedronGeometry, TetrahedronGeometry, OctahedronGeometry} from 'three';
import {AxisHelper, Object3D, Color, Geometry, GridHelper, Matrix4, LineSegments, LineBasicMaterial, LineDashedMaterial, Mesh, MeshBasicMaterial, PerspectiveCamera, PointLight, Points, PointsMaterial, Quaternion, Raycaster, Scene, Vector2, Vector3, WebGLRenderer} from 'three';
import {getGeometryMetadata, intersectPolygons, rayFromAngles, travel} from './stuff';
import {OrbitControls} from './OrbitControls';
import bsc from './catalogs/bsc_filtered.json';
// import spiraltest from './catalogs/spiraltest.js';
import {getTopology} from './geometry/topology';
import {getGeometryNet} from './geometry/nets';

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
// var geometryMeta = getGeometryMetadata(d12);
// const DIHEDRAL = geometryMeta.polygons[0].normal.angleTo(geometryMeta.polygons[0].edges[0].shared.poly.normal);
console.log(topology);

let pointMeshes = topology.polygons.map(() => Object.assign(new Geometry(), {vertices: []}));


bsc.filter(star => star.mag < 350).map(s => Object.assign({}, s, {sdec0: s.sdec0 - Math.PI/2}))
// spiraltest
	.map(({sra0, sdec0}) => intersectPolygons(rayFromAngles(sra0, sdec0), topology.polygons))
	.filter(intersection => intersection)
	.map(({polygon, point}) => {
		pointMeshes[polygon.index].vertices.push(point);
		return point;
	});

console.log('catalog size', bsc.length);
console.log('mapped stars', pointMeshes.map(m => m.vertices.length).reduce((a,b) => a+b))

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

	function build(tree, offset=new Vector3()) {
		let node = tree.node,
			points = pointMeshes[node.poly.index].vertices,
			vertices = points.map(v => v.clone()),
			object = new Object3D(),
			offsetNode = new Object3D();

		offsetNode.position.sub(node.edge.point);

		object.userData.pivot = node.edge.vector;
		object.rotateOnAxis(node.edge.vector, topology.dihedral);
		object.position.sub(offset).add(node.edge.point);

		let fold = node.edge.id.split('-').map(n => topology.vertices[Number(n)].clone()),
			cuts = [].concat(
				...node.poly.edges
					.filter(e => e.id !== node.edge.id)
					.filter(e => tree.children.every(c => c.node.edge.id !== e.id))
					.map(e => e.id.split('-').map(n => topology.vertices[Number(n)].clone()))
			);

		return object.add(
			offsetNode.add(
				new Points(Object.assign(new Geometry(), {vertices}), new PointsMaterial({color: 0xffffff, size:0.125})),
				new LineSegments(Object.assign(new Geometry(), {vertices: fold}), new LineBasicMaterial({color: 0x660000, linewidth: 2})),
				Object.assign(new LineSegments(Object.assign(new Geometry(), {vertices: cuts}), new LineBasicMaterial({color: 0xff0000, linewidth: 2})), {userData: {type: 'cut'}})
			)
			,
			...tree.children.slice(0).map(child => build(child, node.edge.point))
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

	function bakeDescendantTransformations(object, include) {
		return [].concat(
			...(include(object) ? object.geometry.vertices.map(v => v.clone().applyMatrix4(object.matrixWorld)) : []),
			...(object.children.map(c => bakeDescendantTransformations(c, include)))
		);
	}

	scene.add(root);


	let
		baked = new Points(
			Object.assign(
				new Geometry(),
				{vertices: bakeDescendantTransformations(root, n => n.type === 'Points')}
			),
			new PointsMaterial({color: 0xff0000, size: 0.06125})
		);

	baked.geometry.computeBoundingBox();
	// scene.add(baked);

	let svg = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
	svg.setAttribute('id', 'output')
	document.body.appendChild(svg);

	let bakedEdges = new LineSegments(
		Object.assign(
			new Geometry(),
			{vertices: bakeDescendantTransformations(root, n => n.type === 'LineSegments' && n.userData.type === 'cut')}
		)
	);
	scene.add(bakedEdges);
	bakedEdges.geometry.computeBoundingBox();
	console.log(bakedEdges.geometry.vertices);
	bakedEdges.geometry.vertices
		.reduce((pairs, point) => {if (!pairs.length || pairs[pairs.length-1].length === 2) pairs.push([]); pairs[pairs.length-1].push(point); return pairs;}, [])
		.forEach(([v1, v2]) => {
			let line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
			line.setAttribute('x1', 400 * (v1.x - bakedEdges.geometry.boundingBox.min.x) / (bakedEdges.geometry.boundingBox.max.x - bakedEdges.geometry.boundingBox.min.x));
			line.setAttribute('x2', 400 * (v2.x - bakedEdges.geometry.boundingBox.min.x) / (bakedEdges.geometry.boundingBox.max.x - bakedEdges.geometry.boundingBox.min.x));
			line.setAttribute('y1', 300 * (v1.y - bakedEdges.geometry.boundingBox.min.y) / (bakedEdges.geometry.boundingBox.max.y - bakedEdges.geometry.boundingBox.min.y));
			line.setAttribute('y2', 300 * (v2.y - bakedEdges.geometry.boundingBox.min.y) / (bakedEdges.geometry.boundingBox.max.y - bakedEdges.geometry.boundingBox.min.y));
			line.setAttribute('stroke', 'red');
			svg.appendChild(line);
		});

	bakeDescendantTransformations(root, n => n.type === 'LineSegments' && n.userData.type !== 'cut')
		.reduce((pairs, point) => {if (!pairs.length || pairs[pairs.length-1].length === 2) pairs.push([]); pairs[pairs.length-1].push(point); return pairs;}, [])
		.forEach(([v1, v2]) => {
			let line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
			line.setAttribute('x1', 400 * (v1.x - bakedEdges.geometry.boundingBox.min.x) / (bakedEdges.geometry.boundingBox.max.x - bakedEdges.geometry.boundingBox.min.x));
			line.setAttribute('x2', 400 * (v2.x - bakedEdges.geometry.boundingBox.min.x) / (bakedEdges.geometry.boundingBox.max.x - bakedEdges.geometry.boundingBox.min.x));
			line.setAttribute('y1', 300 * (v1.y - bakedEdges.geometry.boundingBox.min.y) / (bakedEdges.geometry.boundingBox.max.y - bakedEdges.geometry.boundingBox.min.y));
			line.setAttribute('y2', 300 * (v2.y - bakedEdges.geometry.boundingBox.min.y) / (bakedEdges.geometry.boundingBox.max.y - bakedEdges.geometry.boundingBox.min.y));
			line.setAttribute('stroke', 'blue');
			svg.appendChild(line);
		});

	bakeDescendantTransformations(root, n => n.type === 'Points')
		.forEach(({x, y}) => {
			let point = document.createElementNS("http://www.w3.org/2000/svg", 'circle');
			point.setAttribute('cx', 400 * (x - bakedEdges.geometry.boundingBox.min.x) / (bakedEdges.geometry.boundingBox.max.x - bakedEdges.geometry.boundingBox.min.x));
			point.setAttribute('cy', 300 * (y - bakedEdges.geometry.boundingBox.min.y) / (bakedEdges.geometry.boundingBox.max.y - bakedEdges.geometry.boundingBox.min.y));
			point.setAttribute('r', Math.random() * 2);
			point.setAttribute('stroke', 'red');
			point.setAttribute('stroke-width', '0.5');
			point.setAttribute('fill', 'transparent');
			svg.appendChild(point);
		})

	window.addEventListener ('resize', onWindowResize, false);
}


function onWindowResize ()
{
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize (window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
}

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
   requestAnimationFrame ( animate );
	renderer.render (scene, camera);
}
