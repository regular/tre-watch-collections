const pull = require('pull-stream')
const multicb = require('multicb')
const {test, msg, rndKey} = require('ssb-revisions/test/test-helper')
const MutantArray = require('mutant/array')
const computed = require('mutant/computed')
const WatchCollections = require('../')

test('sync: false, resolvePrototypes: false', (t, db) => {
  const collection = WatchCollections(db)

  const keyA = rndKey()
  const keyB = rndKey()
  const a = msg(keyA)
  const b = msg(keyB)

  a.value.content.type = 'cat'
  b.value.content.type = 'cat'

  append(db, [a, b], seqs => {

    const cats = collection(
      db.revisions.messagesByType('cat', {sync: false, live: false}),
      x => x,
      {sync: false, resolvePrototypes: false}
    )

    let i=0
    const abort = cats(cats =>{
      console.log(cats)
      t.assert(i++ < 3, 'called twice')
      if (i==1) {
        t.equal(cats.length, 1, 'one cat')
        t.ok(cats.map(kv=>kv.key).includes(a.key), 'includes cat a')
      }
      if (i==2) {
        t.equal(cats.length, 2, 'two cats')
        t.ok(cats.map(kv=>kv.key).includes(a.key), 'includes cat a')
        t.ok(cats.map(kv=>kv.key).includes(b.key), 'includes cat b')
        abort()
        t.end()
      }
    })
  })
})

test('two listeners', (t, db) => {
  const collection = WatchCollections(db)

  const keyA = rndKey()
  const keyB = rndKey()
  const a = msg(keyA)
  const b = msg(keyB)

  a.value.content.type = 'cat'
  b.value.content.type = 'cat'

  append(db, [a, b], seqs => {

    const cats = collection(
      db.revisions.messagesByType('cat', {sync: false, live: false}),
      x => x,
      {sync: false, resolvePrototypes: false}
    )

    let i=0
    const abort1 = cats(cats =>{
      console.log('1st listener', cats)
      i++
      if (i==1) {
        t.equal(cats.length, 1, 'one cat')
      }
      if (i==2) {
        t.equal(cats.length, 2, 'two cats')
        t.ok(cats.map(kv=>kv.key).includes(a.key), 'includes cat a')
        t.ok(cats.map(kv=>kv.key).includes(b.key), 'includes cat b')
        console.log('abort1')
        abort1()
        t.end()
      }
    })
    const abort2 = cats(cats =>{
      console.log('2nd listener', cats)
      t.equal(cats.length, 1, 'one cat')
      console.log('abort2')
      abort2()
    })
  })
})


test('sync: true, resolvePrototypes: false', (t, db) => {
  const collection = WatchCollections(db)

  const keyA = rndKey()
  const keyB = rndKey()
  const a = msg(keyA)
  const b = msg(keyB)

  a.value.content.type = 'cat'
  b.value.content.type = 'cat'

  append(db, [a, b], seqs => {

    const cats = collection(
      db.revisions.messagesByType('cat', {sync: true, live: true}),
      x => x,
      {sync: true, resolvePrototypes: false}
    )

    let i=0
    const abort = cats(cats =>{
      console.log(cats)
      t.assert(i++ < 2, 'called once')
      t.equal(cats.length, 2, 'two cats')
      t.ok(cats.map(kv=>kv.key).includes(a.key), 'includes cat a')
      t.ok(cats.map(kv=>kv.key).includes(b.key), 'includes cat b')
      abort()
      t.end()
    })
  })
})

test('defaultOpts, map', (t, db) => {
  const collection = WatchCollections(db)

  const keyA = rndKey()
  const keyB = rndKey()
  const a = msg(keyA)
  const b = msg(keyB)

  a.value.content.type = 'cat'
  a.value.content.foo = 'bar'

  b.value.content.type = 'cat' // indexing doesn't know about prototypes
  b.value.content.prototype = keyA

  append(db, [a, b], seqs => {
    let mapCalled = 0
    let listenerCalled = 0
    const cats = collection(
      db.revisions.messagesByType('cat', {sync: true, live: true}),
      obs => {
        console.log('MAP')
        mapCalled++
        return computed(obs, kv => kv && kv.value.content.foo)
      }
    )

    const abort = cats(cats =>{
      listenerCalled ++
      console.log('cats', cats)
      if (listenerCalled == 2) {
        t.equal(mapCalled, 2, 'map was called twice')
        t.equal(cats.length, 2, 'two cats')
        t.deepEqual(cats, ['bar','bar'], 'both have .foo == bar')
        abort()
        t.end()
      }
    })
  })
})


// -- utils

function append(db, msgs, cb) {
  pull(
    pull.values(msgs),
    pull.asyncMap( (m, cb) => {
      db.append(m, cb)
    }),
    pull.asyncMap( (x, cb) => {
      setTimeout( ()=>cb(null, x), 100)
    }),
    pull.collect( (err, seqs)=>{
      if (err) {
        console.error('append failed')
        throw err
      }
      cb(seqs)
    })
  )
}
