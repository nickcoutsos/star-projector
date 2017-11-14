/** @jsx jsx */
import * as three from 'three'

import { jsx } from '../jsx'
import Viewer from '../../components/viewer'
import {elements} from './elements'
import * as materials from './materials'

const viewer = new Viewer()
const wrapper = new three.Object3D()
wrapper.add(...elements)

const style = obj => Object.keys(obj).map(key => `${key}: ${obj[key]}`).join('; ')

export const content = (
  <section style="text-align: left">
    <h2>Elements of 3D Shapes</h2>
    <ul>
      <li class="fragment">Vertices</li>
      <li class="fragment">Edges</li>
      <li class="fragment">Faces</li>
    </ul>
    <div
      id="renderer"
      style={style({
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-25%)',
        right: 0,
        width: '50vw',
        height: '50vh'
      })}
    />
  </section>
)

let animation = null
const animate = () => {
  viewer.renderFrame()
  wrapper.rotation.y -= 0.01
  animation = requestAnimationFrame(animate)
}

export const activate = () => {
  viewer.onResize()
  animate()
}

export const deactivate = () => {
  cancelAnimationFrame(animation)
}

export const hideFragment = ({ index }) => {
  if (index === 0) {
    elements[0].traverse(node => node.material = materials.regular)
  }
}

export const fragment = ({ index }) => {
  elements.forEach((element, i) => {
    const material = i === index
      ? materials.active
      : materials.regular

    element.traverse(node => {
      node.material = material
    })
  })

  viewer.renderFrame()
}

viewer.mount(content.querySelector('#renderer'))
viewer.scene.add(wrapper)
