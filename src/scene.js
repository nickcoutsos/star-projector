import {BoxGeometry, DodecahedronGeometry, IcosahedronGeometry} from 'three';
import {AxisHelper, Object3D, Color, Geometry, GridHelper, Matrix4, LineSegments, LineBasicMaterial, LineDashedMaterial, Mesh, PerspectiveCamera, PointLight, Points, PointsMaterial, Quaternion, Raycaster, Scene, Vector2, Vector3, WebGLRenderer} from 'three';
import {getGeometryMetadata, intersectPolygons, rayFromAngles, travel} from './stuff';
import {OrbitControls} from './OrbitControls';
import bsc from './catalogs/bsc_filtered.json';
import spiraltest from './catalogs/spiraltest.js';

// import {GeometryHighlighter} from './highlighter';

const FRONT = new Vector3(0,0,1);
var scene, renderer, camera;
var controls;
var root;
// var d12 = new BoxGeometry(10, 10, 10);
var d12 = new IcosahedronGeometry(10);
// var d12 = new BoxGeometry(10,10,10);


var geometryMeta = getGeometryMetadata(d12);
console.log(geometryMeta);

let pointMeshes = geometryMeta.polygons.map(() => Object.assign(new Geometry(), {vertices: []}));


bsc.filter(star => star.mag < 350).map(s => Object.assign({}, s, {sdec0: s.sdec0 - Math.PI/2}))
	.map(({sra0, sdec0}) => intersectPolygons(rayFromAngles(sra0, sdec0), geometryMeta.polygons))
	.filter(intersection => intersection)
	.map(({polygon, point}) => {
		pointMeshes[polygon.index].vertices.push(point);
		return point;
	});

console.log('catalog size', bsc.length);
console.log('mapped stars', pointMeshes.map(m => m.vertices.length).reduce((a,b) => a+b))

