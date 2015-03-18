var BaseMixin = require('./base')
var Model = require('../model')

var RepeatMixin = module.exports = function(locals, template) {
  BaseMixin.apply(this, arguments)
}

RepeatMixin.prototype = Object.create(BaseMixin.prototype, {
  constructor: { value: RepeatMixin }
})

RepeatMixin.isRepeatTemplate = function(node) {
  return node.tagName === 'TEMPLATE' && node.hasAttribute('repeat')
}

RepeatMixin.prototype.execute = function(content) {
  var value = this.value
  if (!value) {
    return
  }

  var self = this
  var children = []

  value.forEach(function(row, i) {
    var model = {
      get: function() {
        return self.value.get(i)
      },
      set: function(val) {
        self.value = self.value.set(i, val)
      }
    }

    var locals = self.locals
    var alias = this.contents[0].alias

    if (alias) {
      if (Array.isArray(alias)) {
        var local = {}
        local[alias[0]] = i
        locals = locals.unshift(local)
        alias = alias[1]
      }

      locals = locals.unshift(Model.alias(alias, model))
    } else {
      locals = locals.unshift(new Model(model))
    }

    console.log(i, locals)

    children.push.apply(children, content(locals))
  }, this)

  return children
}
