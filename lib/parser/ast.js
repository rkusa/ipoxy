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
    enumerable: true,
    get: function() {
      return this.body.length === 1 && this.body[0] instanceof Expression
    }
  },
  hasExpressions: {
    enumerable: true,
    get: function() {
      return this.body.length > 1 || (this.body.length && !(this.body[0] instanceof Text))
    }
  },
  isEmpty: {
    enumerable: true,
    get: function() {
      return this.body.length === 0
    }
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

var Cursor = require('immutable/contrib/cursor')
var Model  = require('../model')

var Path = exports.Path = function(path) {
  this.keys = path
}

Path.prototype.compile = function(locals) {
  if (!this.keys.length) {
    return new Reference(locals[0])
  }

  var path = this.keys.slice()

  var obj  = null
  for (var i = 0, len = locals.size; i < len; ++i) {
    var local = locals.get(i)
    if (Model.isModel(local)) {
      local = local.get()
    }
    if (local.has && local.has(path[0]) || path[0] in local) {
      obj = local
      break
    }
  }

  if (obj === undefined) {
    return new Reference()
  }

  var key = path.pop()
  var prop

  while ((prop = path.shift())) {
    if (Model.isModel(obj)) {
      obj = obj.get()
    }

    if (obj && typeof obj.get === 'function') {
      obj = obj.get(prop)
    } else if (!obj || !(prop in obj)) {
      throw new Error('Path ' + this.keys.join('.') + ' not set')
    } else {
      obj = obj[prop]
    }
  }

  if (Model.isModel(obj)) {
    obj = obj.get()
  }

  return new Reference(obj, key, locals[i])
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
  if (!this.obj) return undefined

  for (var i = this.filters.length - 1; i >= 0; --i) {
    var filter = this.filters[i]
    if (!('set' in filter.fn)) continue

    var fn     = filter.fn.set
    var args   = filter.args && filter.args.map(function(arg) {
      return arg instanceof Reference ? arg.get() : args
    }) || []

    val = fn.apply(this, [val].concat(args))
  }

  this.obj = this.key ? this.obj.set(this.key, val) : val
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
