import isolate from '@cycle/isolate'
import { div, h1, h2, ul, li, span, button } from '@cycle/dom'
import { buckets } from '../api/buckets'
import R from 'ramda'
import xs from 'xstream'

import StoryForm from '../story-form'

const action = (type, payload = {}, meta = {}) => ({
  type,
  payload,
  meta
})

const renderBucket = (bucket) => div('.border.p1.col.col-6', [
  h2(bucket.name),
  ul(bucket.stories.map(story => li([
    span('.mr1', [ `${story.id}: ${story.name}` ]),
    button('>')
  ])))
])

const view = (state$, formDom$) => {
  return xs.combine(({ orderedBuckets }, formDom) =>
    div('.px1.pb1.max-width-4.mx-auto', [
      h1('Cycle Buckets!'),
      div('.clearfix.mb1', [ formDom ]),
      div('.clearfix', orderedBuckets.map(renderBucket))
    ]),
    state$, formDom$
  )
}

const getOrderedBuckets = (state) => {
  const { buckets, stories } = state
  return R.values(buckets).map(bucket => R.merge(bucket, {
    stories: bucket.stories.map(id => R.assoc('id', id, stories[id]))
  }))
}

const initialState = {
  buckets: {},
  stories: {},
  orderedBuckets: []
}

const nextStoryId = R.pipe(
  R.prop('stories'),
  R.keys,
  (keys) => keys.length ? keys : [ -1 ],
  R.sortBy(R.identity),
  R.last,
  R.inc
)

const reducer = (state = initialState, action) => {
  switch (action.type) {
    case 'BUCKETS_LOAD':
      return R.merge(state, action.payload)
    case 'STORY_ADD':
      const { story } = action.payload
      const id = nextStoryId(state)
      const addToStories = R.over(R.lensProp('stories'), R.assoc(id, story))
      const addToBucket = R.over(R.lensPath(['buckets', 0, 'stories']), R.append(id))
      return R.pipe(addToStories, addToBucket)(state)
    default:
      return state
  }
}

const state = ({ bucketsLoad$, addStory$ }) => {
  const action$ = xs.merge(
    addStory$.map(({ name }) => action('STORY_ADD', { story: { name } })),

    bucketsLoad$.map(({ stories, buckets }) =>
      action('BUCKETS_LOAD', { stories, buckets }))
  ).debug('Action')

  return action$.fold((state, action) => reducer(state, action), initialState)
    .map(state => R.merge(state, {
      orderedBuckets: getOrderedBuckets(state)
    }))
}

const StoryBoard = (sources) => {
  const storyForm = StoryForm(sources)

  const bucketsLoad$ = sources.api
    .filter(R.propEq('type', 'BUCKETS_LOAD'))
    .map(R.prop('data'))

  const addStory$ = storyForm.submit$

  const state$ = state({
    bucketsLoad$,
    addStory$
  }).debug('State')

  return {
    DOM: view(state$, storyForm.DOM),
    api: xs.of({ method: buckets }),
    preventDefault: xs.merge(storyForm.preventDefault),
    debug: storyForm.submit$
  }
}

export default sources => isolate(StoryBoard)(sources)
