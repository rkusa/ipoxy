var Model = module.exports = function(getFn, setFn) {
  this.getFn = getFn
  this.setFn = setFn
}

Model.isModel = function(val) {
  return val instanceof Model ||
    (typeof val.getFn === 'function'
      && typeof val.setFn === 'function')
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
