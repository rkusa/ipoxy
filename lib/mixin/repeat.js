'use strict'

const BaseMixin = require('./base')
const Model = require('../model')

module.exports = class RepeatMixin extends BaseMixin {
  constructor(template, content) {
    super(template)

    this.content = content
  }

  execute() {
    const value = this.value
    if (!value) {
      return []
    }

    const children = []

    value.forEach((row, i) => {
      const model = {
        get: () => {
          return this.value && (Array.isArray(this.value) ? this.value[i] : this.value.get(i))
        },
        // TODO: used?
        set: val => {
          console.log('SET')
          if (Array.isArray(this.value)) {
            this.value[i] = val
          } else {
            this.value.set(i, val)
          }
        }
      }

      const locals = this.locals.slice()
      const alias = this.contents[0].alias

      if (alias) {
        if (Array.isArray(alias)) {
          const local = {}
          local[alias[0]] = i
          locals.unshift(local)
          alias = alias[1]
        }

        locals.unshift(Model.alias(alias, model))
      } else {
        locals.unshift(new Model(model))
      }

      const item = model.get()
      const id = item.id

      children.push.apply(children, this.content(locals, id))
    }, this)

    return children
  }

  static get property() {
    return 'repeat'
  }

  static isRepeatMixin(node) {
    return node.tagName === 'TEMPLATE' && node.hasAttribute(this.property)
  }
}

