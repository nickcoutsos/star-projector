/** @jsx jsx */
import * as three from 'three'

import { jsx } from '../jsx'
import Viewer from '../../components/viewer'
import {elements} from './elements'

const viewer = new Viewer()
const lamps = [
  new three.PointLight(),
  new three.PointLight(),
  new three.PointLight()
]

lamps[0].position.set(0, 4, 0)
lamps[1].position.set(-1, 0, 4)
lamps[2].position.set(4, 0, 1)

const wrapper = new three.Object3D()
wrapper.add(...elements)

export const content = (
  <section>
    <h2>Elements of 3D Shapes</h2>
    <ul>
      <li class="fragment">Vertices</li>
      <li class="fragment">Edges</li>
      <li class="fragment">Faces</li>
    </ul>
    <div id="renderer" style="position: absolute; top: 50; left: 50%; transform: translateX(-50%); z-index: -1" />
  </section>
)

export const activate = () => viewer.onResize()

export const showFragment = ({ index }) => {
  elements[index].visible = true
}

export const hideFragment = ({ index }) => {
  elements[index].visible = false
}

viewer.mount(content.querySelector('#renderer'))
viewer.animate = () => { wrapper.rotation.y -= .005 }
viewer.scene.add(
  wrapper, ...lamps
)
