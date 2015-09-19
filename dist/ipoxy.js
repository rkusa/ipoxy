(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.ipoxy = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

        for (var j = 0, len = o.handlers.length; j < len; ++j) {
          var handler = o.handlers[j]
          var hasChanged = !handler.model.eql(handler.before)
          if (hasChanged) {
            handler.before = handler.model.state()
            o.callback()
            break
          }
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

  if (typeof locals !== 'object') {
    throw new TypeError('locals must be an object or an array')
  }

  locals = locals && (Array.isArray(locals) ? locals : [locals]) || {}

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

},{"./hook/attribute":3,"./hook/boolean":5,"./hook/input":6,"./mixin/if":9,"./mixin/repeat":10,"./mixin/unless":11,"./model":12,"./parser":14,"./parser/ast":13,"./utils":16,"./widget/html":18,"./widget/template":19,"./widget/text":20,"virtual-dom/diff":25,"virtual-dom/patch":29,"virtual-dom/vnode/vnode":43,"virtual-dom/vnode/vtext":45}],2:[function(require,module,exports){
'use strict'

exports.filter = Object.create(null)

exports.registerFilter = function(name, fn) {
  exports.filter[name] = fn
}

exports.registerFilter('class', function(condition, name) {
  return condition ? name : ''
})

},{}],3:[function(require,module,exports){
'use strict'

var BaseHook = require('./base')

var AttributeHook = module.exports = function() {
  BaseHook.apply(this, arguments)
}

AttributeHook.prototype = Object.create(BaseHook.prototype, {
  constructor: { value: AttributeHook }
})

AttributeHook.prototype.hook = function(node, name) {
  var value = this.value !== undefined && this.value !== null ? String(this.value) : ''
  if (value === '[object Object]') {
    value = ''

    if (!(name in node)) {
      var reference = this.contents[0]
      var getter = function() {
        return reference.get()
      }
      getter.parent = reference.obj
      getter.key    = reference.key
      getter.alias  = reference.alias

      Object.defineProperty(node, name, {
        get: getter,
        set: function(val) {
          reference.set(val)
        },
        enumerable: true
      })
    }
  }

  node.setAttribute(name, value || '')
}

},{"./base":4}],4:[function(require,module,exports){
'use strict'

var BaseWidget = require('../widget/base')

var BaseHook = module.exports = function() {
  BaseWidget.apply(this, arguments)
}

Object.defineProperty(
  BaseHook.prototype, 'value',
  Object.getOwnPropertyDescriptor(BaseWidget.prototype, 'value')
)

BaseHook.prototype.set = BaseWidget.prototype.set

BaseHook.prototype.hook = function(/*node, prop, prev*/) {}
BaseHook.prototype.unhook = function(/*node, prop, next*/) {}

},{"../widget/base":17}],5:[function(require,module,exports){
'use strict'

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
    var self = this
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

},{"./base":4}],6:[function(require,module,exports){
'use strict'

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
    if (value === undefined || value === '') {
      return
    }

    // also update the selected html attribute, to make reset buttons work
    // as expected
    var selected = node.querySelectorAll('option[selected]')
    for (var i = 0; i < selected.length; ++i) {
      selected[i].removeAttribute('selected')
    }
    var option = node.querySelector('option[value="' + value + '"]')
    if (option) {
      option.setAttribute('selected', '')
      option.selected = true
    }
  }
  // otherwise
  else {
    node.value = value || ''
  }

  var self = this
  node.addEventListener('change', this._onchange = function() {
    var val = self.set(this.value)
    if (val !== this.value) {
      this.value = val
    }
  })
}

