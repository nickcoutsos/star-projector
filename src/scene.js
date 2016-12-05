import debounce from 'debounce';
import {PerspectiveCamera, Scene, Vector3, WebGLRenderer} from 'three';

import {OrbitControls} from './OrbitControls';


export function init(obj) {
	let renderer = new WebGLRenderer({ antialias:true });
	let width = window.innerWidth;
	let height = window.innerHeight;
	renderer.setSize (width, height);
	document.body.appendChild (renderer.domElement);

	let scene = new Scene();
	scene.userData.animate = false;
	scene.userData.time = 1;

	let camera = new PerspectiveCamera(85, width/height, 1, 10000);
  camera.position.set(0, 0, 20);
	camera.lookAt(new Vector3(0,0,0));
  let controls = new OrbitControls(camera, renderer.domElement);

	scene.add(obj);

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

	window.addEventListener('resize', () => {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize (window.innerWidth, window.innerHeight);
		renderer.render(scene, camera);
	});

	return {
		scene,
		render: animate
	};
}
