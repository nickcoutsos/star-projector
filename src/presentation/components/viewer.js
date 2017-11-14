import {
  Object3D,
  PerspectiveCamera,
  PointLight,
  Raycaster,
  Scene,
  Vector3,
  WebGLRenderer
} from 'three'

export default class Viewer {
  constructor () {
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

    const lamps = new Object3D().add(
      new PointLight(),
      new PointLight(),
      new PointLight()
    )

    lamps.children[0].position.set(0, 4, 1)
    lamps.children[1].position.set(-1, 0, 4)
    lamps.children[2].position.set(4, 0, 1)

    this.scene.add(this.camera, lamps)
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

    const { width, height } = slide.getBoundingClientRect()

    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderFrame();
  }

  renderFrame() {
    this.renderer.render(this.scene, this.camera)
  }
}
