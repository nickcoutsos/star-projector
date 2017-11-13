import EventEmitter from 'eventemitter3'
import { Raycaster, Vector2 } from 'three'

export default class Picker extends EventEmitter {
  constructor (viewer) {
    super()
    this.viewer = viewer
    this.picker = new Raycaster()

    this.lastHover = null
    this.onMouseMove = this.onMouseMove.bind(this)
  }

  get element () {
    return this.viewer.renderer.domElement
  }

  get container () {
    return this.element.parentElement
  }

  attach () {
    this.element.addEventListener('mousemove', this.onMouseMove)
  }

  detach () {
    this.element.removeEventListener('mousemove', this.onMouseMove)
  }

  onMouseMove (event) {
    const {lastHover} = this
    const { clientX, clientY } = event
    const object = this.pick(clientX, clientY)

    if (lastHover && lastHover !== object) {
      this.emit('mouseoff', lastHover)
    }

    if (object && object !== lastHover) {
      this.emit('mouseon', object)
    }

    this.lastHover = object
  }

  pick (x, y) {
    const {element, picker, viewer} = this
    const {camera, scene} = viewer
    const {left, top, width, height} = element.getBoundingClientRect()

    const coords = new Vector2(
      ((x - left) / width) * 2 - 1,
      ((y - top) / height) * -2 + 1
    )

    picker.setFromCamera(coords, camera)
    return picker.intersectObject(scene, true)[0]
  }
}
