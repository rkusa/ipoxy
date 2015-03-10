var BaseMixin = require('./base')
var immutable = require('immutable')
var Cursor = require('immutable/contrib/cursor')
var VNode = require('virtual-dom/vnode/vnode')
var VText = require('virtual-dom/vnode/vtext')

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
  var self = this
  var children = []
  this.value.forEach(function(row, i) {
    var cursor = Cursor.from(this.value, [i], function(newData) {
      self.set(newData)
    })

    var locals, alias = this.contents[0].alias
    if (alias) {
      var context = new immutable.Map
      if (Array.isArray(alias)) {
        context = context.set(alias[0], i)
        context = context.set(alias[1], cursor)
      } else {
        context = context.set(alias, cursor)
      }

      locals = this.locals.unshift(context)
    } else {
      locals = new immutable.Stack([row])
    }

    content.forEach(function(child) {
      var vnodes = child(locals)
      if (Array.isArray(vnodes)) {
        children.push.apply(children, vnodes)
      } else {
        children.push(vnodes)
      }
    })
  }, this)

  return children
}
