'use strict'

var IfMixin = require('./if')

var UnlessMixin = module.exports = function UnlessMixin() {
  IfMixin.apply(this, arguments)
}

UnlessMixin.prototype = Object.create(IfMixin.prototype, {
  constructor: { value: UnlessMixin },
  condition:   {
    get: function() {
      var result = this.value
      return !(result && result !== 'false')
    },
    enumerable: true
  }
})

UnlessMixin.property = 'unless'

UnlessMixin.isUnlessMixin = function(node) {
  return node.tagName === 'TEMPLATE' && node.hasAttribute('unless')
}
