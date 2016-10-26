import {DodecahedronGeometry} from 'three';
import {Color, Geometry, GridHelper, Mesh, PerspectiveCamera, PointLight, Points, PointsMaterial, Raycaster, Scene, Vector2, Vector3, WebGLRenderer} from 'three';
import {getGeometryMetadata, intersectPolygons, rayFromAngles} from './stuff';
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
				color: new Color(`hsl(${i * hueStep % 360}, 90%, ${50 + Math.floor(i/lightStep)*20}%)`),
				size: 0.125
			})
		);
		scene.add(obj);
	});

	camera = new PerspectiveCamera (45, width/height, 1, 10000);
  camera.position.x = 0;
	camera.position.y = 0;
	camera.position.z = 35;
	camera.lookAt (new Vector3(0,0,0));

    controls = new OrbitControls (camera, renderer.domElement);

	var gridXZ = new GridHelper(100, 10, new Color(0xff0000), new Color(0xffffff));
	scene.add(gridXZ);

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

		polygon
			? highlighter.highlight(polygon.index)
			: highlighter.highlightNone();
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
