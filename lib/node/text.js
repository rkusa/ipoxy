'use strict'

const BaseNode = require('./base')
const idom = require('incremental-dom')

module.exports = class TextNode extends BaseNode {
  constructor(template) {
    super(template)
  }

  render() {
    idom.text(this.value)
  }
}

