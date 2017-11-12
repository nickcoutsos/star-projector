import { flatten } from 'lodash'

export const element = ns => (tagname, attributes={}, ...children) => {
  const node = (ns
    ? document.createElementNS(ns, tagname)
    : document.createElement(tagname)
  )

  Object.keys(attributes || {}).forEach(k => node.setAttribute(k, attributes[k]))
  flatten(children).forEach(child => {
    if (!(child instanceof Node)) {
      child = document.createTextNode(child)
    }

    node.appendChild(child)
  })

  return node
}

const jsx = element()
const svg = element('http://www.w3.org/2000/svg')

export { jsx, svg }

export default jsx
