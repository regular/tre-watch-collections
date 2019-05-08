const pull = require('pull-stream')
const computed = require('mutant/computed')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const debug = require('debug')('tre-watch-collections')

const collectMutations = require('collect-mutations')
const WatchMerged = require('tre-prototypes')

module.exports = function(ssb) {
  const watchMerged = WatchMerged(ssb)

  return function watchCollection(source, map, opts) {
    opts = opts || {}
    const sync = opts.sync !== false
    const allowAllAuthors = opts.allowAllAuthors == true
    const suppressIntermediate = opts.suppressIntermediate !== false
    const comparer = opts.comparer || kvcomp
    const resolvePrototypes = opts.resolvePrototypes !== false

    let items = MutantArray()
    let result = items
    if (resolvePrototypes) {
      result = MutantMap(result, headObs => {
        const mergedObs = watchMerged(headObs, {
          allowAllAuthors,
          suppressIntermediate
        })
        return mergedObs
      }, {comparer})
    }
    result = MutantMap(result, kv => kv && map(kv), {
      onListen, onUnlisten
    })

    let drain
    let abortWatch
    function onListen() {
      debug('on listen')
      drain = collectMutations(items, {sync})
      pull(
        source,
        //pull.through(debug),
        drain
      )
    }
    function onUnlisten() {
      debug('on unlisten')
      drain.abort()
    }
    return result
  }
}

// -- utils

function kvcomp(a,b) {
  a = typeof a == 'function' ? a() : a
  b = typeof b == 'function' ? b() : b
  //console.log(a, '==', b)
  if (!a && !b) return true
  const ak = a && a.key
  const bk = b && b.key
  return ak == bk
}
