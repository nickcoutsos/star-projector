/** @jsx jsx */
import * as three from 'three'
import { flatten } from 'lodash'
import { jsx } from '../jsx'
import Topology from '../../../topology'
import Viewer from '../../components/viewer'
import Picker from '../../components/picker'
import Trackball from '../../components/trackball'
import * as elements from './elements'
import { animate, easeOutBounce } from './util'

const geometry = new three.DodecahedronGeometry()
const topology = new Topology(geometry)


const viewer = new Viewer()
const picker = new Picker(viewer)
const trackball = new Trackball(viewer)

const style = obj => Object.keys(obj).map(key => `${key}: ${obj[key]}`).join('; ')

export const content = (
  <section style="text-align: left">
    <h3>Unfolding</h3>
    <ul>
      <li class="fragment">Et voíla</li>
    </ul>
    <div
      id="renderer"
      style={style({
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh'
      })}
    />
  </section>
)

const object = elements.getObject(topology)
const wrapper = new three.Object3D().add(object)
viewer.mount(content.querySelector('#renderer'))
viewer.camera.position.z = 2
viewer.renderFrame()

trackball.on('rotate', rotation => {
  wrapper.applyMatrix(rotation)
  viewer.renderFrame()
})

const spot = new three.SpotLight(0)
spot.position.set(-3, 4, 1)
spot.castShadow = true
spot.shadow.mapSize.width = 1024
spot.shadow.mapSize.height = 1024

wrapper.traverse(node => {
  if (!node.material) {
    return
  }

  node.castShadow = true
})

const plane = new three.Mesh(
  new three.PlaneGeometry(20, 20),
  new three.ShadowMaterial({ opacity: 0.6 })
)

plane.position.z = -1
plane.receiveShadow = true
viewer.scene.add(wrapper, spot, plane)
viewer.renderer.shadowMap.enabled = true
viewer.renderer.shadowMap.type = three.PCFSoftShadowMap
viewer.camera.position.set(0, 1, 5)

const isPivot = obj => obj.userData.isPivot

let pivotStep = 0
const makePivotTree = children => {
  const pivotChildren = children.filter(isPivot)
  const pivotGrandchildren = flatten(pivotChildren.map(child => child.children))
  return [pivotChildren].concat(
    pivotGrandchildren.length > 0
      ? makePivotTree(pivotGrandchildren)
      : []
  )
}

const pivotTree = makePivotTree(object.children).filter(arr => arr.length > 0)

const unfold = animate(t => {
  pivotTree[pivotStep].forEach(node => node.userData.animate(t))
  viewer.renderFrame()
}, 1000, easeOutBounce)

const repeat = () => {
  if (pivotStep < pivotTree.length - 1) {
    pivotStep++
    unfold(repeat)
  }
}

viewer.renderFrame()

export const showFragment = () => {
  unfold(repeat)
}

export const hideFragment = () => {
  pivotStep = 0
  animate(t => {
    object.traverse(node => {
      if (node.userData.animate) {
        node.userData.animate(1-t)
      }
    })
    viewer.renderFrame()
  }, 400)()
}

export const activate = () => {
  viewer.onResize()
  picker.attach()
  trackball.attach()
}

export const deactivate = () => {
  picker.detach()
  trackball.detach()
}
