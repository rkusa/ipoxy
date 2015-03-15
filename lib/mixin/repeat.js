var BaseMixin = require('./base')
var Model = require('../model')
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
  var value = this.value
  if (!value) {
    return
  }

  var self = this
  var children = []
  value.forEach(function(row, i) {
    // var cursor = Cursor.from(value, [i], function(newData) {
    //   self.set(newData)
    // })

    function getFn() { return self.value.get(i) }
    function setFn(val) { self.value = self.value.set(i, val) }

    var locals = self.locals
    var alias = this.contents[0].alias

    if (alias) {
      if (Array.isArray(alias)) {
        var local = {}
        local[alias[0]] = i
        locals = locals.unshift(local)
        alias = alias[1]
      }

      locals = locals.unshift(Model.alias(alias, getFn, setFn))
    } else {
      locals = locals.unshift(new Model(getFn, setFn))
    }

    console.log(i, locals)

    children.push.apply(children, content(locals))
  }, this)

  return children
}
