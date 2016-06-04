
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const MOCK_BUCKETS = {
  buckets: {
    0: {
      name: 'Backlog',
      stories: [ 1, 0 ]
    },
    1: {
      name: 'Sprint 1',
      stories: []
    }
  },
  stories: {
    0: {
      name: 'Learn Cycle.js'
    },
    1: {
      name: 'Learn xstream'
    }
  }
}

export const buckets = () => {
  return delay(500).then(() => ({
    type: 'BUCKETS_LOAD',
    data: MOCK_BUCKETS
  }))
}
