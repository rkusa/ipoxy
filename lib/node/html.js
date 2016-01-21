'use strict'

const BaseNode = require('./base')
const idom = require('incremental-dom')

module.exports = class HTMLNode extends BaseNode {
  constructor(template) {
    super(template)

    this.before = null
    this.fragment = null
  }

  render() {
    const value = this.value
    if (value !== this.before) {
      this.before = value
      this.fragment = document.createElement('div')
      this.fragment.innerHTML = value
    }

    dom2idom(this.fragment)
  }
}

function dom2idom(node) {
  switch (node.nodeType) {
    case Node.ELEMENT_NODE:
      const tagName = node.tagName.toLowerCase()
      idom.elementOpenStart(tagName)

      for (let i = 0, len = node.attributes.length; i < len; ++i) {
        const attr = node.attributes[i]
        idom.attr(attr.name, attr.value)
      }

      idom.elementOpenEnd()

      let child = node.firstChild
      while (child) {
        dom2idom(child)
        child = child.nextSibling
      }

      idom.elementClose(tagName)
      break
    case Node.TEXT_NODE:
      idom.text(node.nodeValue)
      break
  }
}

