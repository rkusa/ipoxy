var BaseWidget = require('./base')

var HTMLWidget = module.exports = function() {
  BaseWidget.apply(this, arguments)
}

HTMLWidget.prototype = Object.create(BaseWidget.prototype, {
  constructor: { value: HTMLWidget }
})

HTMLWidget.prototype.init = function() {
  var fragment = document.createDocumentFragment()

  var tmp = document.createElement('div')
  tmp.innerHTML = this.value

  for (var child = tmp.firstChild; child; child = child.nextSibling) {
    fragment.appendChild(child)
  }

  return fragment
}
