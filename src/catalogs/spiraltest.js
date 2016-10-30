const RANGETHETA = t => t * 2 * Math.PI - Math.PI;
const RANGEPHI = t => t * Math.PI - Math.PI;

export default new Array(1000).join('.').split('.')
  .map((_, t, arr) => t / arr.length)
  .map(t => ({
    sra0: RANGETHETA(t*10),
    sdec0: RANGEPHI(t)
  }))
