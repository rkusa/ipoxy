var BaseMixin = require('./base')

var IfMixin = module.exports = function() {
  BaseMixin.apply(this, arguments)
}

IfMixin.prototype = Object.create(BaseMixin.prototype, {
  constructor: { value: IfMixin },
  condition: {
    enumerable: true,
    get: function() {
      var result = this.value
      return result && result !== 'false'
    }
  }
})

IfMixin.isIfTemplate = function(node) {
  return node.tagName === 'TEMPLATE' && node.hasAttribute('if')
}

IfMixin.prototype.execute = function(content) {
  if (this.template.isEmpty) {
    this.content.render()
    return
  }

  if (this.condition) {
    return content(this.locals)
  }

  return []
}
