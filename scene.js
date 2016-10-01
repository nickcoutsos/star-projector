var scene, renderer, camera;
var object;
var controls;
// var d12 = new THREE.IcosahedronGeometry(10, 1);
var d12 = new THREE.DodecahedronGeometry(10);
var pointMesh = new THREE.Geometry();
// var stars = getStars();

// getGeometryMap(d12);

pointMesh.vertices = new Array(bsc.length).join(',').split(',').map(p => new THREE.Vector3(0,0,0));
// console.log(pointMesh.vertices);

var groupedFaces = d12.faces.reduce((groups, face) => {
	let group = groups.find(g => g.normal.angleTo(face.normal) < 0.01);
  if (!group) groups.push(group = {normal: face.normal, faces:[], plane: new THREE.Plane().setFromCoplanarPoints(...['a','b','c'].map(p => d12.vertices[face[p]]))});
  group.faces.push(face);
  return groups;
}, []);


function pointsFromFace(face, geometry) {
	return [
  	geometry.vertices[face.a],
    geometry.vertices[face.b],
    geometry.vertices[face.c]
  ];
}


function projectPoint(ray, geometry) {
	let point, tri;
	return groupedFaces.find(group => {
  	point = ray.intersectPlane(group.plane);
    tri = point && group.faces.find(face =>
      	new THREE.Triangle(...pointsFromFace(face, geometry))
        	.containsPoint(point)
      );

      return tri && point;
  }) && point;
}

//let t = 0;
//let interval = setInterval(function() {
//	t += 1;
//  addPoint(t);
//  if (t === 360) clearInterval(interval);
//}, 50)


const DEG2RAD = Math.PI/180;

function addPoint(t) {
	let asc = bsc[t].sra0,
  	dec = bsc[t].sdec0;

  let ray = new THREE.Ray(
  	new THREE.Vector3(0,0,0),
    /*
    new THREE.Vector3(
    	Math.cos(r),
      Math.sin(r*5),
			Math.sin(r)
    ).normalize()
    */
    // new THREE.Vector3(
    // 	Math.cos(rA) * Math.cos(rD),
    //   Math.sin(rA),
    //   Math.cos(rA) * Math.sin(rD)
    // ).normalize()
		new THREE.Vector3(
    	Math.cos(asc) * Math.sin(dec),
      Math.cos(dec) * (dec / Math.abs(dec) || 1),
      Math.sin(asc) * Math.sin(dec)
    ).normalize()
  );
  pointMesh.vertices[t] = projectPoint(ray, d12);
	if (!pointMesh.vertices[t]) {
		console.log('holy shit no intersection for', t, ray, pointMesh.vertices[t], asc, dec);
	}
  pointMesh.verticesNeedUpdate = true;
}

for(let t = 0; t < pointMesh.vertices.length; t += 1)	addPoint(t);

init();
renderer.render(scene, camera)
animate();


function init()
{
	renderer = new THREE.WebGLRenderer( {antialias:true} );
	var width = window.innerWidth;
	var height = window.innerHeight;
	renderer.setSize (width, height);
	document.body.appendChild (renderer.domElement);

	scene = new THREE.Scene();

	object = new THREE.Mesh (d12, new THREE.MeshPhongMaterial( {
					color: 0x000022,
					emissive: 0x000044,
					shading: THREE.SmoothShading,
          opacity: 0.7,
          transparent: true
				} ));

	object.position.set (0, 0, 0);
	scene.add (object);
  let pointObj = new THREE.Points(pointMesh, new THREE.PointsMaterial({color: 0xffffcc, emissive: 0xffffff, size: 0.06125}));
  pointObj.scale.set(0.99, 0.99, 0.99);
  scene.add(pointObj);

	camera = new THREE.PerspectiveCamera (45, width/height, 1, 10000);
  camera.position.x = 0;
	camera.position.y = 0;
	camera.position.z = 2;
	camera.lookAt (new THREE.Vector3(0,0,0));

    controls = new THREE.OrbitControls (camera, renderer.domElement);

	var gridXZ = new THREE.GridHelper(100, 10, new THREE.Color(0xff0000), new THREE.Color(0xffffff));
	scene.add(gridXZ);

	// var pointLight = new THREE.PointLight (0xffffff);
	// pointLight.position.set (0,300,200);
	// scene.add (pointLight);
  var lights = [];
  lights[ 0 ] = new THREE.PointLight( 0xffffff, 1, 0 );
  lights[ 1 ] = new THREE.PointLight( 0xff00ff, 1, 0 );
  lights[ 2 ] = new THREE.PointLight( 0xffffff, 1, 0 );

  lights[ 0 ].position.set( 0, 200, 0 );
  lights[ 1 ].position.set( 100, 200, 100 );
  lights[ 2 ].position.set( - 100, - 200, - 100 );

  // scene.add( lights[ 0 ] );
  scene.add( lights[ 1 ] );
  // scene.add( lights[ 2 ] );

	window.addEventListener ('resize', onWindowResize, false);
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
