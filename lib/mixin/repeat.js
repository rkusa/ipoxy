'use strict'

var BaseMixin = require('./base')
var Model = require('../model')

var RepeatMixin = module.exports = function RepeatMixin() {
  BaseMixin.apply(this, arguments)
}

RepeatMixin.prototype = Object.create(BaseMixin.prototype, {
  constructor: { value: RepeatMixin }
})

RepeatMixin.property = 'repeat'

RepeatMixin.isRepeatMixin = function(node) {
  return node.tagName === 'TEMPLATE' && node.hasAttribute('repeat')
}

RepeatMixin.prototype.execute = function(content) {
  var value = this.value
  if (!value) {
    return []
  }

  var self = this
  var children = []

  value.forEach(function(row, i) {
    var model = {
      get: function() {
        return self.value && (Array.isArray(self.value) ? self.value[i] : self.value.get(i))
      },
      set: function(val) {
        if (Array.isArray(self.value)) {
          self.value[i] = val
        } else {
          self.value.set(i, val)
        }
      }
    }

    var locals = self.locals.slice()
    var alias = this.contents[0].alias

    if (alias) {
      if (Array.isArray(alias)) {
        var local = {}
        local[alias[0]] = i
        locals.unshift(local)
        alias = alias[1]
      }

      locals.unshift(Model.alias(alias, model))
    } else {
      locals.unshift(new Model(model))
    }

    children.push.apply(children, content(locals, '.' + i))
  }, this)

  return children
}
