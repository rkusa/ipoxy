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

  return this.get()
}

var immutable = require('immutable')
Model.alias = function(alias, fns) {
  var local = new immutable.Map
  var model = new Model(fns)

  return new Model({
    get: function() {
      return local = local.set(alias, model.get())
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