InputHook.prototype.unhook = function (node) {
  if (this._onchange) {
    node.removeEventListener('change', this._onchange)
  }
}

},{"./base":4}],7:[function(require,module,exports){
'use strict'

var parser = require('./parser')
exports.parse = parser.parse
exports.ast   = parser.ast

exports.registerFilter = require('./filter').registerFilter

exports.bind = require('./bind')

var utils = require('./utils')
exports.importNode = utils.importNode
exports.cloneNode  = utils.cloneNode
exports.isTemplate = utils.isTemplate

var Model = require('./model')
exports.model = function(fns) {
  return new Model(fns)
}
exports.alias = Model.alias

Object.defineProperties(exports, {
  updateProperty: {
    get: function() {
      return Model.updateProperty
    },
    set: function(fn) {
      Model.updateProperty = fn
    },
    enumerable: true
  },
  createCursor: {
    get: function() {
      return Model.createCursor
    },
    set: function(fn) {
      Model.createCursor = fn
    },
    enumerable: true
  }
})

},{"./bind":1,"./filter":2,"./model":12,"./parser":14,"./utils":16}],8:[function(require,module,exports){
'use strict'

var BaseWidget = require('../widget/base')

var BaseMixin = module.exports = function() {
  BaseWidget.apply(this, arguments)
}

Object.defineProperty(
  BaseMixin.prototype, 'value',
  Object.getOwnPropertyDescriptor(BaseWidget.prototype, 'value')
)

BaseMixin.prototype.set = BaseWidget.prototype.set

BaseMixin.prototype.execute = function() {}

},{"../widget/base":17}],9:[function(require,module,exports){
'use strict'

var BaseMixin = require('./base')

var IfMixin = module.exports = function IfMixin() {
  BaseMixin.apply(this, arguments)
}

IfMixin.prototype = Object.create(BaseMixin.prototype, {
  constructor: { value: IfMixin },
  condition:   {
    get: function() {
      var result = this.value
      return result && result !== 'false'
    },
    enumerable: true
  }
})

IfMixin.property = 'if'

IfMixin.isIfMixin = function(node) {
  return node.tagName === 'TEMPLATE' && node.hasAttribute('if')
}

IfMixin.prototype.execute = function(content) {
  if (this.template.isEmpty) {
    this.content.render()
    return []
  }

  if (this.condition) {
    return content(this.locals)
  }

  return []
}

},{"./base":8}],10:[function(require,module,exports){
'use strict'

var BaseMixin = require('./base')
var Model = require('../model')

var RepeatMixin = module.exports = function RepeatMixin() {
  BaseMixin.apply(this, arguments)
}

RepeatMixin.prototype = Object.create(BaseMixin.prototype, {
  constructor: { value: RepeatMixin }
})

RepeatMixin.property = 'repeat'

RepeatMixin.isRepeatMixin = function(node) {
  return node.tagName === 'TEMPLATE' && node.hasAttribute('repeat')
}

RepeatMixin.prototype.execute = function(content) {
  var value = this.value
  if (!value) {
    return []
  }

  var self = this
  var children = []

  value.forEach(function(row, i) {
    var model = {
      get: function() {
        return self.value && (Array.isArray(self.value) ? self.value[i] : self.value.get(i))
      },
      set: function(val) {
        if (Array.isArray(self.value)) {
          self.value[i] = val
        } else {
          self.value.set(i, val)
        }
      }
    }

    var locals = self.locals
    var alias = this.contents[0].alias

    if (alias) {
      if (Array.isArray(alias)) {
        var local = {}
        local[alias[0]] = i
        locals.unshift(local)
        alias = alias[1]
      }

      locals.unshift(Model.alias(alias, model))
    } else {
      locals.unshift(new Model(model))
    }

    children.push.apply(children, content(locals, '.' + i))
  }, this)

  return children
}

},{"../model":12,"./base":8}],11:[function(require,module,exports){
'use strict'

var IfMixin = require('./if')

var UnlessMixin = module.exports = function UnlessMixin() {
  IfMixin.apply(this, arguments)
}

UnlessMixin.prototype = Object.create(IfMixin.prototype, {
  constructor: { value: UnlessMixin },
  condition:   {
    get: function() {
      var result = this.value
      return !(result && result !== 'false')
    },
    enumerable: true
  }
})

UnlessMixin.property = 'unless'

UnlessMixin.isUnlessMixin = function(node) {
  return node.tagName === 'TEMPLATE' && node.hasAttribute('unless')
}

},{"./if":9}],12:[function(require,module,exports){
'use strict'

var Model = module.exports = function(fns) {
  this.getFn   = fns.get
  this.setFn   = fns.set
  this.eqlFn   = fns.eql
  this.stateFn = fns.state
}

Model.isModel = function(val) {
  return val && (val instanceof Model ||
    (typeof val.getFn === 'function'
      && typeof val.setFn === 'function'))
}

Model.updateProperty = function(obj, prop, val) {
  obj[prop] = val
  return obj
}

Model.createCursor = function(/*obj, path, callback*/) {
  throw new Error('No default implementation; a custom one must be provided')
}

Model.prototype.get = function() {
  if (this.getFn) {
    return this.getFn()
  }
}

Model.prototype.set = function(val) {
  if (this.setFn) {
    this.setFn(val)
  }
}

Model.prototype.eql = function(rhs) {
  if (this.eqlFn) {
    return this.eqlFn(rhs)
  }

  var cur = this.state()
  return rhs === cur
}

Model.prototype.state = function() {
  if (this.stateFn) {
    return this.stateFn()
  }

  var val = this.get()
  if (val && '_state' in val) {
    return val._state
  } else {
    return val
  }
}

Model.alias = function(alias, fns) {
  var local = {}
  var model = new Model(fns)

  return new Model({
    get: function() {
      local[alias] = model.get()
      return local
    },
    set: function(newVal) {
      model.set(newVal.get(alias))
    },
    eql: function(rhs) {
      return model.eql(rhs)
    },
    state: function() {
      return model.state()
    }
  })
}

},{}],13:[function(require,module,exports){
/*eslint-disable no-constant-condition, no-loop-func*/
'use strict'

var Program = exports.Program = function(body, source) {
  this.body   = body || []
  this.source = source
}

Program.prototype.compile = function(locals, opts) {
  return this.body.map(function(node) {
    return node.compile(locals, opts)
  })
}

Object.defineProperties(Program.prototype, {
  isSingleExpression: {
    get: function() {
      return this.body.length === 1 && this.body[0] instanceof Expression
    },
    enumerable: true
  },
  hasExpressions: {
    get: function() {
      return this.body.length > 1 ||
        (this.body.length && !(this.body[0] instanceof Text))
    },
    enumerable: true
  },
  isEmpty: {
    get: function() {
      return this.body.length === 0
    },
    enumerable: true
  }
})

var Text = exports.Text = function(text) {
  this.text = text
}

Text.prototype.compile = function() {
  return this.text
}

var Expression = exports.Expression = function(path, alias, filters) {
  this.path    = path
  this.alias   = alias
  this.filters = filters || []
}

Expression.prototype.compile = function(locals, opts) {
  var ref   = this.path.compile(locals)
  ref.alias = this.alias
  if (this.filters.length && opts && opts.filter) {
    ref.filters = this.filters.filter(function(filter) {
      return filter.name in opts.filter
    }).map(function(filter) {
      var fn = opts.filter[filter.name], dispose
      if ('initialize' in fn) {
        dispose = fn.initialize(ref)
      }
      return {
        name:    filter.name,
        fn:      fn,
        dispose: dispose,
        args:    filter.args && filter.args.map(function(arg) {
          if (arg && typeof arg.compile === 'function') {
            return arg.compile(locals)
          } else {
            return arg
          }
        })
      }
    })
  }
  return ref
}

var Model = require('../model')

var Path = exports.Path = function(path) {
  this.keys = path
}

Path.prototype.compile = function(locals) {
  if (!this.keys.length) {
    return new Reference(locals[0])
  }

  var path = this.keys.slice()

  var obj
  for (var i = 0, len = locals.length; i < len; ++i) {
    var local = locals[i]
    if (Model.isModel(local)) {
      local = local.get()
    }
    if (local.has && local.has(path[0]) || path[0] in local) {
      obj = locals[i]
      break
    }
  }

  if (obj === undefined) {
    console.warn('No locals for `' + path[0] + '` found')
    return new Reference()
  }

  var key = path.pop()
  var root, prop
  while (true) {
    if (Model.isModel(obj)) {
      var parent = obj
      obj = obj.get()

      if (!root) {
        root = obj
      }

      if (obj && typeof obj === 'object') {
        obj = Model.createCursor(obj, prop && [prop] || [], function(newData) {
          parent.set(newData)
        })
        continue
      }
    }

    if (!(prop = path.shift())) {
      break
    }

    if (obj && typeof obj.get === 'function') {
      obj = obj.get(prop)
    } else if (!obj || !(prop in obj)) {
      throw new Error('Path ' + this.keys.join('.') + ' not set')
    } else {
      obj = obj[prop]
    }
  }

  if (!obj) {
    console.warn('Try creating a reference for an undefined object')
  }

  return new Reference(obj, key, root || locals[i])
}

var Reference = exports.Reference = function(obj, key, root) {
  this.obj     = obj
  this.key     = key
  this.root    = root
  this.filters = []
}

Reference.prototype.get = function() {
  var result
  if (!this.key) {
    result = this.obj
  } else if (this.obj && typeof this.obj.get === 'function') {
    result = this.obj.get(this.key)
  } else {
    result = this.obj && this.obj[this.key]
  }

  for (var i = 0, len = this.filters.length; i < len; ++i) {
    var filter = this.filters[i]
    var fn     = filter.fn.get || filter.fn
    var args   = filter.args && filter.args.map(function(arg) {
      return arg instanceof Reference ? arg.get() : arg
    }) || []

    result = fn.apply(this, [result].concat(args))
  }
  return result
}

Reference.prototype.set = function(val) {
  if (!this.obj) {
    console.warn('Try setting an undefined reference')
    return undefined
  }

  for (var i = this.filters.length - 1; i >= 0; --i) {
    var filter = this.filters[i]
    if (!('set' in filter.fn)) {
      continue
    }

    var fn     = filter.fn.set
    var args   = filter.args && filter.args.map(function(arg) {
      return arg instanceof Reference ? arg.get() : args
    }) || []

    val = fn.apply(this, [val].concat(args))
  }

  if (!this.key) {
    this.obj = val
  } else {
    Model.updateProperty(this.obj, this.key, val)
  }

  return val
}

Reference.prototype.valueOf = Reference.prototype.toString = function() {
  return this.get()
}

Reference.prototype.dispose = function() {
  this.filters.forEach(function(filter) {
    if (filter.dispose) {
      filter.dispose()
    }
  })
}

exports.Filter = function(name, args) {
  this.name = name
  this.args = args
}

},{"../model":12}],14:[function(require,module,exports){
'use strict'

var parser = require('./parser').parser
exports.ast = parser.yy = require('./ast')

function parse(input) {
  var program = parser.parse(input)
  program.source = input
  return program
}

exports.parse = parse

},{"./ast":13,"./parser":15}],15:[function(require,module,exports){
(function (process){
/* parser generated by jison 0.4.15 */
/*
  Returns a Parser object of the following structure:

  Parser: {
    yy: {}
  }

  Parser.prototype: {
    yy: {},
    trace: function(),
    symbols_: {associative list: name ==> number},
    terminals_: {associative list: number ==> name},
    productions_: [...],
    performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$),
    table: [...],
    defaultActions: {...},
    parseError: function(str, hash),
    parse: function(input),

    lexer: {
        EOF: 1,
        parseError: function(str, hash),
        setInput: function(input),
        input: function(),
        unput: function(str),
        more: function(),
        less: function(n),
        pastInput: function(),
        upcomingInput: function(),
        showPosition: function(),
        test_match: function(regex_match_array, rule_index),
        next: function(),
        lex: function(),
        begin: function(condition),
        popState: function(),
        _currentRules: function(),
        topState: function(),
        pushState: function(condition),

        options: {
            ranges: boolean           (optional: true ==> token location info will include a .range[] member)
            flex: boolean             (optional: true ==> flex-like lexing behaviour where the rules are tested exhaustively to find the longest match)
            backtrack_lexer: boolean  (optional: true ==> lexer regexes are tested in order and for each matching regex the action code is invoked; the lexer terminates the scan when a token is returned by the action code)
        },

        performAction: function(yy, yy_, $avoiding_name_collisions, YY_START),
        rules: [...],
        conditions: {associative list: name ==> set},
    }
  }


  token location info (@$, _$, etc.): {
    first_line: n,
    last_line: n,
    first_column: n,
    last_column: n,
    range: [start_number, end_number]       (where the numbers are indexes into the input string, regular zero-based)
  }


  the parseError function receives a 'hash' object with these members for lexer and parser errors: {
    text:        (matched text)
    token:       (the produced terminal token, if any)
    line:        (yylineno)
  }
  while parser (grammar) errors will also provide these members, i.e. parser errors deliver a superset of attributes: {
    loc:         (yylloc)
    expected:    (string describing the set of expected tokens)
    recoverable: (boolean: TRUE when the parser has a error recovery rule available for this particular error)
  }
*/
var parser = (function(){
var o=function(k,v,o,l){for(o=o||{},l=k.length;l--;o[k[l]]=v);return o},$V0=[1,6],$V1=[1,7],$V2=[5,8,14],$V3=[1,14],$V4=[1,19],$V5=[1,20],$V6=[10,13,16,18,21,24],$V7=[13,21],$V8=[1,38],$V9=[1,39],$Va=[18,24];
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"expression":3,"body":4,"EOF":5,"parts":6,"part":7,"OPEN":8,"statement":9,"as":10,"alias":11,"filters":12,"CLOSE":13,"TEXT":14,"path":15,".":16,"identifier":17,",":18,"IDENTIFIER":19,"filter":20,"|":21,"(":22,"arguments":23,")":24,"argument":25,"string":26,"number":27,"STRING":28,"NUMBER":29,"$accept":0,"$end":1},
terminals_: {2:"error",5:"EOF",8:"OPEN",10:"as",13:"CLOSE",14:"TEXT",16:".",18:",",19:"IDENTIFIER",21:"|",22:"(",24:")",28:"STRING",29:"NUMBER"},
productions_: [0,[3,2],[3,1],[4,1],[6,2],[6,1],[7,6],[7,5],[7,4],[7,3],[7,2],[7,1],[9,1],[15,3],[15,1],[11,3],[11,1],[17,1],[12,2],[12,1],[20,5],[20,2],[23,3],[23,1],[25,1],[25,1],[25,1],[26,1],[27,1]],
performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */) {
/* this == yyval */

var $0 = $$.length - 1;
switch (yystate) {
case 1:
 return new yy.Program($$[$0-1]) 
break;
case 2:
 return new yy.Program() 
break;
case 3: case 12: case 16: case 17:
 this.$ = $$[$0] 
break;
case 4: case 18:
 $$[$0-1].push($$[$0]); this.$ = $$[$0-1] 
break;
case 5: case 14: case 19: case 23:
 this.$ = [$$[$0]] 
break;
case 6:
 this.$ = new yy.Expression(new yy.Path($$[$0-4]), $$[$0-2], $$[$0-1]) 
break;
case 7:
 this.$ = new yy.Expression(new yy.Path($$[$0-3]), $$[$0-1]) 
break;
case 8:
 this.$ = new yy.Expression(new yy.Path($$[$0-2]), undefined, $$[$0-1])
break;
case 9:
 this.$ = new yy.Expression(new yy.Path($$[$0-1])) 
break;
case 10:
 this.$ = new yy.Expression(new yy.Path([])) 
break;
case 11:
 this.$ = new yy.Text($$[$0]) 
break;
case 13: case 22:
 $$[$0-2].push($$[$0]); this.$ = $$[$0-2] 
break;
case 15:
 this.$ = [$$[$0-2], $$[$0]] 
break;
case 20:
 this.$ = new yy.Filter($$[$0-3], $$[$0-1]) 
break;
case 21:
 this.$ = new yy.Filter($$[$0]) 
break;
case 24: case 25:
 this.$ = $$[$0]
break;
case 26:
 this.$ = new yy.Path($$[$0]) 
break;
case 27:
 this.$ = $$[$0].slice(1, -1) 
break;
case 28:
 this.$ = parseFloat($$[$0], 10) 
break;
}
},
table: [{3:1,4:2,5:[1,3],6:4,7:5,8:$V0,14:$V1},{1:[3]},{5:[1,8]},{1:[2,2]},{5:[2,3],7:9,8:$V0,14:$V1},o($V2,[2,5]),{9:10,13:[1,11],15:12,17:13,19:$V3},o($V2,[2,11]),{1:[2,1]},o($V2,[2,4]),{10:[1,15],12:16,13:[1,17],20:18,21:$V4},o($V2,[2,10]),o([10,13,21],[2,12],{16:$V5}),o($V6,[2,14]),o([10,13,16,18,21,22,24],[2,17]),{11:21,17:22,19:$V3},{13:[1,23],20:24,21:$V4},o($V2,[2,9]),o($V7,[2,19]),{17:25,19:$V3},{17:26,19:$V3},{12:27,13:[1,28],20:18,21:$V4},o($V7,[2,16],{18:[1,29]}),o($V2,[2,8]),o($V7,[2,18]),o($V7,[2,21],{22:[1,30]}),o($V6,[2,13]),{13:[1,31],20:24,21:$V4},o($V2,[2,7]),{17:32,19:$V3},{15:37,17:13,19:$V3,23:33,25:34,26:35,27:36,28:$V8,29:$V9},o($V2,[2,6]),o($V7,[2,15]),{18:[1,41],24:[1,40]},o($Va,[2,23]),o($Va,[2,24]),o($Va,[2,25]),o($Va,[2,26],{16:$V5}),o($Va,[2,27]),o($Va,[2,28]),o($V7,[2,20]),{15:37,17:13,19:$V3,25:42,26:35,27:36,28:$V8,29:$V9},o($Va,[2,22])],
defaultActions: {3:[2,2],8:[2,1]},
parseError: function parseError(str, hash) {
    if (hash.recoverable) {
        this.trace(str);
    } else {
        throw new Error(str);
    }
},
parse: function parse(input) {
    var self = this, stack = [0], tstack = [], vstack = [null], lstack = [], table = this.table, yytext = '', yylineno = 0, yyleng = 0, recovering = 0, TERROR = 2, EOF = 1;
    var args = lstack.slice.call(arguments, 1);
    var lexer = Object.create(this.lexer);
    var sharedState = { yy: {} };
    for (var k in this.yy) {
        if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
            sharedState.yy[k] = this.yy[k];
        }
    }
    lexer.setInput(input, sharedState.yy);
    sharedState.yy.lexer = lexer;
    sharedState.yy.parser = this;
    if (typeof lexer.yylloc == 'undefined') {
        lexer.yylloc = {};
    }
    var yyloc = lexer.yylloc;
    lstack.push(yyloc);
    var ranges = lexer.options && lexer.options.ranges;
    if (typeof sharedState.yy.parseError === 'function') {
        this.parseError = sharedState.yy.parseError;
    } else {
        this.parseError = Object.getPrototypeOf(this).parseError;
    }
    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }
    _token_stack:
        function lex() {
            var token;
            token = lexer.lex() || EOF;
            if (typeof token !== 'number') {
                token = self.symbols_[token] || token;
            }
            return token;
        }
    var symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected;
    while (true) {
        state = stack[stack.length - 1];
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol === null || typeof symbol == 'undefined') {
                symbol = lex();
            }
            action = table[state] && table[state][symbol];
        }
                    if (typeof action === 'undefined' || !action.length || !action[0]) {
                var errStr = '';
                expected = [];
                for (p in table[state]) {
                    if (this.terminals_[p] && p > TERROR) {
                        expected.push('\'' + this.terminals_[p] + '\'');
                    }
                }
                if (lexer.showPosition) {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ':\n' + lexer.showPosition() + '\nExpecting ' + expected.join(', ') + ', got \'' + (this.terminals_[symbol] || symbol) + '\'';
                } else {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ': Unexpected ' + (symbol == EOF ? 'end of input' : '\'' + (this.terminals_[symbol] || symbol) + '\'');
                }
                this.parseError(errStr, {
                    text: lexer.match,
                    token: this.terminals_[symbol] || symbol,
                    line: lexer.yylineno,
                    loc: yyloc,
                    expected: expected
                });
            }
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol);
        }
        switch (action[0]) {
        case 1:
            stack.push(symbol);
            vstack.push(lexer.yytext);
            lstack.push(lexer.yylloc);
            stack.push(action[1]);
            symbol = null;
            if (!preErrorSymbol) {
                yyleng = lexer.yyleng;
                yytext = lexer.yytext;
                yylineno = lexer.yylineno;
                yyloc = lexer.yylloc;
                if (recovering > 0) {
                    recovering--;
                }
            } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
            }
            break;
        case 2:
            len = this.productions_[action[1]][1];
            yyval.$ = vstack[vstack.length - len];
            yyval._$ = {
                first_line: lstack[lstack.length - (len || 1)].first_line,
                last_line: lstack[lstack.length - 1].last_line,
                first_column: lstack[lstack.length - (len || 1)].first_column,
                last_column: lstack[lstack.length - 1].last_column
            };
            if (ranges) {
                yyval._$.range = [
                    lstack[lstack.length - (len || 1)].range[0],
                    lstack[lstack.length - 1].range[1]
                ];
            }
            r = this.performAction.apply(yyval, [
                yytext,
                yyleng,
                yylineno,
                sharedState.yy,
                action[1],
                vstack,
                lstack
            ].concat(args));
            if (typeof r !== 'undefined') {
                return r;
            }
            if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
                lstack = lstack.slice(0, -1 * len);
            }
            stack.push(this.productions_[action[1]][0]);
            vstack.push(yyval.$);
            lstack.push(yyval._$);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
        case 3:
            return true;
        }
    }
    return true;
}};
/* generated by jison-lex 0.3.4 */
var lexer = (function(){
var lexer = ({

EOF:1,

parseError:function parseError(str, hash) {
        if (this.yy.parser) {
            this.yy.parser.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },

// resets the lexer, sets new input
setInput:function (input, yy) {
        this.yy = yy || this.yy || {};
        this._input = input;
        this._more = this._backtrack = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {
            first_line: 1,
            first_column: 0,
            last_line: 1,
            last_column: 0
        };
        if (this.options.ranges) {
            this.yylloc.range = [0,0];
        }
        this.offset = 0;
        return this;
    },

// consumes and returns one char from the input
input:function () {
        var ch = this._input[0];
        this.yytext += ch;
        this.yyleng++;
        this.offset++;
        this.match += ch;
        this.matched += ch;
        var lines = ch.match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
        } else {
            this.yylloc.last_column++;
        }
        if (this.options.ranges) {
            this.yylloc.range[1]++;
        }

        this._input = this._input.slice(1);
        return ch;
    },

// unshifts one char (or a string) into the input
unput:function (ch) {
        var len = ch.length;
        var lines = ch.split(/(?:\r\n?|\n)/g);

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length - len);
        //this.yyleng -= len;
        this.offset -= len;
        var oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length - 1);
        this.matched = this.matched.substr(0, this.matched.length - 1);

        if (lines.length - 1) {
            this.yylineno -= lines.length - 1;
        }
        var r = this.yylloc.range;

        this.yylloc = {
            first_line: this.yylloc.first_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.first_column,
            last_column: lines ?
                (lines.length === oldLines.length ? this.yylloc.first_column : 0)
                 + oldLines[oldLines.length - lines.length].length - lines[0].length :
              this.yylloc.first_column - len
        };

        if (this.options.ranges) {
            this.yylloc.range = [r[0], r[0] + this.yyleng - len];
        }
        this.yyleng = this.yytext.length;
        return this;
    },

// When called from action, caches matched text and appends it on next action
more:function () {
        this._more = true;
        return this;
    },

// When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
reject:function () {
        if (this.options.backtrack_lexer) {
            this._backtrack = true;
        } else {
            return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n' + this.showPosition(), {
                text: "",
                token: null,
                line: this.yylineno
            });

        }
        return this;
    },

