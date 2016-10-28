import {DodecahedronGeometry} from 'three';
import {AxisHelper, Object3D, Color, Geometry, GridHelper, Matrix4, LineSegments, LineBasicMaterial, LineDashedMaterial, Mesh, PerspectiveCamera, PointLight, Points, PointsMaterial, Quaternion, Raycaster, Scene, Vector2, Vector3, WebGLRenderer} from 'three';
import {getGeometryMetadata, intersectPolygons, rayFromAngles, travel} from './stuff';
import {OrbitControls} from './OrbitControls';
import bsc from './catalogs/bsc.json';
import {GeometryHighlighter} from './highlighter';

var scene, renderer, camera;
var controls;

var d12 = new DodecahedronGeometry(10);
// var d12 = new BoxGeometry(10,10,10);
var geometryMeta = getGeometryMetadata(d12);
console.log(geometryMeta);

let pointMeshes = geometryMeta.polygons.map(() => Object.assign(new Geometry(), {vertices: []}));


let starsAsVertices = bsc
	.map(({sra0, sdec0}) => intersectPolygons(rayFromAngles(sra0, sdec0), geometryMeta.polygons))
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


	let highlighter = new GeometryHighlighter(geometryMeta, scene);
	var hueStep = Math.max(Math.round(360 / pointMeshes.length), 40),
		lightStep = 360/hueStep;



	pointMeshes.forEach((mesh, i) => {
		let obj = new Points(
			mesh,
			new PointsMaterial({
				color: new Color(`hsl(${i * hueStep % 360}, 90%, 80%)`).multiply(new Color(0xff9999)),
				size: 0.06125
			})
		);
		// scene.add(obj);
	});

	camera = new PerspectiveCamera (85, width/height, 1, 10000);
  camera.position.x = 0;
	camera.position.y = 0;
	camera.position.z = 40;
	camera.lookAt (new Vector3(0,0,0));

    controls = new OrbitControls (camera, renderer.domElement);

	scene.add(new GridHelper(12, 6, new Color(0xff0000), new Color(0xaa4444)));

  var lights = [];
  lights[ 0 ] = new PointLight( 0xffffff, 1, 0 );
  lights[ 1 ] = new PointLight( 0xff00ff, 1, 0 );
  lights[ 2 ] = new PointLight( 0x0000ff, 1, 0 );

  lights[ 0 ].position.set( 0, 200, 0 );
  lights[ 1 ].position.set( 100, 200, 100 );
  lights[ 2 ].position.set( - 100, - 200, - 100 );

  // scene.add( lights[ 0 ] );
  scene.add( lights[ 1 ] );
  scene.add( lights[ 2 ] );

	// function highlight(cycle, i=0, delay=600) {
	// 	highlighter.highlight(cycle[i].index);
	// 	setTimeout(() => highlight(cycle, (i+1) % cycle.length, delay), delay);
	// }

	// let tree = travel(
	// 	geometryMeta.polygons[0].edges[0], [
	// 		{index: 0},
	// 		{index: 1},
	// 		{index: 2},
	// 		{index: 3},
	// 		{index: 4, next: [
	// 			{offset: -2, next: [
	// 				{offset: 2, next: [
	// 					{offset: 1},
	// 					{offset: 2},
	// 					{offset: 3},
	// 					{offset: 4}
	// 				]}
	// 			]}
	// 		]}
	// 	]
	// );
	let tree = travel(
		geometryMeta.polygons[0].edges[0], [
			{index: 0, next: [
				{offset: 1},
				{offset: 2},
				{offset: 3},
				{offset: 4},
			]},
			{index: 3, next: [
				{offset: 2, next: [
					{offset: 1},
					{offset: 2},
					{offset: 3},
					{offset: 4},
				]}
			]}
		]
	);

	console.log('tree', tree);

	function flatten(root) {
		return [].concat(root.node, ...(root.children || []).map(flatten))
	}

	function edgesToGeometry(edges, vertices) {
		return Object.assign(
			new Geometry(), {
				vertices: [].concat(...edges.map(e => e.id.split('-'))).map(n => vertices[n].clone())
			}
		)
	}

	let flat = flatten(tree);
	let edges = flat.map(node => node.edge.id),
		cuts = edgesToGeometry(geometryMeta.edges.filter(e => edges.indexOf(e.id) === -1), geometryMeta.vertices),
		folds = edgesToGeometry(geometryMeta.edges.filter(e => edges.indexOf(e.id) !== -1), geometryMeta.vertices);

	cuts.computeLineDistances();
	folds.computeLineDistances();

	scene.add(new LineSegments(cuts, new LineDashedMaterial({color: 0xff0000, linewidth: 2.5, dashSize: 0.5, gapSize: 0.125})));
	scene.add(new LineSegments(folds, new LineDashedMaterial({color: 0x660000, linewidth: 2.75, dashSize: 0.5, gapSize: 0.125})));
	// scene.add(new AxisHelper(10));

	let FRONT = new Vector3(0, 0, 1);
	// flat.forEach(({poly}, i) => {
	// 	let angle = poly.normal.angleTo(FRONT),
	// 		cross = new Vector3().crossVectors(poly.normal, FRONT).normalize(),
	// 		rotation = new Matrix4().makeRotationAxis(cross, angle),
	// 		points = pointMeshes[poly.index].vertices.slice().map(p => p.clone().sub(poly.center).applyMatrix4(rotation)),
	// 		object = new Points(
	// 			Object.assign(new Geometry(), {vertices: points}),
	// 			new PointsMaterial({color: 'white', size: 0.06125})
	// 		);
	//
	// 	object.scale.set(0.3, 0.3, 0.3);
	// 	object.position.set(-7.5 + (i % 4) * 5, -5 + Math.floor(i / 4) * 4, 0);
	// 	scene.add(object);
	// });

	function pointsFromVerts(vertices) {
		return new Points(
			Object.assign(new Geometry(), {vertices}),
			new PointsMaterial({color: 0xffff00, size: 0.06125})
		);
	}

	const DIHEDRAL = Math.atan(2);
	function addChild(obj, tree, index, offset=new Vector3()) {
		let node = tree.children[index].node,
			rotation = new Matrix4().makeRotationAxis(node.edge.vector, DIHEDRAL),
			vertices = pointMeshes[node.poly.index].vertices
				.map(v => v.clone());

		let child = new Object3D();

		vertices = vertices.map(v => v.sub(node.edge.point));
		child.applyMatrix(rotation);
		child.position.sub(offset).add(node.edge.point);

		child.add(
			new AxisHelper(2),
			pointsFromVerts(vertices),
			new LineSegments(
				Object.assign(
					new Geometry(),
					{vertices: node.edge.id.split('-').map(n => geometryMeta.vertices[Number(n)].clone().sub(node.edge.point))}
				),
				new LineBasicMaterial({color: 0x0000ff, linewidth: 3})
			)
		);
		obj.add(child);

		return child;
	}

	function build(tree, offset=new Vector3(), angle) {
		let node = tree.node,
			points = pointMeshes[node.poly.index].vertices,
			vertices = points.map(v => v.clone().sub(node.edge.point)),
			object = new Object3D();

			object.rotateOnAxis(node.edge.vector, angle);
			object.position.sub(offset).add(node.edge.point);

			return object.add(
				new Points(Object.assign(new Geometry(), {vertices}), new PointsMaterial({color: 0xffffff, size:0.06125})),
				...tree.children.slice(0).map(child => build(child, node.edge.point, DIHEDRAL))
			);
	}
	let offset = tree.node.edge.point.clone();
	let root = build(tree, offset.negate(), DIHEDRAL);
	root.rotation.set(0,0,0);
	root.position.add(offset);
	// let root = pointsFromVerts(pointMeshes[tree.node.poly.index].vertices.map(v => v.clone()));
	// addChild(root, tree, 0);
	// addChild(root, tree, 1);
	// addChild(root, tree, 2);
	// addChild(root, tree, 3);
	// let bridge = addChild(root, tree, 4);
	// let oppositeNode = tree.children[4].children[0].children[0],
	// 	opposite = addChild(
	// 		addChild(bridge, tree.children[4], 0, tree.children[4].node.edge.point),
	// 		tree.children[4].children[0], 0, tree.children[4].children[0].node.edge.point
	// 	);
	//
	// addChild(opposite, oppositeNode, 0, oppositeNode.node.edge.point);
	// addChild(opposite, oppositeNode, 1, oppositeNode.node.edge.point);
	// addChild(opposite, oppositeNode, 2, oppositeNode.node.edge.point);
	// addChild(opposite, oppositeNode, 3, oppositeNode.node.edge.point);
	//
	let top = tree.node.poly,
		angle = top.normal.angleTo(FRONT),
		cross = new Vector3().crossVectors(top.normal, FRONT).normalize(),
		rotation = new Matrix4().makeRotationAxis(cross, angle);

	root.applyMatrix(rotation);
	root.updateMatrixWorld();
	console.log(root);

	function bake(object) {
		return [].concat(
			...(object.type === 'Points' ? object.geometry.vertices.map(v => v.clone().applyMatrix4(object.matrixWorld)) : []),
			...(object.children.map(c => bake(c)))
		);
	}

	scene.add(
		new Points(
			Object.assign(new Geometry(), {vertices: bake(root)}),
			new PointsMaterial({color: 0xff0000, size: 0.06125})
		).rotateOnAxis(FRONT, Math.PI * 45/180)
	);


	highlighter.highlight(flat[0].poly.index);
	// highlight(flat.map(node => node.poly), 0, 1000);

	window.addEventListener ('resize', onWindowResize, false);

	let caster = new Raycaster(),
		mesh = new Mesh(d12);
	window.addEventListener('mousemove', e => {
		caster.setFromCamera(
			new Vector2(
				(e.clientX / window.innerWidth ) * 2 - 1,
				- (e.clientY / window.innerHeight ) * 2 + 1
			),
			camera
		);

		let intersection = caster.intersectObject(mesh, true).shift(),
			polygon = intersection && geometryMeta.polygons.find(p =>
				p.faces.find(f => f.normal === intersection.face.normal)
			);

		// polygon
		// 	? highlighter.highlight(polygon.index)
		// 	: highlighter.highlightNone();
	});
}


function onWindowResize ()
{
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize (window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
}

function animate()
{
	controls.update();
   requestAnimationFrame ( animate );
	renderer.render (scene, camera);
}
