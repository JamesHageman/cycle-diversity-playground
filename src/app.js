// import 'es6-shim'
import 'normalize-css'
import xs from 'xstream'
import Cycle from '@cycle/xstream-run'
import {makeDOMDriver} from '@cycle/dom'

import StoryBoard from './story-board'

const drivers = {
  DOM: makeDOMDriver('#app'),
  api: (api$) => {
    return api$
      .map(({ method, args }) => xs.fromPromise(method(...(args || []))))
      .flatten()
  },
  preventDefault: (event$) => {
    event$.addListener({
      next: e => {
        e.preventDefault()
      },
      error: err => console.error(err),
      complete: () => {}
    })

    return {}
  },
  debug: (any$) => {
    any$.addListener({
      next: x => console.log(x),
      error: err => console.log(err),
      complete: () => {}
    })
    return {}
  }
}

Cycle.run(StoryBoard, drivers)
