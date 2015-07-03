'use strict'

var BaseWidget = require('./base')

var HTMLWidget = module.exports = function() {
  BaseWidget.apply(this, arguments)
}

HTMLWidget.prototype = Object.create(BaseWidget.prototype, {
  constructor: { value: HTMLWidget }
})

HTMLWidget.prototype.init = function() {
  var fragment = document.createDocumentFragment()
  fragment.appendChild(document.createComment('{' + this.key))

  var tmp = document.createElement('div')
  tmp.innerHTML = this.value

  for (var child = tmp.firstChild; child; child = tmp.firstChild) {
    fragment.appendChild(child)
  }

  fragment.appendChild(document.createComment(this.key + '}'))

  return fragment
}

HTMLWidget.prototype._update = function(startNode) {
  if (startNode.nodeType === Node.COMMENT_NODE && startNode.textContent.substr(1) === this.key) {
    // remove DOMNodes between the fragments
    // start and end markers
    var node, next = startNode.nextSibling
    while ((node = next).nodeType !== Node.COMMENT_NODE || node.textContent !== this.key + '}') {
      next = node.nextSibling
      node.parentNode.removeChild(node)
    }
  }

  return this.init()
}

