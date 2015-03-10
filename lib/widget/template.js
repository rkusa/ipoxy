var VNode = require('virtual-dom/vnode/vnode')
var createElement = require('virtual-dom/create-element')

var TemplateWidget = module.exports = function(template) {
  this.template = template
}

TemplateWidget.prototype.type = 'Widget'

TemplateWidget.prototype.init = function() {
  return this.template
}

TemplateWidget.prototype.update  = function() {
  return null
}
