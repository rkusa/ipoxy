var BaseWidget = require('../widget/base')

var BaseHook = module.exports = function() {
  BaseWidget.apply(this, arguments)
}

Object.defineProperty(
  BaseHook.prototype, 'value',
  Object.getOwnPropertyDescriptor(BaseWidget.prototype, 'value')
)

BaseHook.prototype.set = BaseWidget.prototype.set

BaseHook.prototype.hook = function(/*node, prop, prev*/) {}
BaseHook.prototype.unhook = function(/*node, prop, next*/) {}
