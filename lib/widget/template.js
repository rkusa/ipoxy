var VNode = require('virtual-dom/vnode/vnode')
var createElement = require('virtual-dom/create-element')
var importNode = require('../import-node')

var TemplateWidget = module.exports = function(template) {
  this.template = template
}

TemplateWidget.prototype.type = 'Widget'

TemplateWidget.prototype.init = function() {
  var template = document.createElement(
    'template',
    this.template.getAttribute('is')
  )

  for (var i = 0, len = this.template.attributes.length; i < len; ++i) {
    var attr = this.template.attributes[i]
    if (attr.name === 'is') {
      continue
    }

    template.setAttribute(attr.name, attr.value)
  }

  for (var child = this.template.content.firstChild; child; child = child.nextSibling) {
    template.content.appendChild(importNode(child, true))
  }

  return template
}

TemplateWidget.prototype.update  = function() {
  return null
}
