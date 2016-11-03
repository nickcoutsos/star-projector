export let cube = [
	0, 1, 3,
	{index: 2, next: [
		{offset: 2}
	]}
];

export let dodecahedron = [
	{index: 1, next: [
		{offset: 1},
		{offset: 2},
		{offset: 3},
		{offset: 4},
	]},
	{index: 4, next: [
		{offset: 2, next: [
			{offset: 1},
			{offset: 2},
			{offset: 3},
			{offset: 4},
		]}
	]}
];

export let icosahedron = [
  {index: 2},
  {index: 1, next: [
    {offset: 1},
    {offset: 2, next: [
      {offset: 2},
      {offset: 1, next: [
        {offset: 1},
        {offset: 2, next: [
          {offset: 2}
        ]}
      ]}
    ]}
  ]},
  {index: 0, next: [
    {offset: 2},
    {offset: 1, next: [
      {offset: 1},
      {offset: 2, next: [
        {offset: 2},
        {offset: 1, next: [
          {offset: 1},
          {offset: 2, next: [
            {offset: 2}
          ]}
        ]}
      ]}
    ]}
  ]}
];


/**
 * Naively generate a net for the given polygon of a defined topology.
 *
 * This function attempts to do a breadth-first traversel of the mesh to keep
 * things relatively "spread out", but won't make for an efficient use of space.
 * There is almost no reason for this function except that I wanted to write it.
 *
 * @param {Object} start - arbitrary beginning polygon for the net
 * @returns {Array<Object>} a tree of edges to follow from the current polygon
 */
export function generateNaiveNet(start) {
  let root = [],
    queue = start.edges.map(edge => ({edge, tree: root})),
    mapped = [start.index];

  while (queue.length > 0) {
    let {tree, edge} = queue.shift(),
      target = edge.shared.poly;

    if (mapped.indexOf(target.index) !== -1) continue;

    mapped.push(target.index);
    tree.push({index: edge.index, next: []});

    queue.push(
      ...target.edges
        .map(next => ({
          edge: next,
          tree: tree[tree.length - 1].next
        }))
    );
  }

  return root;
}


/**
 * Return a net description for a given threeJS polyhedral geometry
 *
 * @param {THREE.PolyhedronBufferGeometry} geometry
 * @return {Array} net - a recursive array of edges to follow
 */
export function getGeometryNet(geometry) {
  switch (geometry.polygons.length) {
    case 6: return cube;
    case 12: return dodecahedron;
    case 20: return icosahedron;
    default: return generateNaiveNet(geometry.polygons[0]);
  }
}
