var BaseHook = require('./base')

var InputHook = module.exports = function() {
  BaseHook.apply(this, arguments)
}

InputHook.prototype = Object.create(BaseHook.prototype, {
  constructor: { value: InputHook }
})

InputHook.prototype.hook = function(node) {
  var value = this.value

  // <select value="{{ foobar }}"></select>
  if (node.tagName === 'SELECT') {
    if (value === undefined || value === '') return
    var option = node.querySelector('option[value="' + value + '"]')
    if (option) {
      option.selected = true
    }
  }
  // otherwise
  else {
    node.value = value || ''
  }

  var self = this
  node.addEventListener('change', this._onchange = function() {
    var value = self.set(this.value)
    if (value !== this.value) {
      this.value = value
    }
  })
}

InputHook.prototype.unhook = function (node) {
  if (this._onchange) {
    node.removeEventListener('change', this._onchange)
  }
}