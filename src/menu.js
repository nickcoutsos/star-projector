
export function createMenu(asterisms, onHover, onToggle) {
  let list = document.getElementById('asterisms');
  if (list) {
    document.body.removeChild(list);
  }

  list = document.createElement('ul');
  list.setAttribute('id', 'asterisms');
  document.body.appendChild(list);

  asterisms.forEach(({name}) => {
    let node = document.createElement('li');
    node.innerText = name;
    list.appendChild(node);
  });

  list.addEventListener('mouseover', e => {
    if (e.target.tagName.toLowerCase() !== 'li') return;
    let target = e.target.innerText;
    onHover(target);

    [].slice.call(document.querySelectorAll(`svg g#asterisms-groups > g:not([stroke="transparent"])`))
      .forEach(element => element.setAttribute('stroke', '#660000'));
    document.querySelector(`svg g[id="${target}-lines"]`).setAttribute('stroke', '#ff7700');
  });

  list.addEventListener('click', e => {
    let target = e.target.innerText;
    onToggle(target);
    e.target.classList.toggle('disabled');
  });
}
