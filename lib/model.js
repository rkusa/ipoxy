var Model = module.exports = function(getFn, setFn) {
  this.getFn = getFn
  this.setFn = setFn
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

var immutable = require('immutable')
Model.alias = function(alias, getFn, setFn) {
  var local = new immutable.Map

  return new Model(
    function() {
      return local = local.set(alias, getFn())
    },
    function(newVal) {
      setFn(newVal.get(alias))
    }
  )
}
