'use strict'

const BaseMixin = require('./base')

module.exports = class IfMixin extends BaseMixin {
  constructor(template, content) {
    super(template)

    this.content = content
  }

  get condition() {
    const result = this.value
    return result && result !== 'false'
  }

  execute() {
    if (this.template.isEmpty) {
      // TODO: What is this?
      // this.content.render()
      return []
    }

    if (this.condition) {
      return this.content(this.locals)
    }

    return []
  }

  static get property() {
    return 'if'
  }

  static isIfMixin(node) {
    return node.tagName === 'TEMPLATE' && node.hasAttribute(this.property)
  }
}

