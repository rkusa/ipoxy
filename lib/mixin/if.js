var BaseMixin = require('./base')

var IfMixin = module.exports = function(locals, template) {
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
    var children = []
    content.forEach(function(child) {
      var vnodes = child(this.locals)
      if (Array.isArray(vnodes)) {
        children.push.apply(children, vnodes)
      } else {
        children.push(vnodes)
      }
    }, this)
    return children
  }

  return []
}
