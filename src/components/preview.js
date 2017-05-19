import Vue from 'vue';
import debounce from 'debounce';
import {applyStyle} from 'threestyle';
import {Matrix4, Object3D, PerspectiveCamera, Raycaster, Scene, Vector2, Vector3, WebGLRenderer} from 'three';


export default Vue.component('object-preview', {
	props: ['object'],
	data: () => ({
		renderer: new WebGLRenderer({antialias: true}),
		camera: new PerspectiveCamera(75, 1, 0.1, 10),
		scene: new Scene(),
		picker: new Raycaster(),
		wrapper: new Object3D(),
		open: false,
		animating: true,
		time: 0
	}),

	created() {
		this.camera.position.set(0, 0, 2);
		this.camera.lookAt(new Vector3(0, 0, 0));
		this.wrapper.userData.animate = t => {
			if (!this.animating) return;

			let target = new Vector3(0, 0, 1),
				source = this.lastDirection,
				angle = source.angleTo(target),
				cross = new Vector3().crossVectors(source, target).normalize();

			this.wrapper.setRotationFromAxisAngle(cross, angle * t);
		}

		this.scene.add(
			this.camera,
			this.wrapper
		);

		applyStyle(this.scene);
	},

	mounted() {
		this.$el.appendChild(this.renderer.domElement);
		this.$el.addEventListener('click', () => this.onAnimate());
		this.$el.addEventListener('mousemove', debounce(e => this.onMouseMove(e), 15));
		window.addEventListener('resize', () => this.onResize());

		if (this.object) {
			this.lastDirection = this.object.up.clone().normalize();
			this.wrapper.add(this.object);
		}

		this.onResize();

		let animate = () => {
			requestAnimationFrame(animate);
			if (!this.animating && !this.open) this.wrapper.rotation.y += 0.005;
			this.renderFrame();
		}
		animate();
	},

	methods: {
		onAnimate() {
			this.open = !this.open;
			this.animating = true;

			if (this.open) {
				this.object.applyMatrix(new Matrix4().extractRotation(this.wrapper.matrix));
				this.lastDirection = this.object.up.clone().applyMatrix4(new Matrix4().extractRotation(this.object.matrix)).normalize();
				this.wrapper.rotation.set(0, 0, 0);
			}
		},

		onResize() {
			this.renderer.domElement.style = {};
			this.renderer.domElement.removeAttribute('width');
			let [width, height] = [this.$el.offsetWidth, this.$el.offsetHeight];
			this.renderer.setSize(width, height);
			this.camera.aspect = width / height;
			this.camera.updateProjectionMatrix();
			this.renderFrame();
		},

		onMouseMove({clientX, clientY}) {
			let {camera, object, picker, renderer} = this;

			let coords = coords = new Vector2(
				((clientX  - renderer.domElement.offsetLeft) / renderer.domElement.clientWidth) * 2 - 1,
				((clientY  - renderer.domElement.offsetTop) / renderer.domElement.clientHeight) * -2 + 1
			);

			picker.setFromCamera(coords, camera);
			let targets = [];
			object.traverse(node => node.isMesh && targets.push(node));

			let active = false;
			for (let target of targets) {
				let intersect = picker.intersectObject(target);
				if (intersect.length > 0) {
					active = true;
					break;
				}
			}

			if (object.userData.className === 'active' && !active) object.userData.className = '';
			else if (object.userData.className !== 'active' && active) object.userData.className = 'active';

			renderer.domElement.classList.toggle('object-hover', active);
		},

		renderFrame() {
			let {animating, open, time} = this,
				delta = 0.016 * (open ? 1 : -1);

			if (animating) {
				this.time = time = Math.max(0, Math.min(1, time + delta));
				if (time === 1 || time === 0) {
					this.animating = false;
				}
			}

			this.scene.traverse(node => {
				if (typeof node.userData.animate !== 'function') return;
				node.userData.animate(this.time);
			});

			this.renderer.render(this.scene, this.camera);
		}
	},

	watch: {
		object(object) {
			this.wrapper.remove(...this.wrapper.children);
			this.wrapper.add(object);
			this.wrapper.rotation.set(0, 0, 0);
			this.animating = true;
			this.open = false;
			this.time = 0;
		}
	},

	render(h) {
		return h('div');
	}
});
