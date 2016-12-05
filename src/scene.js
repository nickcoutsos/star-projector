import debounce from 'debounce';

// core
import {Scene, WebGLRenderer} from 'three';
import {PerspectiveCamera} from 'three';

// math
import {Vector3} from 'three';

import {OrbitControls} from './OrbitControls';

var scene, renderer, camera;
var controls;


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
export {animate as render};

export function init(obj)
{
	renderer = new WebGLRenderer( {antialias:true} );
	var width = window.innerWidth;
	var height = window.innerHeight;
	renderer.setSize (width, height);
	document.body.appendChild (renderer.domElement);

	scene = new Scene();
	scene.userData.animate = false;
	scene.userData.time = 1;

	camera = new PerspectiveCamera (85, width/height, 1, 10000);
  camera.position.x = 0;
	camera.position.y = 0;
	camera.position.z = 20;
	camera.lookAt (new Vector3(0,0,0));
  controls = new OrbitControls (camera, renderer.domElement);


	// scene.add(root);
	scene.add(obj);

	window.addEventListener ('resize', onWindowResize, false);
	controls.addEventListener('change', animate);

	renderer.domElement.addEventListener('click', () => {
		scene.userData.animate = !scene.userData.animate;
		scene.userData.animate && animate();
	});
}


function onWindowResize ()
{
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize (window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
}
