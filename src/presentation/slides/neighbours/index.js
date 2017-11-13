/** @jsx jsx */
import * as three from 'three'

import { jsx } from '../jsx'
import Topology from '../../../topology'
import Viewer from '../../components/viewer'
import Picker from '../../components/picker'
import Trackball from '../../components/trackball'

const geometry = new three.DodecahedronGeometry()
const topology = new Topology(geometry)

import * as elements from './elements'
import * as materials from './materials'
import * as highlightModes from './highlight-modes'

const viewer = new Viewer()
const picker = new Picker(viewer)
const trackball = new Trackball(viewer)

let highlightMode = null

export const content = (
  <section>
    <h3>Neighbourhoods</h3>
    <ul>
      <li class="fragment" data-highlight-mode="vertexEdges">Edges share vertices</li>
      <li class="fragment" data-highlight-mode="edgeEdges">Edges share other edges</li>
      <li class="fragment" data-highlight-mode="edgeFaces">Faces share edges</li>
    </ul>
    <div id="renderer" style="position: absolute; top: 50%; left: 50%; transform: translateX(-50%);" />
  </section>
)

export const activate = () => {
  viewer.onResize()
  picker.attach()
  trackball.attach()
}

export const deactivate = () => {
  picker.detach()
  trackball.detach()
}

export const showFragment = ({ fragment }) => {
  highlightMode = fragment.dataset.highlightMode
}

const wrapper = new three.Object3D().add(
  elements.getVertices(topology),
  elements.getEdges(topology),
  elements.getFaces(topology)
)

viewer.mount(content.querySelector('#renderer'))
viewer.camera.position.z = 2
viewer.scene.add(wrapper)

trackball.on('rotate', rotation => {
  wrapper.applyMatrix(rotation)
  viewer.renderFrame()
})

picker.on('mouseon', object => {
  if (!highlightMode) {
    return
  }

  highlightModes[highlightMode](object, topology, viewer.scene)
  viewer.renderFrame()
})
