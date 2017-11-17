import { Matrix4, Quaternion, Vector3 } from 'three'
import EventEmitter from 'eventemitter3'

export default class Trackball extends EventEmitter {
  constructor (viewer) {
    super()
    this.viewer = viewer
    this.onRotate = this.onRotate.bind(this)
    this.matrix = new Matrix4()
  }

  attach () {
    window.addEventListener('wheel', this.onRotate)
  }

  detach () {
    window.removeEventListener('wheel', this.onRotate)
  }

  onRotate ({ deltaX, deltaY }, speed=1) {
    const { camera, renderer } = this.viewer
    const { width, height } = renderer.domElement.getBoundingClientRect()
    const worldVector = camera.getWorldDirection()

    const right = new Vector3().crossVectors(worldVector, camera.up).normalize()
    const up = right.clone().cross(worldVector).normalize()

    const rotation = new Matrix4()
      .makeRotationFromQuaternion(
        new Quaternion().multiplyQuaternions(
          new Quaternion().setFromAxisAngle(up, speed * deltaX / width),
          new Quaternion().setFromAxisAngle(right, speed * deltaY / height)
        )
      )

    this.matrix.multiply(rotation)
    this.emit('rotate', rotation)
  }
}
