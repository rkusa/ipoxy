var IfMixin = require('./if')

var UnlessMixin = module.exports = function UnlessMixin() {
  IfMixin.apply(this, arguments)
}

UnlessMixin.prototype = Object.create(IfMixin.prototype, {
  constructor: { value: UnlessMixin },
  condition: {
    enumerable: true,
    get: function() {
      var result = this.value
      return !(result && result !== 'false')
    }
  }
})

UnlessMixin.property = 'unless'

UnlessMixin.isUnlessMixin = function(node) {
  return node.tagName === 'TEMPLATE' && node.hasAttribute('unless')
}