// retain first n characters of the match
less:function (n) {
        this.unput(this.match.slice(n));
    },

// displays already matched input, i.e. for error messages
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },

// displays upcoming input, i.e. for error messages
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20) + (next.length > 20 ? '...' : '')).replace(/\n/g, "");
    },

// displays the character position where the lexing error occurred, i.e. for error messages
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c + "^";
    },

// test the lexed token: return FALSE when not a match, otherwise return token
test_match:function (match, indexed_rule) {
        var token,
            lines,
            backup;

        if (this.options.backtrack_lexer) {
            // save context
            backup = {
                yylineno: this.yylineno,
                yylloc: {
                    first_line: this.yylloc.first_line,
                    last_line: this.last_line,
                    first_column: this.yylloc.first_column,
                    last_column: this.yylloc.last_column
                },
                yytext: this.yytext,
                match: this.match,
                matches: this.matches,
                matched: this.matched,
                yyleng: this.yyleng,
                offset: this.offset,
                _more: this._more,
                _input: this._input,
                yy: this.yy,
                conditionStack: this.conditionStack.slice(0),
                done: this.done
            };
            if (this.options.ranges) {
                backup.yylloc.range = this.yylloc.range.slice(0);
            }
        }

        lines = match[0].match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno += lines.length;
        }
        this.yylloc = {
            first_line: this.yylloc.last_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.last_column,
            last_column: lines ?
                         lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
                         this.yylloc.last_column + match[0].length
        };
        this.yytext += match[0];
        this.match += match[0];
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
            this.yylloc.range = [this.offset, this.offset += this.yyleng];
        }
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match[0].length);
        this.matched += match[0];
        token = this.performAction.call(this, this.yy, this, indexed_rule, this.conditionStack[this.conditionStack.length - 1]);
        if (this.done && this._input) {
            this.done = false;
        }
        if (token) {
            return token;
        } else if (this._backtrack) {
            // recover context
            for (var k in backup) {
                this[k] = backup[k];
            }
            return false; // rule action called reject() implying the next rule should be tested instead.
        }
        return false;
    },

