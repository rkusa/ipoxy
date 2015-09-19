'use strict'

var Model = module.exports = function(fns) {
  this.getFn   = fns.get
  this.setFn   = fns.set
  this.eqlFn   = fns.eql
  this.stateFn = fns.state
}

Model.isModel = function(val) {
  return val && (val instanceof Model ||
    (typeof val.getFn === 'function'
      && typeof val.setFn === 'function'))
}

Model.updateProperty = function(obj, prop, val) {
  obj[prop] = val
  return obj
}

Model.createCursor = function(/*obj, path, callback*/) {
  throw new Error('No default implementation; a custom one must be provided')
}

Model.prototype.get = function() {
  if (this.getFn) {
    return this.getFn()
  }
}

Model.prototype.set = function(val) {
  if (this.setFn) {
    this.setFn(val)
  }
}

Model.prototype.eql = function(rhs) {
  if (this.eqlFn) {
    return this.eqlFn(rhs)
  }

  var cur = this.state()
  return rhs === cur
}

Model.prototype.state = function() {
  if (this.stateFn) {
    return this.stateFn()
  }

  var val = this.get()
  if (val && '_state' in val) {
    return val._state
  } else {
    return val
  }
}

Model.alias = function(alias, fns) {
  var local = {}
  var model = new Model(fns)

  return new Model({
    get: function() {
      local[alias] = model.get()
      return local
    },
    set: function(newVal) {
      model.set(newVal.get(alias))
    },
    eql: function(rhs) {
      return model.eql(rhs)
    },
    state: function() {
      return model.state()
    }
  })
}
