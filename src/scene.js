import debounce from 'debounce';
import {Color, Matrix4, Object3D, PerspectiveCamera, Quaternion, Scene, Vector3, WebGLRenderer} from 'three';

export function init(obj) {
	let renderer = new WebGLRenderer({ antialias:true });
	let width = window.innerWidth;
	let height = window.innerHeight;
	renderer.setSize (width, height);
	renderer.setClearColor(new Color('hsl(230, 54%, 36%)'));
	document.body.appendChild (renderer.domElement);

	const ANIMATION_SPEED = 0.016;
	let scene = new Scene();
	scene.userData.open = false;
	scene.userData.animating = true;
	scene.userData.time = 0;

	let camera = new PerspectiveCamera(85, width/height, 1, 10000);
  camera.position.set(0, 0, 20);
	camera.lookAt(new Vector3(0,0,0));

	scene.add(obj);

	let animate;
	function render() {
		let {animating, open, time} = scene.userData,
			delta = ANIMATION_SPEED * (open ? 1 : -1);

		renderer.render(scene, camera);

		if (animating) {
			requestAnimationFrame(animate);
			scene.userData.time = time = Math.max(0, Math.min(1, time + delta));
			scene.traverse(node => {
				if (typeof node.userData.animate !== 'function') return;
				node.userData.animate(time);
			});

			if (time === 1 || time === 0) {
				scene.userData.animating = false;
			}
		}
	}

	animate = debounce(render, 16);

	renderer.domElement.addEventListener('click', () => {
		scene.userData.open = !scene.userData.open;
		scene.userData.animating = true;
		animate();
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
