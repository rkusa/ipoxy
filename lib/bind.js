'use strict'

var Model      = require('./model')
var isTemplate = require('./utils').isTemplate

var VNode = require('virtual-dom/vnode/vnode')
var VText = require('virtual-dom/vnode/vtext')
var diff  = require('virtual-dom/diff')
var patch = require('virtual-dom/patch')

var started = false
var observing = []

function start() {
  if (started) {
    return
  }

  started = true

  var frameLength = 33 // this is ~1/30th of a second, in milliseconds (1000/30)
  var lastFrame = 0
  requestAnimationFrame(function animate(delta) {
    if(delta - lastFrame > frameLength) {
      lastFrame = delta

      for (var i = 0; i < observing.length; ++i) {
        var o = observing[i]

        if (!o.root.parentNode) { // removed from DOM
          observing.splice(i--, 1) // remove
          continue
        }

        var hasChanged = false
        for (var j = 0, len = o.handlers.length; j < len; ++j) {
          var handler = o.handlers[j]
          hasChanged = !handler.model.eql(handler.before)
          if (hasChanged) {
            break
          }
        }

        if (hasChanged) {
          // reset changed state on all handlers of the current observer
          for (j = 0, len = o.handlers.length; j < len; ++j) {
            handler = o.handlers[j]
            handler.before = handler.model.state()
          }

          // call update callback
          o.callback()
        }
      }
    }

    requestAnimationFrame(animate)
  })
}

function observe(root, handlers, callback) {
  if (!handlers.length) {
    return
  }

  observing.push({ root: root, handlers: handlers, callback: callback })
  start()
}

module.exports = function bind(target, template, locals) {
  if(!target || target.nodeType !== Node.ELEMENT_NODE) {
    throw new TypeError('Target must be an element node')
  }

  if (!isTemplate(template)) {
    locals = template
    template = undefined
  }

  if (locals === undefined) {
    locals = []
  }

  if (typeof locals !== 'object') {
    throw new TypeError('locals must be an object or an array')
  }

  locals = Array.isArray(locals) ? locals : [locals]

  var update = prepare(target, template && template.content || target)
  var vdom   = new VNode(target.tagName, {}, [])
  var root   = target //createElement(vdom)
  target.innerHTML = '' // clear
  // target.parentNode.replaceChild(root, target)

  var updateFn = function() {
    var updated = update(locals)
    // console.log('CHANGED', root, vdom, updated)
    root = patch(root, diff(vdom, updated))
    vdom = updated
  }

  updateFn()

  var handlers = locals.filter(function(local) {
    return Model.isModel(local)
  }).map(function(local) {
    return {
      before: local.state(),
      model:  local
    }
  })

  observe(root, handlers, updateFn)
  start()

  return updateFn
}

function prepare(target, root) {
  var ctx = { nextId: 1 }
  var children = prepareChildren(ctx, root)
  var properties = prepareProperties(ctx, target)
  return function(locals) {
    return new VNode(target.tagName, properties(locals), children(locals))
  }
}

function prepareChildren(ctx, node) {
  var children = []
  for (var child = node.firstChild; child; child = child.nextSibling) {
    switch (child.nodeType) {
      case Node.ELEMENT_NODE:
        children.push.apply(children, visitElementNode(ctx, child))
        break
      case Node.TEXT_NODE:
        children.push.apply(children, visitTextNode(ctx, child))
        break
      default:
        continue
    }
  }

  return function(locals, keySuffix) {
    keySuffix = keySuffix || ''

    var childs = []
    children.forEach(function(fn) {
      var vnodes = fn(locals, keySuffix)
      if (Array.isArray(vnodes)) {
        childs.push.apply(childs, vnodes)
      } else {
        childs.push(vnodes)
      }
    })
    return childs
  }
}

function prepareProperties(ctx, node) {
  var attributes = {}
  var properties = {}

  for (var i = 0, len = node.attributes.length; i < len; ++i) {
    var attr = node.attributes[i]
    var prop = visitAttributeNode(ctx, node, attr)
    if (typeof prop === 'function') {
      properties[attr.name] = prop
    } else {
      attributes[attr.name] = prop
    }
  }

  var handler = function(locals) {
    var props = { attributes: attributes }
    for (var key in properties) {
      props[key] = properties[key](locals)
    }
    return props
  }
  handler.properties = properties

  return handler
}

var parser = require('./parser')
var ast    = require('./parser/ast')

var TemplateWidget = require('./widget/template')
var RepeatMixin = require('./mixin/repeat')
var IfMixin = require('./mixin/if')
var UnlessMixin = require('./mixin/unless')
var InputHook = require('./hook/input')

var MIXINS = [IfMixin, UnlessMixin, RepeatMixin]

function visitElementNode(ctx, node) {
  var tagName    = node.tagName
  var properties = prepareProperties(ctx, node)
  var namespace  = getNamespace(node)

  var id = ctx.nextId++

  if (isTemplate(node)) {
    var head

    MIXINS.forEach(function(Mixin) {
      if (!Mixin['is' + Mixin.name](node)) {
        return
      }

      var template = parser.parse(node.getAttribute(Mixin.property) || '') || null

      if (!template.isSingleExpression) {
        throw new TypeError('Only one single expression allowd for mixins, '
                          + 'got: ' + template.source)
      }

      var content = head || prepareChildren(ctx, node.content)

      head = function(locals, keySuffix) {
        var mixin = new Mixin(id + keySuffix, locals, template)
        return mixin.execute(content) || []
      }
    })

    if (head) {
      return [head]
    }

    return [function(locals, keySuffix) {
      keySuffix = keySuffix || ''
      return new TemplateWidget(id + keySuffix, locals, node, properties)
    }]
  }

  var children = prepareChildren(ctx, node)

  if (node.tagName === 'TEXTAREA') {
    var inputId = ctx.nextId++
    properties.properties['input-hook'] = function(locals, keySuffix) {
      return new InputHook(inputId + keySuffix, locals, parser.parse(node.value))
    }
  }

  return [function(locals, keySuffix) {
    return new VNode(tagName, properties(locals), children(locals), id + keySuffix, namespace)
  }]
}

var TextWidget = require('./widget/text')
var HTMLWidget = require('./widget/html')

function visitTextNode(ctx, node) {
  // ignore formatting
  if (node.nodeValue.match(/^\s+$/)) {
    return []
  }

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

      var id = ctx.nextId++

      if (!isHTML) {
        return function(locals) {
          return new TextWidget(id, locals, child)
        }
      } else {
        return function(locals) {
          return new HTMLWidget(id, locals, child)
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

function visitAttributeNode(ctx, node, attr) {
  var template = parser.parse(attr.value)

  if (!template.hasExpressions) {
    return attr.value
  }

  var id = ctx.nextId++

  if (BooleanAttributeHook.isBooleanAttribute(node, attr)) {
    return function(locals) {
      return new BooleanAttributeHook(id, locals, template)
    }
  }

  if ((node instanceof HTMLInputElement || node instanceof HTMLSelectElement) && attr.name === 'value') {
    return function(locals) {
      return new InputHook(id, locals, template)
    }
  }

  return function(locals) {
    return new AttributeHook(id, locals, template)
  }
}

function getNamespace(el) {
  return el.namespaceURI === 'http://www.w3.org/1999/xhtml'
    ? null
    : el.namespaceURI
}