// return next match in input
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) {
            this.done = true;
        }

        var token,
            match,
            tempMatch,
            index;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i = 0; i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (this.options.backtrack_lexer) {
                    token = this.test_match(tempMatch, rules[i]);
                    if (token !== false) {
                        return token;
                    } else if (this._backtrack) {
                        match = false;
                        continue; // rule action called reject() implying a rule MISmatch.
                    } else {
                        // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
                        return false;
                    }
                } else if (!this.options.flex) {
                    break;
                }
            }
        }
        if (match) {
            token = this.test_match(match, rules[index]);
            if (token !== false) {
                return token;
            }
            // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
            return false;
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. Unrecognized text.\n' + this.showPosition(), {
                text: "",
                token: null,
                line: this.yylineno
            });
        }
    },

// return next match that has a token
lex:function lex() {
        var r = this.next();
        if (r) {
            return r;
        } else {
            return this.lex();
        }
    },

// activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },

// pop the previously active lexer condition state off the condition stack
popState:function popState() {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
        }
    },

// produce the lexer rule set which is active for the currently active lexer condition state
_currentRules:function _currentRules() {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
            return this.conditions["INITIAL"].rules;
        }
    },

// return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
topState:function topState(n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
            return this.conditionStack[n];
        } else {
            return "INITIAL";
        }
    },

// alias for begin(condition)
pushState:function pushState(condition) {
        this.begin(condition);
    },

// return the number of states currently on the stack
stateStackSize:function stateStackSize() {
        return this.conditionStack.length;
    },
options: {},
performAction: function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {
var YYSTATE=YY_START;
switch($avoiding_name_collisions) {
case 0: this.begin('epoxy')
                          if (yy_.yytext) return 14 
break;
case 1: return 14; 
break;
case 2:/* skip whitespace */
break;
case 3: return 10 
break;
case 4: return 19 
break;
case 5: return 8 
break;
case 6: this.begin('INITIAL')
                          return 13 
break;
case 7: return 16 
break;
case 8: return 18 
break;
case 9: return 21 
break;
case 10: return 22 
break;
case 11: return 24 
break;
case 12: return 28 
break;
case 13: return 29 
break;
case 14: return 5 
break;
}
},
rules: [/^(?:[^\x00]*?(?=(\{\{)))/,/^(?:[^\x00]+)/,/^(?:\s+)/,/^(?:as\b)/,/^(?:(?!\d)[^\{\}\.\,\s\|\\'\(\)]+)/,/^(?:\{\{)/,/^(?:\}\})/,/^(?:\.)/,/^(?:,)/,/^(?:\|)/,/^(?:\()/,/^(?:\))/,/^(?:'[^\']*')/,/^(?:\d+)/,/^(?:$)/],
conditions: {"epoxy":{"rules":[2,3,4,5,6,7,8,9,10,11,12,13,14],"inclusive":false},"INITIAL":{"rules":[0,1,14],"inclusive":true}}
});
return lexer;
})();
parser.lexer = lexer;
function Parser () {
  this.yy = {};
}
Parser.prototype = parser;parser.Parser = Parser;
return new Parser;
})();


