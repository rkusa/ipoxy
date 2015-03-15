var VNode = require('virtual-dom/vnode/vnode')
var createElement = require('virtual-dom/create-element')
var applyProperties = require('virtual-dom/vdom/apply-properties')
var importNode = require('../import-node')

var TemplateWidget = module.exports = function(locals, template, properties) {
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
    template.content.appendChild(importNode(child, true))
  }

  template.locals = this.locals

  return template
}

TemplateWidget.prototype.update  = function() {
  return null
}
