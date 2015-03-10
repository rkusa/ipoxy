var BaseHook = require('./base')

var AttributeHook = module.exports = function() {
  BaseHook.apply(this, arguments)
}

AttributeHook.prototype = Object.create(BaseHook.prototype, {
  constructor: { value: AttributeHook }
})

AttributeHook.prototype.hook = function(node, name) {
  var value = this.value ? String(this.value) : ''
  if (value === '[object Object]') {
    value = ''
  }

  node.setAttribute(name, value || '')
}
