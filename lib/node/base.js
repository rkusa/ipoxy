'use strict'

const filter = require('../filter').filter

module.exports = class BaseNode {
  constructor(template) {
    this.template = template
  }

  get value() {
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
  }

  // TODO: used?
  set value(val) {
    this.set(val)
  }

  set(val) {
    if (this.template.isSingleExpression) {
      return this.contents[0].set(val)
    }

    return val
  }

  render() {
    // abstract
  }

  update(locals) {
    if (!this.template) {
      return
    }

    this.contents = this.template.compile(locals, { filter: filter }) || []
    this.locals   = locals
    if (!Array.isArray(this.contents)) {
      this.contents = [this.contents]
    }
  }
}

