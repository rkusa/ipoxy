'use strict'

const BaseNode = require('../node/base')

module.exports = class InputHool extends BaseNode {
  constructor(template, node, attr) {
    super(template)

    this.node = node
    this.attr = attr
  }

  statics() {
    const self = this
    return ['onchange', function() {
      const val = self.set(this.value)
      if (val !== this.value) {
        this.value = val
      }
    }]
  }

  render() {
    return [this.attr.name, this.value || '']
  }

  static isInputValue(node, attr) {
    return (node instanceof HTMLInputElement || node instanceof HTMLSelectElement) && attr.name === 'value'
  }
}

