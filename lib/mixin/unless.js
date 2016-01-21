'use strict'

const IfMixin = require('./if')

module.exports = class UnlessMixin extends IfMixin {
  constructor(template, content) {
    super(template, content)
  }

  get condition() {
    const result = this.value
    return !(result && result !== 'false')
  }

  static get property() {
    return 'unless'
  }

  static isUnlessMixin(node) {
    return node.tagName === 'TEMPLATE' && node.hasAttribute(this.property)
  }
}

