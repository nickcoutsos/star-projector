import {
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer
} from 'three'

export default class Viewer {
  constructor () {
    console.log('Viewer constructor')
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true })
    this.camera = new PerspectiveCamera(75, 1, 0.1, 10)
    this.scene = new Scene()
    this.scene.background = null
    this.picker = new Raycaster()

    this.initialize()
  }

  initialize () {
    this.camera.position.set(0, 0, 2.5)
    this.camera.lookAt(new Vector3(0, 0, 0))
    this.scene.add(this.camera)
  }

  mount (container) {
    container.appendChild(this.renderer.domElement)
    window.addEventListener('resize', () => this.onResize())
    this.onResize()
    this.renderFrame()
  }

  onResize() {
    const slide = this.renderer.domElement.parentNode
    if (!slide) {
      return
    }

    const container = slide.parentNode

    if (!container) {
      return
    }

    delete slide.style.width
    delete slide.style.height
    container.removeAttribute('width');
    container.removeAttribute('height')
    const { width, height } = container.getBoundingClientRect()
    console.log('resize', width, height)

    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderFrame();
  }

  // onMouseMove({clientX, clientY}) {
  //   let {camera, scene, picker, renderer} = this;

  //   let coords = coords = new Vector2(
  //     ((clientX  - renderer.domElement.offsetLeft) / renderer.domElement.clientWidth) * 2 - 1,
  //     ((clientY  - renderer.domElement.offsetTop) / renderer.domElement.clientHeight) * -2 + 1
  //   );

  //   picker.setFromCamera(coords, camera);
  //   let targets = [];
  //   scene.traverse(node => node.isMesh && targets.push(node));

  //   let active = false;
  //   for (let target of targets) {
  //     let intersect = picker.intersectObject(target);
  //     if (intersect.length > 0) {
  //       active = true;
  //       break;
  //     }
  //   }
  // }

  renderFrame() {
    this.renderer.render(this.scene, this.camera)

    if (this.animate) {
      this.animate()
      requestAnimationFrame(() => this.renderFrame())
    }
  }
}
