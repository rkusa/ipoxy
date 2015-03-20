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
    enumerable: true,
    get: function() {
      if (this.template.isSingleExpression) {
        return this.contents[0].get()
      } else {
        return this.contents.map(function(val) {
          val = val.valueOf()
          return val === undefined || typeof val === 'object' ? '' : val
        }).join('')
      }
    },
    set: function(val) {
      this.set(val)
    }
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

BaseWidget.prototype._update = function(el) {
  return this.init()
}