if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
exports.parser = parser;
exports.Parser = parser.Parser;
exports.parse = function () { return parser.parse.apply(parser, arguments); };
exports.main = function commonjsMain(args) {
    if (!args[1]) {
        console.log('Usage: '+args[0]+' FILE');
        process.exit(1);
    }
    var source = require('fs').readFileSync(require('path').normalize(args[1]), "utf8");
    return exports.parser.parse(source);
};
if (typeof module !== 'undefined' && require.main === module) {
  exports.main(process.argv.slice(1));
}
}
}).call(this,require('_process'))
},{"_process":24,"fs":21,"path":23}],16:[function(require,module,exports){
'use strict'

function isTemplate(el) {
  // return el instanceof HTMLTemplateElement
  return el.localName === 'template' // IE fix
}

function cloneChildren(parent, target, fn) {
  for (var child = parent.firstChild; child; child = child.nextSibling) {
    target.appendChild(fn(child, true))
  }
}

function cloneNode(node, deep) {
  var clone = node.cloneNode(false)
  if (!deep) {
    return clone
  }

  cloneChildren(node, clone, cloneNode)

  if (isTemplate(node)) {
    if (!clone.content) { // IE fix
      clone.content = document.createDocumentFragment()
    }
    cloneChildren(node.content, clone.content, cloneNode)
  }

  return clone
}

function importNode(node, deep) {
  var clone = document.importNode(node, false)
  if (!deep) {
    return clone
  }

  cloneChildren(node, clone, importNode)

  if (isTemplate(node)) {
    if (!clone.content) { // IE fix
      clone.content = document.createDocumentFragment()
    }
    cloneChildren(node.content, clone.content, cloneNode)
  }

  return clone
}

exports.isTemplate  = isTemplate
exports.cloneNode   = cloneNode
exports.importNode  = importNode

},{}],17:[function(require,module,exports){
'use strict'

var filter = require('../filter').filter

var BaseWidget = module.exports = function(id, locals, template) {
  this.key       = id
  this.locals    = locals
  this.template  = template

  this.contents  = template && template.compile(locals, { filter: filter }) || []
  if (!Array.isArray(this.contents)) {
    this.contents = [this.contents]
  }
}

Object.defineProperties(BaseWidget.prototype, {
  value: {
    get: function() {
      if (this.template.isSingleExpression) {
        return this.contents[0].get()
      } else {
        return this.contents.map(function(val) {
          val = val.valueOf()
          if (val === undefined || val === null) {
            return ''
          }
          val = String(val)
          if (val === '[object Object]') {
            return ''
          }
          return val
        }).join('')
      }
    },
    set: function(val) {
      this.set(val)
    },
    enumerable: true
  }
})

BaseWidget.prototype.type = 'Widget'

BaseWidget.prototype.set = function(val) {
  if (this.template.isSingleExpression) {
    return this.contents[0].set(val)
  }

  return val
}

BaseWidget.prototype.init    = function() {}
BaseWidget.prototype.destroy = function() {}

BaseWidget.prototype.update  = function(prev, el) {
  if (this.locals !== prev.locals) {
    return this._update(el)
  }

  return null
}

BaseWidget.prototype._update = function() {
  return this.init()
}

},{"../filter":2}],18:[function(require,module,exports){
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
  if (startNode.nodeType === Node.COMMENT_NODE && startNode.textContent.substr(1) === this.key.toString()) {
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


},{"./base":17}],19:[function(require,module,exports){
'use strict'

var applyProperties = require('virtual-dom/vdom/apply-properties')
var cloneNode = require('../utils').cloneNode

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

TemplateWidget.prototype.update = function(prev, el) {
  if (el && el instanceof HTMLElement) {
    applyProperties(el, this.properties(this.locals))
  }

  return el
}

},{"../utils":16,"virtual-dom/vdom/apply-properties":30}],20:[function(require,module,exports){
'use strict'

var BaseWidget = require('./base')

var TextWidget = module.exports = function() {
  BaseWidget.apply(this, arguments)

  this.oldValue = undefined
}

TextWidget.prototype = Object.create(BaseWidget.prototype, {
  constructor: { value: TextWidget }
})

TextWidget.prototype.init = function() {
  return document.createTextNode(this.oldValue = this.value)
}

TextWidget.prototype.update  = function(prev, el) {
  if (this.value !== this.oldValue) {
    return this._update(el)
  }

  return null
}

TextWidget.prototype._update = function(el) {
  el.nodeValue = this.oldValue = this.value
}

},{"./base":17}],21:[function(require,module,exports){

},{}],22:[function(require,module,exports){
arguments[4][21][0].apply(exports,arguments)
},{"dup":21}],23:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":24}],24:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],25:[function(require,module,exports){
var diff = require("./vtree/diff.js")

module.exports = diff

},{"./vtree/diff.js":47}],26:[function(require,module,exports){
(function (global){
var topLevel = typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window : {}
var minDoc = require('min-document');

if (typeof document !== 'undefined') {
    module.exports = document;
} else {
    var doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'];

    if (!doccy) {
        doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'] = minDoc;
    }

    module.exports = doccy;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"min-document":22}],27:[function(require,module,exports){
"use strict";

module.exports = function isObject(x) {
	return typeof x === "object" && x !== null;
};

},{}],28:[function(require,module,exports){
var nativeIsArray = Array.isArray
var toString = Object.prototype.toString

module.exports = nativeIsArray || isArray

function isArray(obj) {
    return toString.call(obj) === "[object Array]"
}

},{}],29:[function(require,module,exports){
var patch = require("./vdom/patch.js")

module.exports = patch

},{"./vdom/patch.js":34}],30:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook.js")

module.exports = applyProperties

function applyProperties(node, props, previous) {
    for (var propName in props) {
        var propValue = props[propName]

        if (propValue === undefined) {
            removeProperty(node, propName, propValue, previous);
        } else if (isHook(propValue)) {
            removeProperty(node, propName, propValue, previous)
            if (propValue.hook) {
                propValue.hook(node,
                    propName,
                    previous ? previous[propName] : undefined)
            }
        } else {
            if (isObject(propValue)) {
                patchObject(node, props, previous, propName, propValue);
            } else {
                node[propName] = propValue
            }
        }
    }
}

function removeProperty(node, propName, propValue, previous) {
    if (previous) {
        var previousValue = previous[propName]

        if (!isHook(previousValue)) {
            if (propName === "attributes") {
                for (var attrName in previousValue) {
                    node.removeAttribute(attrName)
                }
            } else if (propName === "style") {
                for (var i in previousValue) {
                    node.style[i] = ""
                }
            } else if (typeof previousValue === "string") {
                node[propName] = ""
            } else {
                node[propName] = null
            }
        } else if (previousValue.unhook) {
            previousValue.unhook(node, propName, propValue)
        }
    }
}

function patchObject(node, props, previous, propName, propValue) {
    var previousValue = previous ? previous[propName] : undefined

    // Set attributes
    if (propName === "attributes") {
        for (var attrName in propValue) {
            var attrValue = propValue[attrName]

            if (attrValue === undefined) {
                node.removeAttribute(attrName)
            } else {
                node.setAttribute(attrName, attrValue)
            }
        }

        return
    }

    if(previousValue && isObject(previousValue) &&
        getPrototype(previousValue) !== getPrototype(propValue)) {
        node[propName] = propValue
        return
    }

    if (!isObject(node[propName])) {
        node[propName] = {}
    }

    var replacer = propName === "style" ? "" : undefined

    for (var k in propValue) {
        var value = propValue[k]
        node[propName][k] = (value === undefined) ? replacer : value
    }
}

function getPrototype(value) {
    if (Object.getPrototypeOf) {
        return Object.getPrototypeOf(value)
    } else if (value.__proto__) {
        return value.__proto__
    } else if (value.constructor) {
        return value.constructor.prototype
    }
}

},{"../vnode/is-vhook.js":38,"is-object":27}],31:[function(require,module,exports){
var document = require("global/document")

var applyProperties = require("./apply-properties")

var isVNode = require("../vnode/is-vnode.js")
var isVText = require("../vnode/is-vtext.js")
var isWidget = require("../vnode/is-widget.js")
var handleThunk = require("../vnode/handle-thunk.js")

module.exports = createElement

function createElement(vnode, opts) {
    var doc = opts ? opts.document || document : document
    var warn = opts ? opts.warn : null

    vnode = handleThunk(vnode).a

    if (isWidget(vnode)) {
        return vnode.init()
    } else if (isVText(vnode)) {
        return doc.createTextNode(vnode.text)
    } else if (!isVNode(vnode)) {
        if (warn) {
            warn("Item is not a valid virtual dom node", vnode)
        }
        return null
    }

    var props = vnode.properties
    var typeExtension = props.attributes && props.attributes.is
    var node

    if (typeExtension) {
        node = (vnode.namespace === null) ?
                doc.createElement(vnode.tagName, typeExtension) :
                doc.createElementNS(vnode.namespace, vnode.tagName, typeExtension)
    } else {
        node = (vnode.namespace === null) ?
                doc.createElement(vnode.tagName) :
                doc.createElementNS(vnode.namespace, vnode.tagName)
    }

    applyProperties(node, props)

    var children = vnode.children

    for (var i = 0; i < children.length; i++) {
        var childNode = createElement(children[i], opts)
        if (childNode) {
            node.appendChild(childNode)
        }
    }

    return node
}

},{"../vnode/handle-thunk.js":36,"../vnode/is-vnode.js":39,"../vnode/is-vtext.js":40,"../vnode/is-widget.js":41,"./apply-properties":30,"global/document":26}],32:[function(require,module,exports){
// Maps a virtual DOM tree onto a real DOM tree in an efficient manner.
// We don't want to read all of the DOM nodes in the tree so we use
// the in-order tree indexing to eliminate recursion down certain branches.
// We only recurse into a DOM node if we know that it contains a child of
// interest.

var noChild = {}

module.exports = domIndex

function domIndex(rootNode, tree, indices, nodes) {
    if (!indices || indices.length === 0) {
        return {}
    } else {
        indices.sort(ascending)
        return recurse(rootNode, tree, indices, nodes, 0)
    }
}

function recurse(rootNode, tree, indices, nodes, rootIndex) {
    nodes = nodes || {}


    if (rootNode) {
        if (indexInRange(indices, rootIndex, rootIndex)) {
            nodes[rootIndex] = rootNode
        }

        var vChildren = tree.children

        if (vChildren) {

            var childNodes = rootNode.childNodes

            for (var i = 0; i < tree.children.length; i++) {
                rootIndex += 1

                var vChild = vChildren[i] || noChild
                var nextIndex = rootIndex + (vChild.count || 0)

                // skip recursion down the tree if there are no nodes down here
                if (indexInRange(indices, rootIndex, nextIndex)) {
                    recurse(childNodes[i], vChild, indices, nodes, rootIndex)
                }

                rootIndex = nextIndex
            }
        }
    }

    return nodes
}

// Binary search for an index in the interval [left, right]
function indexInRange(indices, left, right) {
    if (indices.length === 0) {
        return false
    }

    var minIndex = 0
    var maxIndex = indices.length - 1
    var currentIndex
    var currentItem

    while (minIndex <= maxIndex) {
        currentIndex = ((maxIndex + minIndex) / 2) >> 0
        currentItem = indices[currentIndex]

        if (minIndex === maxIndex) {
            return currentItem >= left && currentItem <= right
        } else if (currentItem < left) {
            minIndex = currentIndex + 1
        } else  if (currentItem > right) {
            maxIndex = currentIndex - 1
        } else {
            return true
        }
    }

    return false;
}

function ascending(a, b) {
    return a > b ? 1 : -1
}

},{}],33:[function(require,module,exports){
var applyProperties = require("./apply-properties")

var isWidget = require("../vnode/is-widget.js")
var VPatch = require("../vnode/vpatch.js")

var updateWidget = require("./update-widget")

module.exports = applyPatch

function applyPatch(vpatch, domNode, renderOptions) {
    var type = vpatch.type
    var vNode = vpatch.vNode
    var patch = vpatch.patch

    switch (type) {
        case VPatch.REMOVE:
            return removeNode(domNode, vNode)
        case VPatch.INSERT:
            return insertNode(domNode, patch, renderOptions)
        case VPatch.VTEXT:
            return stringPatch(domNode, vNode, patch, renderOptions)
        case VPatch.WIDGET:
            return widgetPatch(domNode, vNode, patch, renderOptions)
        case VPatch.VNODE:
            return vNodePatch(domNode, vNode, patch, renderOptions)
        case VPatch.ORDER:
            reorderChildren(domNode, patch)
            return domNode
        case VPatch.PROPS:
            applyProperties(domNode, patch, vNode.properties)
            return domNode
        case VPatch.THUNK:
            return replaceRoot(domNode,
                renderOptions.patch(domNode, patch, renderOptions))
        default:
            return domNode
    }
}

function removeNode(domNode, vNode) {
    var parentNode = domNode.parentNode

    if (parentNode) {
        parentNode.removeChild(domNode)
    }

    destroyWidget(domNode, vNode);

    return null
}

function insertNode(parentNode, vNode, renderOptions) {
    var newNode = renderOptions.render(vNode, renderOptions)

    if (parentNode) {
        parentNode.appendChild(newNode)
    }

    return parentNode
}

function stringPatch(domNode, leftVNode, vText, renderOptions) {
    var newNode

    if (domNode.nodeType === 3) {
        domNode.replaceData(0, domNode.length, vText.text)
        newNode = domNode
    } else {
        var parentNode = domNode.parentNode
        newNode = renderOptions.render(vText, renderOptions)

        if (parentNode && newNode !== domNode) {
            parentNode.replaceChild(newNode, domNode)
        }
    }

    return newNode
}

function widgetPatch(domNode, leftVNode, widget, renderOptions) {
    var updating = updateWidget(leftVNode, widget)
    var newNode

    if (updating) {
        newNode = widget.update(leftVNode, domNode) || domNode
    } else {
        newNode = renderOptions.render(widget, renderOptions)
    }

    var parentNode = domNode.parentNode

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    if (!updating) {
        destroyWidget(domNode, leftVNode)
    }

    return newNode
}

function vNodePatch(domNode, leftVNode, vNode, renderOptions) {
    var parentNode = domNode.parentNode
    var newNode = renderOptions.render(vNode, renderOptions)

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    return newNode
}

function destroyWidget(domNode, w) {
    if (typeof w.destroy === "function" && isWidget(w)) {
        w.destroy(domNode)
    }
}

function reorderChildren(domNode, moves) {
    var childNodes = domNode.childNodes
    var keyMap = {}
    var node
    var remove
    var insert

    for (var i = 0; i < moves.removes.length; i++) {
        remove = moves.removes[i]
        node = childNodes[remove.from]
        if (remove.key) {
            keyMap[remove.key] = node
        }
        domNode.removeChild(node)
    }

    var length = childNodes.length
    for (var j = 0; j < moves.inserts.length; j++) {
        insert = moves.inserts[j]
        node = keyMap[insert.key]
        // this is the weirdest bug i've ever seen in webkit
        domNode.insertBefore(node, insert.to >= length++ ? null : childNodes[insert.to])
    }
}

function replaceRoot(oldRoot, newRoot) {
    if (oldRoot && newRoot && oldRoot !== newRoot && oldRoot.parentNode) {
        oldRoot.parentNode.replaceChild(newRoot, oldRoot)
    }

    return newRoot;
}

},{"../vnode/is-widget.js":41,"../vnode/vpatch.js":44,"./apply-properties":30,"./update-widget":35}],34:[function(require,module,exports){
var document = require("global/document")
var isArray = require("x-is-array")

var render = require("./create-element")
var domIndex = require("./dom-index")
var patchOp = require("./patch-op")
module.exports = patch

function patch(rootNode, patches, renderOptions) {
    renderOptions = renderOptions || {}
    renderOptions.patch = renderOptions.patch || patchRecursive
    renderOptions.render = renderOptions.render || render

    return renderOptions.patch(rootNode, patches, renderOptions)
}

function patchRecursive(rootNode, patches, renderOptions) {
    var indices = patchIndices(patches)

    if (indices.length === 0) {
        return rootNode
    }

    var index = domIndex(rootNode, patches.a, indices)
    var ownerDocument = rootNode.ownerDocument

    if (!renderOptions.document && ownerDocument !== document) {
        renderOptions.document = ownerDocument
    }

    for (var i = 0; i < indices.length; i++) {
        var nodeIndex = indices[i]
        rootNode = applyPatch(rootNode,
            index[nodeIndex],
            patches[nodeIndex],
            renderOptions)
    }

    return rootNode
}

function applyPatch(rootNode, domNode, patchList, renderOptions) {
    if (!domNode) {
        return rootNode
    }

    var newNode

    if (isArray(patchList)) {
        for (var i = 0; i < patchList.length; i++) {
            newNode = patchOp(patchList[i], domNode, renderOptions)

            if (domNode === rootNode) {
                rootNode = newNode
            }
        }
    } else {
        newNode = patchOp(patchList, domNode, renderOptions)

        if (domNode === rootNode) {
            rootNode = newNode
        }
    }

    return rootNode
}

function patchIndices(patches) {
    var indices = []

    for (var key in patches) {
        if (key !== "a") {
            indices.push(Number(key))
        }
    }

    return indices
}

},{"./create-element":31,"./dom-index":32,"./patch-op":33,"global/document":26,"x-is-array":28}],35:[function(require,module,exports){
var isWidget = require("../vnode/is-widget.js")

module.exports = updateWidget

function updateWidget(a, b) {
    if (isWidget(a) && isWidget(b)) {
        if ("name" in a && "name" in b) {
            return a.id === b.id
        } else {
            return a.init === b.init
        }
    }

    return false
}

},{"../vnode/is-widget.js":41}],36:[function(require,module,exports){
var isVNode = require("./is-vnode")
var isVText = require("./is-vtext")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")

module.exports = handleThunk

function handleThunk(a, b) {
    var renderedA = a
    var renderedB = b

    if (isThunk(b)) {
        renderedB = renderThunk(b, a)
    }

    if (isThunk(a)) {
        renderedA = renderThunk(a, null)
    }

    return {
        a: renderedA,
        b: renderedB
    }
}

function renderThunk(thunk, previous) {
    var renderedThunk = thunk.vnode

    if (!renderedThunk) {
        renderedThunk = thunk.vnode = thunk.render(previous)
    }

    if (!(isVNode(renderedThunk) ||
            isVText(renderedThunk) ||
            isWidget(renderedThunk))) {
        throw new Error("thunk did not return a valid node");
    }

    return renderedThunk
}

},{"./is-thunk":37,"./is-vnode":39,"./is-vtext":40,"./is-widget":41}],37:[function(require,module,exports){
module.exports = isThunk

function isThunk(t) {
    return t && t.type === "Thunk"
}

},{}],38:[function(require,module,exports){
module.exports = isHook

function isHook(hook) {
    return hook &&
      (typeof hook.hook === "function" && !hook.hasOwnProperty("hook") ||
       typeof hook.unhook === "function" && !hook.hasOwnProperty("unhook"))
}

},{}],39:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualNode

function isVirtualNode(x) {
    return x && x.type === "VirtualNode" && x.version === version
}

},{"./version":42}],40:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualText

