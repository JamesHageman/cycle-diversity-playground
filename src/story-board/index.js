import isolate from '@cycle/isolate'
import { div, h1, h2, ul, li, span, button, pre } from '@cycle/dom'
import { buckets } from '../api/buckets'
import R from 'ramda'
import xs from 'xstream'

import StoryForm from '../story-form'

const typeEq = R.propEq('type')

const createEventHandler = () => {
  const producer = {
    start (listener) {
      this._listener = listener
    },
    stop () {
      this._listener = null
    },
    _listener: null,
    handleValue (val) {
      if (this._listener) {
        this._listener.next(val)
      }
    }
  }

  const stream = xs.create(producer)

  return {
    stream,
    handler: val => producer.handleValue(val)
  }
}

const action = (type, payload = {}, meta = {}) => ({
  type,
  payload,
  meta
})

const renderBucket = onForwardStory => bucket => div('.border.p1.col.col-6', [
  h2(bucket.name),
  ul(bucket.stories.map(story => li([
    span('.mr1', [ `${story.id}: ${story.name}` ]),
    button({
      props: {
        onclick: () => onForwardStory({
          storyId: story.id,
          bucketId: bucket.id,
        })
      }
    }, ['>'])
  ])))
])

const view = (state$, formDom$, onForwardStory) => {
  return xs.combine((state, formDom) =>
    div('.px1.pb1.max-width-4.mx-auto', [
      h1('Cycle Buckets!'),
      div('.clearfix.mb1', [ formDom ]),
      div('.clearfix', state.orderedBuckets.map(renderBucket(onForwardStory))),
      pre([ JSON.stringify(state, null, 2) ])
    ]),
    state$, formDom$
  )
}

const getOrderedBuckets = (state) => {
  const { buckets, stories } = state
  return state.bucketOrder.map(bucketId => {
    const bucket = buckets[bucketId]
    return R.merge(bucket, {
      id: bucketId,
      stories: bucket.stories.map(id => R.assoc('id', id, stories[id]))
    })
  })
}

const initialState = {
  buckets: {},
  stories: {},
  bucketOrder: [],
}

const nextStoryId = R.pipe(
  R.prop('stories'),
  R.keys,
  (keys) => keys.length ? keys : [ -1 ],
  R.sortBy(R.identity),
  R.last,
  R.inc
)

const reducer = (state = initialState, action) => R.cond([
  [typeEq('BUCKETS_LOAD'), R.compose(R.merge(state), R.prop('payload'))],

  [typeEq('STORY_ADD'), (action) => {
    const { story } = action.payload
    const id = nextStoryId(state)
    const addToStories = R.over(R.lensProp('stories'), R.assoc(id, story))
    const addToBucket = R.over(R.lensPath(['buckets', 0, 'stories']), R.append(id))
    return R.pipe(addToStories, addToBucket)(state)
  }],

  [typeEq('FORWARD_STORY'), (action) => {
    const { storyId, bucketId } = action.payload

    const currentBucketIndex = R.findIndex(
      R.equals(bucketId),
      state.bucketOrder
    )

    if (currentBucketIndex === state.bucketOrder.length - 1 ||
        currentBucketIndex === -1) {
      return state
    }

    const nextBucketIndex = currentBucketIndex + 1
    const nextId = state.bucketOrder[nextBucketIndex]

    const removeFromCurrent = R.over(
      R.lensPath(['buckets', bucketId, 'stories']),
      R.filter(id => id !== storyId)
    )

    const addToNext = R.over(
      R.lensPath(['buckets', nextId, 'stories']),
      R.append(storyId)
    )

    return R.compose(addToNext, removeFromCurrent)(state)
  }],
  [R.T, () => state]
])(action)

const state = ({ bucketsLoad$, addStory$, forwardStory$ }) => {
  const action$ = xs.merge(
    addStory$.map(({ name }) => action('STORY_ADD', { story: { name } })),

    bucketsLoad$.map(({ stories, buckets, bucketOrder }) =>
      action('BUCKETS_LOAD', { stories, buckets, bucketOrder })),

    forwardStory$.map(({ storyId, bucketId }) =>
      action('FORWARD_STORY', { storyId, bucketId }))
  ).debug('Action')

  return action$.fold((state, action) => reducer(state, action), initialState)
    .map(state => R.merge(state, {
      orderedBuckets: getOrderedBuckets(state)
    }))
}

const StoryBoard = (sources) => {
  const {
    stream: forwardStory$,
    handler: onForwardStory
  } = createEventHandler()

  const storyForm = StoryForm(sources)

  const bucketsLoad$ = sources.api
    .ofType('BUCKETS_LOAD')
    .map(R.prop('data'))

  const addStory$ = storyForm.submit$

  const state$ = state({
    bucketsLoad$,
    addStory$,
    forwardStory$
  }).debug('State')

  return {
    DOM: view(state$, storyForm.DOM, onForwardStory),
    api: xs.of({ method: buckets }),
    preventDefault: xs.merge(storyForm.preventDefault),
  }
}

export default sources => isolate(StoryBoard)(sources)