const DIHEDRAL = Math.acos(Math.sqrt(5) / 3);
// const DIHEDRAL = Math.atan(2);
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


	// let highlighter = new GeometryHighlighter(geometryMeta, scene);
	// var hueStep = Math.max(Math.round(360 / pointMeshes.length), 40),
	// 	lightStep = 360/hueStep;



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

  // var lights = [];
  // lights[ 0 ] = new PointLight( 0xffffff, 1, 0 );
  // lights[ 1 ] = new PointLight( 0xff00ff, 1, 0 );
  // lights[ 2 ] = new PointLight( 0x0000ff, 1, 0 );
	//
  // lights[ 0 ].position.set( 0, 200, 0 );
  // lights[ 1 ].position.set( 100, 200, 100 );
  // lights[ 2 ].position.set( - 100, - 200, - 100 );
	//
  // // scene.add( lights[ 0 ] );
  // scene.add( lights[ 1 ] );
  // scene.add( lights[ 2 ] );

	// function highlight(cycle, i=0, delay=600) {
	// 	highlighter.highlight(cycle[i].index);
	// 	setTimeout(() => highlight(cycle, (i+1) % cycle.length, delay), delay);
	// }

	// const DIHEDRAL = Math.atan(2);
	// let tree = travel(
	// 	geometryMeta.polygons[9].edges[0], [
	// 		{index: 1, next: [
	// 			{offset: 1},
	// 			{offset: 2},
	// 			{offset: 3},
	// 			{offset: 4},
	// 		]},
	// 		{index: 4, next: [
	// 			{offset: 2, next: [
	// 				{offset: 1},
	// 				{offset: 2},
	// 				{offset: 3},
	// 				{offset: 4},
	// 			]}
	// 		]}
	// 	]
	// );


	let tree = travel(
		geometryMeta.polygons[0].edges[0], [
			{index: 2},
			{index: 1, next: [
				{offset: 1},
				{offset: 2, next: [
					{offset: 2},
					{offset: 1, next: [
						{offset: 1},
						{offset: 2, next: [
							{offset: 2}
						]}
					]}
				]}
			]},
			{index: 0, next: [
				{offset: 2},
				{offset: 1, next: [
					{offset: 1},
					{offset: 2, next: [
						{offset: 2},
						{offset: 1, next: [
							{offset: 1},
							{offset: 2, next: [
								{offset: 2}
							]}
						]}
					]}
				]}
			]}
		]
	);

	// let tree = travel(
	// 	geometryMeta.polygons[0].edges[0], [
	// 		0, 1, 3,
	// 		{index: 2, next: [
	// 			{offset: 2}
	// 		]}
	// 	]
	// );

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

	// let flat = flatten(tree);
	// let edges = flat.map(node => node.edge.id),
	// 	cuts = edgesToGeometry(geometryMeta.edges.filter(e => edges.indexOf(e.id) === -1), geometryMeta.vertices),
	// 	folds = edgesToGeometry(geometryMeta.edges.filter(e => edges.indexOf(e.id) !== -1), geometryMeta.vertices);
	//
	// cuts.computeLineDistances();
	// folds.computeLineDistances();
	//
	// scene.add(new LineSegments(cuts, new LineDashedMaterial({color: 0xff0000, linewidth: 2.5, dashSize: 0.5, gapSize: 0.125})));
	// scene.add(new LineSegments(folds, new LineDashedMaterial({color: 0x660000, linewidth: 2.75, dashSize: 0.5, gapSize: 0.125})));
	// scene.add(new AxisHelper(10));


	function build(tree, offset=new Vector3()) {
		let node = tree.node,
			points = pointMeshes[node.poly.index].vertices,
			vertices = points.map(v => v.clone()),
			object = new Object3D(),
			offsetNode = new Object3D();

			offsetNode.position.sub(node.edge.point);

			object.userData.pivot = node.edge.vector;
			object.rotateOnAxis(node.edge.vector, DIHEDRAL);
			object.position.sub(offset).add(node.edge.point);

			let fold = node.edge.id.split('-').map(n => geometryMeta.vertices[Number(n)].clone()),
				cuts = [].concat(
					...node.poly.edges
						.filter(e => e.id !== node.edge.id)
						.filter(e => tree.children.every(c => c.node.edge.id !== e.id))
						.map(e => e.id.split('-').map(n => geometryMeta.vertices[Number(n)].clone()))
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
		// cross = new Vector3().crossVectors(tree.node.poly.normal, FRONT).normalize(),
		// angle = FRONT.angleTo(tree.node.poly.normal),
		// rotation = new Matrix4().makeRotationAxis(cross, angle),
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

	// baked.geometry.vertices.slice().forEach(v => {
	// 	let circle = document.createElementNS("http://www.w3.org/2000/svg", 'circle');
	// 	circle.setAttribute('cx', 400 * (v.x - baked.geometry.boundingBox.min.x) / (baked.geometry.boundingBox.max.x - baked.geometry.boundingBox.min.x));
	// 	circle.setAttribute('cy', 300 * (v.y - baked.geometry.boundingBox.min.y) / (baked.geometry.boundingBox.max.y - baked.geometry.boundingBox.min.y));
	// 	circle.setAttribute('r', 1);
	// 	svg.appendChild(circle);
	// });


	// highlighter.highlight(flat[0].poly.index);
	// highlight(flat.map(node => node.poly), 0, 1000);

	window.addEventListener ('resize', onWindowResize, false);

	// let caster = new Raycaster(),
	// 	mesh = new Mesh(d12);
	// window.addEventListener('mousemove', e => {
	// 	caster.setFromCamera(
	// 		new Vector2(
	// 			(e.clientX / window.innerWidth ) * 2 - 1,
	// 			- (e.clientY / window.innerHeight ) * 2 + 1
	// 		),
	// 		camera
	// 	);
	//
	// 	let intersection = caster.intersectObject(mesh, true).shift(),
	// 		polygon = intersection && geometryMeta.polygons.find(p =>
	// 			p.faces.find(f => f.normal === intersection.face.normal)
	// 		);
	//
	// 	// polygon
	// 	// 	? highlighter.highlight(polygon.index)
	// 	// 	: highlighter.highlightNone();
	// });
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
	let angle = (Math.sin(t) + 1) * 0.5 * DIHEDRAL;
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