function isVirtualText(x) {
    return x && x.type === "VirtualText" && x.version === version
}

},{"./version":42}],41:[function(require,module,exports){
module.exports = isWidget

function isWidget(w) {
    return w && w.type === "Widget"
}

},{}],42:[function(require,module,exports){
module.exports = "2"

},{}],43:[function(require,module,exports){
var version = require("./version")
var isVNode = require("./is-vnode")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")
var isVHook = require("./is-vhook")

module.exports = VirtualNode

var noProperties = {}
var noChildren = []

function VirtualNode(tagName, properties, children, key, namespace) {
    this.tagName = tagName
    this.properties = properties || noProperties
    this.children = children || noChildren
    this.key = key != null ? String(key) : undefined
    this.namespace = (typeof namespace === "string") ? namespace : null

    var count = (children && children.length) || 0
    var descendants = 0
    var hasWidgets = false
    var hasThunks = false
    var descendantHooks = false
    var hooks

    for (var propName in properties) {
        if (properties.hasOwnProperty(propName)) {
            var property = properties[propName]
            if (isVHook(property) && property.unhook) {
                if (!hooks) {
                    hooks = {}
                }

                hooks[propName] = property
            }
        }
    }

    for (var i = 0; i < count; i++) {
        var child = children[i]
        if (isVNode(child)) {
            descendants += child.count || 0

            if (!hasWidgets && child.hasWidgets) {
                hasWidgets = true
            }

            if (!hasThunks && child.hasThunks) {
                hasThunks = true
            }

            if (!descendantHooks && (child.hooks || child.descendantHooks)) {
                descendantHooks = true
            }
        } else if (!hasWidgets && isWidget(child)) {
            if (typeof child.destroy === "function") {
                hasWidgets = true
            }
        } else if (!hasThunks && isThunk(child)) {
            hasThunks = true;
        }
    }

    this.count = count + descendants
    this.hasWidgets = hasWidgets
    this.hasThunks = hasThunks
    this.hooks = hooks
    this.descendantHooks = descendantHooks
}

VirtualNode.prototype.version = version
VirtualNode.prototype.type = "VirtualNode"

},{"./is-thunk":37,"./is-vhook":38,"./is-vnode":39,"./is-widget":41,"./version":42}],44:[function(require,module,exports){
var version = require("./version")

VirtualPatch.NONE = 0
VirtualPatch.VTEXT = 1
VirtualPatch.VNODE = 2
VirtualPatch.WIDGET = 3
VirtualPatch.PROPS = 4
VirtualPatch.ORDER = 5
VirtualPatch.INSERT = 6
VirtualPatch.REMOVE = 7
VirtualPatch.THUNK = 8

module.exports = VirtualPatch

function VirtualPatch(type, vNode, patch) {
    this.type = Number(type)
    this.vNode = vNode
    this.patch = patch
}

VirtualPatch.prototype.version = version
VirtualPatch.prototype.type = "VirtualPatch"

},{"./version":42}],45:[function(require,module,exports){
var version = require("./version")

module.exports = VirtualText

function VirtualText(text) {
    this.text = String(text)
}

VirtualText.prototype.version = version
VirtualText.prototype.type = "VirtualText"

},{"./version":42}],46:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook")

