var BaseWidget = require('../widget/base')

var BaseMixin = module.exports = function() {
  BaseWidget.apply(this, arguments)
}

Object.defineProperty(
  BaseMixin.prototype, 'value',
  Object.getOwnPropertyDescriptor(BaseWidget.prototype, 'value')
)

BaseMixin.prototype.set = BaseWidget.prototype.set

BaseMixin.prototype.execute = function() {}
