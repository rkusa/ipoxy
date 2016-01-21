'use strict'

const BaseNode = require('../node/base')

module.exports = class Attribute extends BaseNode {
  constructor(template, node, attr) {
    super(template)

    this.node = node
    this.attr = attr
  }

  statics() {
    return []
  }

  render() {
    const value = this.value !== undefined && this.value !== null ? String(this.value) : ''
    if (value === '[object Object]') {
      if (name in this.node) {
        return [this.attr.name, '']
      } else {
        const reference = this.contents[0]
        return [this.attr.name, reference]
      }
    }

    return [this.attr.name, value || '']
  }
}

