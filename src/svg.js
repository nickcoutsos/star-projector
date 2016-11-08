export function element(name, attributes={}) {
  let element = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.keys(attributes).forEach(k => element.setAttribute(k, attributes[k]));
  return element;
}
