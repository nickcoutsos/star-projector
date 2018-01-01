export const header = '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">'

/**
 * Create a DOM element in the SVG namespace.
 *
 * @param {String} tagname - the element tag name.
 * @param {Object} [attributes={}] a key-value mapping of attributes to add to the node
 * @param {Array<DOMNode>} [children=[]] array of children to append before returning
 * @returns {DOMNode}
 */
export function element(tagname, attributes={}, children=[]) {
  let node = document.createElementNS('http://www.w3.org/2000/svg', tagname)
  Object.keys(attributes).forEach(k => node.setAttribute(k, attributes[k]))
  children.forEach(child => {
    if (!(child instanceof Node)) {
      child = document.createTextNode(child)
    }

    node.appendChild(child)
  })

  return node
}

