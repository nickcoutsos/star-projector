var scene, renderer, camera;
var object;
var controls;

var d12 = new THREE.DodecahedronGeometry(10);
// var d12 = new THREE.BoxGeometry(10,10,10);
var geometryMeta = getGeometryMetadata(d12);
console.log(geometryMeta);

let starsAsVertices = bsc
	.map(({sra0, sdec0}) => intersectPolygons(rayFromAngles(sra0, sdec0), geometryMeta.polygons))
	.filter(intersection => intersection)
	.map(({point}) => point);

let pointMesh = Object.assign(new THREE.Geometry(), {vertices: starsAsVertices});

var edgeMesh = new THREE.Geometry();
edgeMesh.vertices = [].concat(
	...geometryMeta.edges.map(edge => edge.id.split('-').map(n => d12.vertices[parseInt(n)]))
);

let edges = geometryMeta.edges.map(edge => edge.id.split('-').map(n => d12.vertices[parseInt(n)]));
var hueStep = Math.max(Math.round(360 / edges.length), 40),
	lightStep = 360/hueStep;

var edgeMeshes = edges.map(([a, b], i, edges) =>
	new THREE.LineSegments(
		Object.assign(new THREE.Geometry(), {vertices: [ a, b ]}),
		new THREE.LineBasicMaterial({
			color: new THREE.Color(`hsl(${i * hueStep % 360}, 75%, ${30 + Math.floor(i/lightStep)*20}%)`),
			linewidth: 3.5
		})
	)
);



init();
animate();


function init()
{
	renderer = new THREE.WebGLRenderer( {antialias:true} );
	var width = window.innerWidth;
	var height = window.innerHeight;
	renderer.setSize (width, height);
	document.body.appendChild (renderer.domElement);

	scene = new THREE.Scene();

	// let geometry = new THREE.DodecahedronGeometry(10);
	object = new THREE.Mesh (
		d12,
		new THREE.MeshPhongMaterial({
			color: 0x000022,
			emissive: 0x000044,
			shininess: 10,
			shading: THREE.FlatShading,
      opacity: 0.4,
      transparent: true,
			side: THREE.DoubleSide
		}),
		new THREE.MeshPhongMaterial({color: 0x00ffff, emissive: 0x00ffff })
	);

	edgeMeshes.forEach(mesh => scene.add(mesh));

	scene.add (object);
  let pointObj = new THREE.Points(pointMesh, new THREE.PointsMaterial({color: 0xffffee, emissive: 0xffffff, size: 0.06125}));
  pointObj.scale.set(0.99, 0.99, 0.99);
  scene.add(pointObj);

	camera = new THREE.PerspectiveCamera (45, width/height, 1, 10000);
  camera.position.x = 0;
	camera.position.y = 0;
	camera.position.z = 35;
	camera.lookAt (new THREE.Vector3(0,0,0));

    controls = new THREE.OrbitControls (camera, renderer.domElement);

	var gridXZ = new THREE.GridHelper(100, 10, new THREE.Color(0xff0000), new THREE.Color(0xffffff));
	scene.add(gridXZ);

  var lights = [];
  lights[ 0 ] = new THREE.PointLight( 0xffffff, 1, 0 );
  lights[ 1 ] = new THREE.PointLight( 0xff00ff, 1, 0 );
  lights[ 2 ] = new THREE.PointLight( 0x0000ff, 1, 0 );

  lights[ 0 ].position.set( 0, 200, 0 );
  lights[ 1 ].position.set( 100, 200, 100 );
  lights[ 2 ].position.set( - 100, - 200, - 100 );

  scene.add( lights[ 0 ] );
  scene.add( lights[ 1 ] );
  scene.add( lights[ 2 ] );

	window.addEventListener ('resize', onWindowResize, false);

	let intersectionMesh = Object.assign(new THREE.Geometry(), {vertices: object.geometry.vertices.slice(), faces: [new THREE.Face3(0,1,2)]});
	scene.add(new THREE.Mesh(intersectionMesh, new THREE.MeshPhongMaterial({color: 0x00ffff, opacity: 0.8, transparent:true, side: THREE.DoubleSide})));

	window.addEventListener('mousemove', e => {
		let caster = new THREE.Raycaster();
		caster.setFromCamera(
			new THREE.Vector2(
				(e.clientX / window.innerWidth ) * 2 - 1,
				- (e.clientY / window.innerHeight ) * 2 + 1
			),
			camera
		);

		let intersection = caster.intersectObject(object, true).shift(),
			polygon = intersection && geometryMeta.polygons.find(p =>
				p.faces.find(f => f.normal === intersection.face.normal)
			);

		intersectionMesh.faces = polygon && polygon.faces || [];
		intersectionMesh.elementsNeedUpdate = true;
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
