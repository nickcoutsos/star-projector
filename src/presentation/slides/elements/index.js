/** @jsx jsx */
import * as three from 'three'

import { jsx } from '../jsx'
import Viewer from '../../components/viewer'
import {elements} from './elements'

const viewer = new Viewer()
const wrapper = new three.Object3D()
wrapper.add(...elements)

export const content = (
  <section>
    <h2>Elements of 3D Shapes</h2>
    <ul>
      <li class="fragment highlight-red">Vertices</li>
      <li class="fragment highlight-green">Edges</li>
      <li class="fragment highlight-blue">Faces</li>
    </ul>
    <div id="renderer" style="position: absolute; top: 50; left: 50%; transform: translateX(-50%);" />
  </section>
)

export const activate = () => {
  viewer.onResize()
  elements.forEach(element => {
    element.visible = false
  })
}

export const showFragment = ({ index }) => {
  elements[index].visible = true
}

export const hideFragment = ({ index }) => {
  elements[index].visible = false
}

viewer.mount(content.querySelector('#renderer'))
viewer.animate = () => { wrapper.rotation.y -= .005 }
viewer.scene.add(wrapper)
