/** @jsx jsx */
import * as three from 'three'

import { jsx } from '../jsx'
import Topology from '../../../topology'
import Viewer from '../../components/viewer'
import Picker from '../../components/picker'
import Trackball from '../../components/trackball'

const geometry = new three.IcosahedronGeometry(1, 1)
const topology = new Topology(geometry)

import * as elements from './elements'
import * as materials from './materials'

const viewer = new Viewer()
const picker = new Picker(viewer)
const trackball = new Trackball(viewer)

const style = obj => Object.keys(obj).map(key => `${key}: ${obj[key]}`).join('; ')

export const content = (
  <section style="text-align: left">
    <h3>Traversal</h3>
    <ul>
    </ul>
    <div
      id="renderer"
      style={style({
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-25%)',
        right: 0,
        width: '50vh',
        height: '50vh'
      })}
    />
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

const traverser = (match, getSiblings) => {
  const matchIn = list => a => list.find(b => match(a, b))
  const noMatchIn = list => a => !list.find(b => match(a, b))
  const unique = list => list.filter((a, i) => list.findIndex(b => match(a, b)) === i)

  return (traversed, queue) => {
    const next = []
    const processed = []

    queue.forEach(item => {
      if (matchIn(traversed)(item)) {
        return
      }

      processed.push(item)
      next.push(
        ...getSiblings(item)
          .filter(noMatchIn(traversed))
          .filter(noMatchIn(queue))
      )
    })


    return [processed, unique(next)]
  }
}

picker.on('mouseon', object => {
  viewer.scene.traverse(node => {
    if (!node.material) {
      return
    }

    node.material = node === object
      ? materials.active
      : materials.regular
  })

  viewer.renderFrame()
})

picker.on('click', object => {
  const { edge, polygon } = object.userData
  if (!(edge || polygon)) {
    return
  }

  const idProp = polygon ? 'index': 'id'
  const userDataIdProp = polygon ? 'polygonId' : 'edgeId'
  const match = (a, b) => a[idProp] === b[idProp]
  const getSiblings = polygon
    ? poly => poly.edges.map(edge => edge.shared.poly)
    : edge => ([
      edge.next,
      edge.prev,
      edge.shared.next,
      edge.shared.prev
    ])

  const traverse = traverser(match, getSiblings)
  const traversed = []
  const queue = [edge || polygon]
  const advance = () => {
    const [last, next] = traverse(traversed, queue)
    traversed.push(...last)
    queue.splice(0, queue.length, ...next)

    viewer.scene.traverse(node => {
      if (!node.material) {
        return
      }

      node.material = next.find(item => item[idProp] === node.userData[userDataIdProp])
        ? materials.neighbour
        : (last.find(item => item[idProp] === node.userData[userDataIdProp])
          ? materials.active
          : materials.regular)
    })
    viewer.renderFrame()

    if (last.length > 0) {
      setTimeout(advance, 150)
    }
  }

  advance()
})
