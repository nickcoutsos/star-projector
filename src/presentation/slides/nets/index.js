/** @jsx jsx */
import * as three from 'three'
import { flatten } from 'lodash'
import { jsx } from '../jsx'
import Topology from '../../../topology'
import Viewer from '../../components/viewer'
import Picker from '../../components/picker'
import * as elements from './elements'
import { animate, easeOutBounce } from './util'

const geometry = new three.DodecahedronGeometry()
const topology = new Topology(geometry)


const viewer = new Viewer()
const picker = new Picker(viewer)

const style = obj => Object.keys(obj).map(key => `${key}: ${obj[key]}`).join('; ')

export const content = (
  <section style="text-align: left">
    <h3>Unfolding</h3>
    <ul>
      <li class="fragment">Et voíla</li>
    </ul>
  </section>
)

const renderContainer = (
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
)

const object = elements.getObject(topology)
const wrapper = new three.Object3D().add(object)
viewer.mount(renderContainer)
viewer.camera.position.z = 2

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
viewer.camera.position.set(-2, -1, 6)

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

let rotate_
const rotate = () => {
  rotate_ = requestAnimationFrame(rotate)
  wrapper.rotation.y += .008
  viewer.renderFrame()
}
const pivotTree = makePivotTree(object.children).filter(arr => arr.length > 0)

const unfold = animate(t => {
  pivotTree[pivotStep].forEach(node => node.userData.animate(t))
  viewer.renderFrame()
}, 1300, easeOutBounce)

const repeat = () => {
  if (pivotStep < pivotTree.length - 1) {
    pivotStep++
    unfold(repeat)
  }
}

export const showFragment = () => {
  rotate_ && cancelAnimationFrame(rotate_)
  const originalRotation = wrapper.rotation.y % (2 * Math.PI)
  animate(t => {
    wrapper.rotation.y = originalRotation * (1 - t)
    viewer.renderFrame()
  }, 700)(() => {
    unfold(repeat)
  })
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
  }, 400)(() => {
    rotate()
  })
}

export const activate = () => {
  document.body.appendChild(renderContainer)
  viewer.onResize()
  picker.attach()
  rotate()
}

export const deactivate = () => {
  document.body.removeChild(renderContainer)
  picker.detach()
}
