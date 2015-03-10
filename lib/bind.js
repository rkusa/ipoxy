var immutable = require('immutable')
var Model = require('./model')

var VNode = require('virtual-dom/vnode/vnode')
var VText = require('virtual-dom/vnode/vtext')
var diff  = require('virtual-dom/diff')
var patch = require('virtual-dom/patch')
var createElement = require('virtual-dom/create-element')

var updateHandler = []

module.exports = function bind(target, template, locals) {
  if(target.nodeType !== Node.ELEMENT_NODE) {
    throw new TypeError('Target must be an element node')
  }

  if (!immutable.Stack.isStack(locals)) {
    locals = new immutable.Stack(Array.isArray(locals) ? locals : [locals])
  }

  var update = prepare(target.tagName, template.content)
  var vdom   = update(locals)
  var root   = createElement(vdom)
  target.parentNode.replaceChild(root, target)

  var updateFn = function() {
    var updated = update(locals)
    root = patch(root, diff(vdom, updated))
    vdom = updated
  }

  var handlers = locals.filter(function(local) {
    return Model.isModel(local)
  }).map(function(local) {
    return {
      before: local.get(),
      model:  local
    }
  })

  if (handlers.size) {
    requestAnimationFrame(function animate() {
      if (!root.parentNode) { // removed from DOM
        return
      }

      var changed = handlers.filter(function(handler) {
        var current = handler.model.get()
        var hasChanged = handler.before !== current
        if (hasChanged) {
          handler.before = current
          return true
        } else {
          return false
        }
      })

      if (changed.size > 0) {
        updateFn()
      }

      requestAnimationFrame(animate)
    })
  }

  return updateFn
}

function prepare(tagName, root) {
  var children = prepareChildren(root)
  return function(locals) {
    var childs = []
    children.forEach(function(child) {
      var vnodes = child(locals)
      if (Array.isArray(vnodes)) {
        childs.push.apply(childs, vnodes)
      } else {
        childs.push(vnodes)
      }
    })
    return new VNode(tagName, {}, childs)
  }
}

function prepareChildren(node) {
  var children = []
  for (var child = node.firstChild; child; child = child.nextSibling) {
    switch (child.nodeType) {
      case Node.ELEMENT_NODE:
        children.push.apply(children, visitElementNode(child))
        break
      case Node.TEXT_NODE:
        children.push.apply(children, visitTextNode(child))
        break
      default:
        continue
    }
  }
  return children
}

function prepareProperties(node) {
  var attrs = {}
  var props = { attributes: attrs }

  for (var i = 0, len = node.attributes.length; i < len; ++i) {
    var attr = node.attributes[i]
    var prop = visitAttributeNode(node, attr)
    if (typeof prop === 'function') {
      props[attr.name] = prop
    } else {
      attrs[attr.name] = prop
    }
  }

  return props
}

var parser = require('./parser')
var ast    = require('./parser/ast')

var TemplateWidget = require('./widget/template')
var RepeatMixin = require('./mixin/repeat')
var IfMixin = require('./mixin/if')
var UnlessMixin = require('./mixin/unless')
var InputHook = require('./hook/input')

function visitElementNode(node) {
  var tagName    = node.tagName
  var properties = prepareProperties(node)
  var namespace  = getNamespace(node)

  function props(locals) {
    var props = { attributes: properties.attributes }
    for (var key in properties) {
      if (key === 'attributes') {
        continue
      }
      props[key] = properties[key](locals)
    }
    return props
  }

  if (node instanceof HTMLTemplateElement) {
    var Mixin, prop
    switch (true) {
      case RepeatMixin.isRepeatTemplate(node):
        Mixin = RepeatMixin
        prop  = 'repeat'
        break
      case IfMixin.isIfTemplate(node):
        Mixin = IfMixin
        prop  = 'if'
        break
      case UnlessMixin.isUnlessTemplate(node):
        Mixin = UnlessMixin
        prop  = 'unless'
    }

    if (Mixin) {
      var template = parser.parse(node.getAttribute(prop) || '') || null

      if (!template.isSingleExpression) {
        throw new TypeError('Only one single expression allowd for repeat templates, '
                          + 'got: ' + template.source)
      }

      if (!template.isEmpty) {
        var content = prepareChildren(node.content)
        return [function(locals) {
          var mixin = new Mixin(locals, template)
          return mixin.execute(content)
        }]
      }
    }

    return [function(locals) {
      return new TemplateWidget(node)
    }]
  }

  var children = prepareChildren(node)

  if (node.tagName === 'TEXTAREA') {
    properties['input-hook'] = function(locals) {
      return new InputHook(locals, parser.parse(node.value))
    }
  }

  return [function(locals) {
    var childs = []
    children.forEach(function(child) {
      var vnodes = child(locals)
      if (Array.isArray(vnodes)) {
        childs.push.apply(childs, vnodes)
      } else {
        childs.push(vnodes)
      }
    })

    return new VNode(tagName, props(locals), childs, null, namespace)
  }]
}

var TextWidget = require('./widget/text')
var HTMLWidget = require('./widget/html')

function visitTextNode(node, locals) {
  var template = parser.parse(node.nodeValue)

  if (!template.hasExpressions) {
    var vtext = new VText(node.nodeValue)
    return [function() {
      return vtext
    }]
  }

  return template.body.map(function(child) {
    if (child instanceof ast.Expression) {
      var isHTML = false
      for (var i = 0, len = child.filters.length; i < len; ++i) {
        if (child.filters[i].name === 'html') {
          isHTML = true
          child.filters.splice(i, 1)
          break
        }
      }

      if (!isHTML) {
        return function(locals) {
          return new TextWidget(locals, child)
        }
      } else {
        return function(locals) {
          return new HTMLWidget(locals, child)
        }
      }
    } else {
      var value = new VText(child.text || '')
      return function() {
        return value
      }
    }
  })
}

// var RadioCheckedAttribute = require('./widget/attribute/radio')
var BooleanAttributeHook = require('./hook/boolean')
var AttributeHook = require('./hook/attribute')

function visitAttributeNode(node, attr) {
  var template = parser.parse(attr.value)

  if (!template.hasExpressions) {
    return attr.value
  }

  if (BooleanAttributeHook.isBooleanAttribute(node, attr)) {
    return function(locals) {
      return new BooleanAttributeHook(locals, template)
    }
  }

  if ((node instanceof HTMLInputElement || node instanceof HTMLSelectElement) && attr.name === 'value') {
    return function(locals) {
      return new InputHook(locals, template)
    }
  }

  return function(locals) {
    return new AttributeHook(locals, template)
  }
}

function getNamespace(el) {
  return el.namespaceURI == 'http://www.w3.org/1999/xhtml'
    ? null
    : el.namespaceURI
}