module.exports = diffProps

function diffProps(a, b) {
    var diff

    for (var aKey in a) {
        if (!(aKey in b)) {
            diff = diff || {}
            diff[aKey] = undefined
        }

        var aValue = a[aKey]
        var bValue = b[aKey]

        if (aValue === bValue) {
            continue
        } else if (isObject(aValue) && isObject(bValue)) {
            if (getPrototype(bValue) !== getPrototype(aValue)) {
                diff = diff || {}
                diff[aKey] = bValue
            } else if (isHook(bValue)) {
                 diff = diff || {}
                 diff[aKey] = bValue
            } else {
                var objectDiff = diffProps(aValue, bValue)
                if (objectDiff) {
                    diff = diff || {}
                    diff[aKey] = objectDiff
                }
            }
        } else {
            diff = diff || {}
            diff[aKey] = bValue
        }
    }

    for (var bKey in b) {
        if (!(bKey in a)) {
            diff = diff || {}
            diff[bKey] = b[bKey]
        }
    }

    return diff
}

function getPrototype(value) {
  if (Object.getPrototypeOf) {
    return Object.getPrototypeOf(value)
  } else if (value.__proto__) {
    return value.__proto__
  } else if (value.constructor) {
    return value.constructor.prototype
  }
}

},{"../vnode/is-vhook":38,"is-object":27}],47:[function(require,module,exports){
var isArray = require("x-is-array")

var VPatch = require("../vnode/vpatch")
var isVNode = require("../vnode/is-vnode")
var isVText = require("../vnode/is-vtext")
var isWidget = require("../vnode/is-widget")
var isThunk = require("../vnode/is-thunk")
var handleThunk = require("../vnode/handle-thunk")

var diffProps = require("./diff-props")

module.exports = diff

function diff(a, b) {
    var patch = { a: a }
    walk(a, b, patch, 0)
    return patch
}

function walk(a, b, patch, index) {
    if (a === b) {
        return
    }

    var apply = patch[index]
    var applyClear = false

    if (isThunk(a) || isThunk(b)) {
        thunks(a, b, patch, index)
    } else if (b == null) {

        // If a is a widget we will add a remove patch for it
        // Otherwise any child widgets/hooks must be destroyed.
        // This prevents adding two remove patches for a widget.
        if (!isWidget(a)) {
            clearState(a, patch, index)
            apply = patch[index]
        }

        apply = appendPatch(apply, new VPatch(VPatch.REMOVE, a, b))
    } else if (isVNode(b)) {
        if (isVNode(a)) {
            if (a.tagName === b.tagName &&
                a.namespace === b.namespace &&
                a.key === b.key) {
                var propsPatch = diffProps(a.properties, b.properties)
                if (propsPatch) {
                    apply = appendPatch(apply,
                        new VPatch(VPatch.PROPS, a, propsPatch))
                }
                apply = diffChildren(a, b, patch, apply, index)
            } else {
                apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
                applyClear = true
            }
        } else {
            apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
            applyClear = true
        }
    } else if (isVText(b)) {
        if (!isVText(a)) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
            applyClear = true
        } else if (a.text !== b.text) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
        }
    } else if (isWidget(b)) {
        if (!isWidget(a)) {
            applyClear = true
        }

        apply = appendPatch(apply, new VPatch(VPatch.WIDGET, a, b))
    }

    if (apply) {
        patch[index] = apply
    }

    if (applyClear) {
        clearState(a, patch, index)
    }
}

