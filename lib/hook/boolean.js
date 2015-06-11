var BaseHook = require('./base')

var BooleanAttributeHook = module.exports = function() {
  BaseHook.apply(this, arguments)
}

BooleanAttributeHook.prototype = Object.create(BaseHook.prototype, {
  constructor: { value: BooleanAttributeHook }
})

var BOOLEAN = ['checked', 'selected', 'disabled']
BooleanAttributeHook.isBooleanAttribute = function(node, attr) {
  return BOOLEAN.indexOf(attr.name) > -1
}

BooleanAttributeHook.prototype.hook = function(node, prop) {
  if (node.type === 'radio' && prop === 'checked') {
    node[prop] = String(this.value) === node.value
  } else {
    node[prop] = this.value ? true : false
  }

  if (prop === 'checked') {
    node.addEventListener('change', this._onchange = function() {
      switch (node.type) {
        case 'checkbox':
          self.value = node[prop]
          break
        case 'radio':
          if (node.value === 'true' || node.value === 'false') {
            self.value = node.value === 'true'
          } else {
            self.value = node.value
          }
          break
      }
    })
  }
}

BooleanAttributeHook.prototype.unhook = function (node) {
  if (this._onchange) {
    node.removeEventListener('change', this._onchange)
  }
}
