import { chunk, find } from 'lodash'
import {loadAsterismCatalog, loadStarCatalog} from '../../../catalogs'

const orion = loadAsterismCatalog()
  .then(asterisms => find(asterisms, {name: 'Orion'}))
  .then(asterism => {
    const pairs = chunk(asterism.stars, 2)
    return loadStarCatalog({id: {$in: asterism.stars}})
      .then(stars => ({pairs, stars}))
  })

export default orion