function diffChildren(a, b, patch, apply, index) {
    var aChildren = a.children
    var orderedSet = reorder(aChildren, b.children)
    var bChildren = orderedSet.children

    var aLen = aChildren.length
    var bLen = bChildren.length
    var len = aLen > bLen ? aLen : bLen

    for (var i = 0; i < len; i++) {
        var leftNode = aChildren[i]
        var rightNode = bChildren[i]
        index += 1

        if (!leftNode) {
            if (rightNode) {
                // Excess nodes in b need to be added
                apply = appendPatch(apply,
                    new VPatch(VPatch.INSERT, null, rightNode))
            }
        } else {
            walk(leftNode, rightNode, patch, index)
        }

        if (isVNode(leftNode) && leftNode.count) {
            index += leftNode.count
        }
    }

    if (orderedSet.moves) {
        // Reorder nodes last
        apply = appendPatch(apply, new VPatch(
            VPatch.ORDER,
            a,
            orderedSet.moves
        ))
    }

    return apply
}

function clearState(vNode, patch, index) {
    // TODO: Make this a single walk, not two
    unhook(vNode, patch, index)
    destroyWidgets(vNode, patch, index)
}

// Patch records for all destroyed widgets must be added because we need
// a DOM node reference for the destroy function
function destroyWidgets(vNode, patch, index) {
    if (isWidget(vNode)) {
        if (typeof vNode.destroy === "function") {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(VPatch.REMOVE, vNode, null)
            )
        }
    } else if (isVNode(vNode) && (vNode.hasWidgets || vNode.hasThunks)) {
        var children = vNode.children
        var len = children.length
        for (var i = 0; i < len; i++) {
            var child = children[i]
            index += 1

            destroyWidgets(child, patch, index)

            if (isVNode(child) && child.count) {
                index += child.count
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

// Create a sub-patch for thunks
function thunks(a, b, patch, index) {
    var nodes = handleThunk(a, b)
    var thunkPatch = diff(nodes.a, nodes.b)
    if (hasPatches(thunkPatch)) {
        patch[index] = new VPatch(VPatch.THUNK, null, thunkPatch)
    }
}

function hasPatches(patch) {
    for (var index in patch) {
        if (index !== "a") {
            return true
        }
    }

    return false
}

// Execute hooks when two nodes are identical
function unhook(vNode, patch, index) {
    if (isVNode(vNode)) {
        if (vNode.hooks) {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(
                    VPatch.PROPS,
                    vNode,
                    undefinedKeys(vNode.hooks)
                )
            )
        }

        if (vNode.descendantHooks || vNode.hasThunks) {
            var children = vNode.children
            var len = children.length
            for (var i = 0; i < len; i++) {
                var child = children[i]
                index += 1

                unhook(child, patch, index)

                if (isVNode(child) && child.count) {
                    index += child.count
                }
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

function undefinedKeys(obj) {
    var result = {}

    for (var key in obj) {
        result[key] = undefined
    }

    return result
}

// List diff, naive left to right reordering
function reorder(aChildren, bChildren) {
    // O(M) time, O(M) memory
    var bChildIndex = keyIndex(bChildren)
    var bKeys = bChildIndex.keys
    var bFree = bChildIndex.free

    if (bFree.length === bChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(N) time, O(N) memory
    var aChildIndex = keyIndex(aChildren)
    var aKeys = aChildIndex.keys
    var aFree = aChildIndex.free

    if (aFree.length === aChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(MAX(N, M)) memory
    var newChildren = []

    var freeIndex = 0
    var freeCount = bFree.length
    var deletedItems = 0

    // Iterate through a and match a node in b
    // O(N) time,
    for (var i = 0 ; i < aChildren.length; i++) {
        var aItem = aChildren[i]
        var itemIndex

        if (aItem.key) {
            if (bKeys.hasOwnProperty(aItem.key)) {
                // Match up the old keys
                itemIndex = bKeys[aItem.key]
                newChildren.push(bChildren[itemIndex])

            } else {
                // Remove old keyed items
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        } else {
            // Match the item in a with the next free item in b
            if (freeIndex < freeCount) {
                itemIndex = bFree[freeIndex++]
                newChildren.push(bChildren[itemIndex])
            } else {
                // There are no free items in b to match with
                // the free items in a, so the extra free nodes
                // are deleted.
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        }
    }

    var lastFreeIndex = freeIndex >= bFree.length ?
        bChildren.length :
        bFree[freeIndex]

    // Iterate through b and append any new keys
    // O(M) time
    for (var j = 0; j < bChildren.length; j++) {
        var newItem = bChildren[j]

        if (newItem.key) {
            if (!aKeys.hasOwnProperty(newItem.key)) {
                // Add any new keyed items
                // We are adding new items to the end and then sorting them
                // in place. In future we should insert new items in place.
                newChildren.push(newItem)
            }
        } else if (j >= lastFreeIndex) {
            // Add any leftover non-keyed items
            newChildren.push(newItem)
        }
    }

    var simulate = newChildren.slice()
    var simulateIndex = 0
    var removes = []
    var inserts = []
    var simulateItem

    for (var k = 0; k < bChildren.length;) {
        var wantedItem = bChildren[k]
        simulateItem = simulate[simulateIndex]

        // remove items
        while (simulateItem === null && simulate.length) {
            removes.push(remove(simulate, simulateIndex, null))
            simulateItem = simulate[simulateIndex]
        }

        if (!simulateItem || simulateItem.key !== wantedItem.key) {
            // if we need a key in this position...
            if (wantedItem.key) {
                if (simulateItem && simulateItem.key) {
                    // if an insert doesn't put this key in place, it needs to move
                    if (bKeys[simulateItem.key] !== k + 1) {
                        removes.push(remove(simulate, simulateIndex, simulateItem.key))
                        simulateItem = simulate[simulateIndex]
                        // if the remove didn't put the wanted item in place, we need to insert it
                        if (!simulateItem || simulateItem.key !== wantedItem.key) {
                            inserts.push({key: wantedItem.key, to: k})
                        }
                        // items are matching, so skip ahead
                        else {
                            simulateIndex++
                        }
                    }
                    else {
                        inserts.push({key: wantedItem.key, to: k})
                    }
                }
                else {
                    inserts.push({key: wantedItem.key, to: k})
                }
                k++
            }
            // a key in simulate has no matching wanted key, remove it
            else if (simulateItem && simulateItem.key) {
                removes.push(remove(simulate, simulateIndex, simulateItem.key))
            }
        }
        else {
            simulateIndex++
            k++
        }
    }

    // remove all the remaining nodes from simulate
    while(simulateIndex < simulate.length) {
        simulateItem = simulate[simulateIndex]
        removes.push(remove(simulate, simulateIndex, simulateItem && simulateItem.key))
    }

    // If the only moves we have are deletes then we can just
    // let the delete patch remove these items.
    if (removes.length === deletedItems && !inserts.length) {
        return {
            children: newChildren,
            moves: null
        }
    }

    return {
        children: newChildren,
        moves: {
            removes: removes,
            inserts: inserts
        }
    }
}

function remove(arr, index, key) {
    arr.splice(index, 1)

    return {
        from: index,
        key: key
    }
}

function keyIndex(children) {
    var keys = {}
    var free = []
    var length = children.length

    for (var i = 0; i < length; i++) {
        var child = children[i]

        if (child.key) {
            keys[child.key] = i
        } else {
            free.push(i)
        }
    }

    return {
        keys: keys,     // A hash of key name to index
        free: free      // An array of unkeyed item indices
    }
}

function appendPatch(apply, patch) {
    if (apply) {
        if (isArray(apply)) {
            apply.push(patch)
        } else {
            apply = [apply, patch]
        }

        return apply
    } else {
        return patch
    }
}

},{"../vnode/handle-thunk":36,"../vnode/is-thunk":37,"../vnode/is-vnode":39,"../vnode/is-vtext":40,"../vnode/is-widget":41,"../vnode/vpatch":44,"./diff-props":46,"x-is-array":28}]},{},[7])(7)
});