'use strict'

const BaseNode = require('../node/base')

module.exports = class BaseMixin extends BaseNode {
  constructor(template) {
    super(template)
  }

  execute() {
    // abstract
  }
}

