'use strict'

var BaseHook = require('./base')

var AttributeHook = module.exports = function() {
  BaseHook.apply(this, arguments)
}

AttributeHook.prototype = Object.create(BaseHook.prototype, {
  constructor: { value: AttributeHook }
})

AttributeHook.prototype.hook = function(node, name) {
  var value = this.value !== undefined && this.value !== null ? String(this.value) : ''
  if (value === '[object Object]') {
    value = ''

    if (!(name in node)) {
      var reference = this.contents[0]
      var getter = function() {
        return reference.get()
      }
      getter.parent = reference.obj
      getter.key    = reference.key
      getter.alias  = reference.alias

      Object.defineProperty(node, name, {
        get: getter,
        set: function(val) {
          reference.set(val)
        },
        enumerable: true
      })
    }
  }

  node.setAttribute(name, value || '')
}
