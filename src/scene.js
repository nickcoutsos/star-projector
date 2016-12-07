import debounce from 'debounce';
import {Color, Matrix4, PerspectiveCamera, Quaternion, Scene, Vector3, WebGLRenderer} from 'three';


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

	renderer.domElement.addEventListener('mousewheel', ({deltaX, deltaY}) => {
		let right = new Vector3().crossVectors(camera.getWorldDirection(), camera.up).normalize(),
			up = right.clone().cross(camera.getWorldDirection()).normalize();

		obj.applyMatrix(
			new Matrix4().makeRotationFromQuaternion(
				new Quaternion().multiplyQuaternions(
					new Quaternion().setFromAxisAngle(up, deltaX / renderer.domElement.clientWidth),
					new Quaternion().setFromAxisAngle(right, deltaY / renderer.domElement.clientHeight)
				)
			)
		);
		animate();
	});

	return {
		scene,
		render: animate
	};
}
