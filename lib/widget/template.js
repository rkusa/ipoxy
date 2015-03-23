var VNode = require('virtual-dom/vnode/vnode')
var createElement = require('virtual-dom/create-element')
var applyProperties = require('virtual-dom/vdom/apply-properties')
var cloneNode = require('../import-node').cloneNode

var TemplateWidget = module.exports = function(id, locals, template, properties) {
  this.key        = id
  this.locals     = locals
  this.template   = template
  this.properties = properties
}

TemplateWidget.prototype.type = 'Widget'

TemplateWidget.prototype.init = function() {
  var template = document.createElement(
    'template',
    this.template.getAttribute('is')
  )

  applyProperties(template, this.properties(this.locals))

  for (var child = this.template.content.firstChild; child; child = child.nextSibling) {
    template.content.appendChild(cloneNode(child, true))
  }

  template.locals = this.locals

  return template
}

TemplateWidget.prototype.update  = function(prev, el) {
  applyProperties(el, this.properties(this.locals))

  return el
}
