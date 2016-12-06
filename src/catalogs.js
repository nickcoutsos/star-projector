import 'whatwg-fetch';
import sift from 'sift';

var starCatalogBuckets = [
  {min: -2.00, max: 6.50, file: 'hd_mag__-2.00-6.50.json'},
  {min: 6.50, max: 7.00, file: 'hd_mag__6.50-7.00.json'},
  {min: 7.00, max: 7.50, file: 'hd_mag__7.00-7.50.json'},
  {min: 7.50, max: 7.75, file: 'hd_mag__7.50-7.75.json'},
  {min: 7.75, max: 8.00, file: 'hd_mag__7.75-8.00.json'},
  {min: 8.00, max: 8.25, file: 'hd_mag__8.00-8.25.json'},
  {min: 8.25, max: 8.50, file: 'hd_mag__8.25-8.50.json'},
  {min: 8.50, max: 8.75, file: 'hd_mag__8.50-8.75.json'},
  {min: 8.75, max: 9.00, file: 'hd_mag__8.75-9.00.json'},
  {min: 9.00, max: 9.25, file: 'hd_mag__9.00-9.25.json'},
  {min: 9.25, max: 9.50, file: 'hd_mag__9.25-9.50.json'},
  {min: 9.50, max: 13.00, file: 'hd_mag__9.50-13.00.json'}
];

var promiseStarCatalogs = {
  'hd_asterisms.json': null,
  'hd_mag__-2.00-6.50.json': null,
  'hd_mag__6.50-7.00.json': null,
  'hd_mag__7.00-7.50.json': null,
  'hd_mag__7.50-7.75.json': null,
  'hd_mag__7.75-8.00.json': null,
  'hd_mag__8.00-8.25.json': null,
  'hd_mag__8.25-8.50.json': null,
  'hd_mag__8.50-8.75.json': null,
  'hd_mag__8.75-9.00.json': null,
  'hd_mag__9.00-9.25.json': null,
  'hd_mag__9.25-9.50.json': null,
  'hd_mag__9.50-13.00.json': null
};

var promiseAsterismCatalog;

const jsonOrDeath = res => {
  if (!res.ok) throw Object.assign(new Error(res.statusText), {res});
  return res.json();
};


/**
 * Load the star catalog matching the given query.
 *
 * Each star returned from the catalog has the following fields:
 *
 *  id              {integer}: star number according to Henry Draper catalog
 *  magnitude       {float}: apparent magnitude of star
 *  rightAscension  {float}: star's right ascension in radians, 0 <= sra0 <= 2π
 *  declination     {float}: star's declination in radians, -π/2 <= sdec0 <= π/2
 *
 * @param {Object} query - a mongoquery filter to apply to each fetched star.
 * @returns {Promise} - resolves to an array of matched stars.
 */
export function loadStarCatalog(query={}) {
  let magnitudes = findQueryValues(query, 'magnitude');
  let sifter = stars => sift(query, stars);

  let magnitude = Math.max(
    ...magnitudes.map(
      value => typeof value === 'object'
        ? Object.keys(value).map(k => value[k]).find(value => typeof value === 'number')
        : value
    )
    .filter(value => typeof value === 'number')
  );

  return fetchStarCatalogFilesByMagnitude(magnitude).then(sifter)
}


/**
 * Load asterisms from the catalog which match the given query.
 *
 * Each asterism returned from the catalog has the following fields:
 *
 *  name  {string}: a human readable name of the asterism
 *  stars {Array<Number>}: an array of edges where each vertex is a star's HD catalog number
 *  starCounts {Array<Object>}: an array of objects with `id` and `count` properties
 *
 * @param {Object} query - a mongoquery filter to apply to each fetched asterism
 * @returns {Promise} - resolves to an array of matched asterisms.
 */
export function loadAsterismCatalog(query={}) {
  promiseAsterismCatalog = promiseAsterismCatalog || fetch('/assets/asterisms.json');
  let sifter = asterisms => sift(query, asterisms);
  return promiseAsterismCatalog
    .then(jsonOrDeath)
    .then(asterisms => asterisms.map(formatAsterism))
    .then(sifter)
    .catch(err => {
      promiseAsterismCatalog = null;
      throw err;
    })
}


function formatStar(star) {
  return {
    id: star.hd,
    rightAscension: star.rarad,
    declination: star.decrad - Math.PI/2,
    magnitude: star.mag
  };
}


function formatAsterism(asterism) {
  return Object.assign({}, asterism, {
    starCounts: [].concat(...asterism.stars)
    .reduce((counters, id) => {
      let counter = counters.find(counter => counter.id === id);
      if (!counter) counters.push(counter = {id, count: 0});
      counter.count += 1;
      return counters;
    }, [])
  });
}


function findQueryValues(query, key) {
  return [
    query[key],
    ...[].concat(
      ...Object.keys(query).map(k => query[k])
        .filter(v => typeof v === 'object')
        .map(obj => findQueryValues(obj, key))
    )
  ].filter(
    value => value
  );
}


function fetchStarCatalogFilesByMagnitude(magnitude) {
  let files = starCatalogBuckets
    .filter(({min, max}) => min < magnitude || magnitude > max)
    .map(({file}) => file);

  return Promise.all(
    ['hd_asterisms.json', ...files].map(fetchStarCatalogFile)
  ).then(
    fileContents => [].concat(...fileContents)
  )
}

function fetchStarCatalogFile(file) {
  promiseStarCatalogs[file] = promiseStarCatalogs[file] || fetch(`/assets/${file}`);
  return promiseStarCatalogs[file]
    .then(jsonOrDeath)
    .then(stars => stars.map(formatStar))
    .catch(err => {
      promiseStarCatalogs[file] = null;
      throw err;
    });
}
