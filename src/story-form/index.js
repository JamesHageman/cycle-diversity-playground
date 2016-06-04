import serialize from 'form-serialize'
import R from 'ramda'
import { form, input } from '@cycle/dom'
import xs from 'xstream'
import isolate from '@cycle/isolate'

const trimName = R.over(R.lensProp('name'), R.trim)

const delay = (ms) => (stream) =>
  stream.map(val =>
    xs.periodic(ms).drop(1).take(1).mapTo(val)
  ).flatten()

const validate = (data) => {
  const ret = {}
  if (!data.name) {
    ret.name = 'You must specify a name'
  }
  return ret
}

const isValidSubmit = ({ data, validations }) =>
  data.isDirty && R.keys(validations).length === 0

const StoryForm = (sources) => {
  const defaultData = {
    name: '',
    isDirty: false
  }

  const internalReset$ = xs.createMimic()

  const submitEvent$ = sources.DOM.select('form').events('submit')

  const serializedFromSubmit$ = submitEvent$.map(e => R.mergeAll([
    defaultData,
    serialize(e.target, { hash: true }),
    {
      isDirty: true
    }
  ])
  ).map(trimName)

  const serializedFromReset$ = internalReset$.mapTo(defaultData)

  const serialized$ = xs.merge(
    serializedFromSubmit$,
    serializedFromReset$
  ).startWith(defaultData)

  const stateWithDerived$ = serialized$.map((data) => {
    return {
      data,
      validations: validate(data)
    }
  }).debug('stateWithDerived$')

  const submit$ = stateWithDerived$.filter(isValidSubmit)
    .map(R.prop('data'))

  internalReset$.imitate(submit$.compose(delay(10)).mapTo(1))

  return {
    DOM: stateWithDerived$.map(({ data, validations }) => form([
      input('.p1', {
        props: {
          type: 'text',
          name: 'name',
          placeholder: data.isDirty && validations.name || 'I would like to...',
          value: data.name
        }
      })
    ])),
    preventDefault: submitEvent$,
    submit$: submit$
  }
}

export default (sources) => isolate(StoryForm)(sources)
