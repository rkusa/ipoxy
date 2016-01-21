'use strict'

const BaseNode = require('../node/base')
const BOOLEAN = ['checked', 'selected', 'disabled']

module.exports = class BooleanAttribute extends BaseNode {
  constructor(template, node, attr) {
    super(template)

    this.node = node
    this.attr = attr
  }

  statics() {
    if (this.attr.name === 'checked') {
      const self = this
      const delegate = this.contents[0]

      return ['onchange', function() {
        switch (this.type) {
          case 'checkbox':
            delegate.set(this[self.attr.name])
            break
          case 'radio':
            if (this.value === 'true' || this.value === 'false') {
              delegate.set(this.value === 'true')
            } else {
              delegate.set(this.value)
            }
            break
        }
      }]
    }
  }

  render() {
    let val
    if (this.node.type === 'radio' && this.attr.name === 'checked') {
      val = String(this.value) === this.node.value
    } else {
      val = this.value ? true : false
    }
    if (val) {
      return [this.attr.name, '']
    } else {
      return [this.attr.name, null]
    }
  }

  static isBooleanAttribute(node, attr) {
    return BOOLEAN.indexOf(attr.name) > -1
  }
}

