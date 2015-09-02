'use strict'

function isTemplate(el) {
  // return el instanceof HTMLTemplateElement
  return el.localName === 'template' // IE fix
}

function cloneChildren(parent, target, fn) {
  for (var child = parent.firstChild; child; child = child.nextSibling) {
    target.appendChild(fn(child, true))
  }
}

function cloneNode(node, deep) {
  var clone = node.cloneNode(false)
  if (!deep) {
    return clone
  }

  cloneChildren(node, clone, cloneNode)

  if (isTemplate(node)) {
    if (!clone.content) { // IE fix
      clone.content = document.createDocumentFragment()
    }
    cloneChildren(node.content, clone.content, cloneNode)
  }

  return clone
}

function importNode(node, deep) {
  var clone = document.importNode(node, false)
  if (!deep) {
    return clone
  }

  cloneChildren(node, clone, importNode)

  if (isTemplate(node)) {
    if (!clone.content) { // IE fix
      clone.content = document.createDocumentFragment()
    }
    cloneChildren(node.content, clone.content, cloneNode)
  }

  return clone
}

exports.isTemplate  = isTemplate
exports.cloneNode   = cloneNode
exports.importNode  = importNode
