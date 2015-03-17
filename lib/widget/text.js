var BaseWidget = require('./base')

var TextWidget = module.exports = function() {
  BaseWidget.apply(this, arguments)

  this.oldValue = undefined
}

TextWidget.prototype = Object.create(BaseWidget.prototype, {
  constructor: { value: TextWidget }
})

TextWidget.prototype.init = function() {
  return document.createTextNode(this.oldValue = this.value)
}

TextWidget.prototype.update  = function(prev, el) {
  if (this.value !== this.oldValue) {
    return this._update(el)
  }

  return null
}

TextWidget.prototype._update = function(el) {
  el.nodeValue = this.oldValue = this.value
}
