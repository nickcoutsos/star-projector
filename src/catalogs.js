import 'whatwg-fetch';
import sift from 'sift';

var promiseStarCatalog;
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
  promiseStarCatalog = promiseStarCatalog || fetch('/assets/hd.json');
  let sifter = stars => sift(query, stars);
  return promiseStarCatalog
    .then(jsonOrDeath)
    .then(stars => stars.map(formatStar))
    .then(sifter)
    .catch(err => {
      promiseStarCatalog = null;
      throw err;
    });
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
