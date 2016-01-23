'use strict'

const Model      = require('./model')
const isTemplate = require('./utils').isTemplate
const importNode = require('./utils').importNode

const parser     = require('./parser')
const ast        = require('./parser/ast')

const idom = require('incremental-dom')

const applyAttributeTyped = idom.attributes[idom.symbols.default]

idom.attributes[idom.symbols.default] = function(el, name, value) {
  if (value && typeof value === 'object' && value instanceof ast.Reference) {
    if (name in el) {
      return
    }

    const reference = value
    Object.defineProperties(el, {
      ['__' + name]: {
        get: () => reference
      },
      [name]: {
        get: () => reference.get(),
        set: val => reference.set(val),
        enumerable: true
      }
    })
  } else {
    applyAttributeTyped(el, name, value)
  }
}

idom.attributes.checked = function(el, name, value) {
  // idom.applyAttr(el, name, value)
  el[name] = value !== null
}

idom.attributes.value = function(el, name, value) {
  // <select value="{{ foobar }}"></select>
  if (el.tagName === 'SELECT') {
    // delay until select content has been created
    setTimeout(function() {
      // also update the selected html attribute, to make reset buttons work
      // as expected
      const selected = el.querySelectorAll('option[selected]')
      for (let i = 0; i < selected.length; ++i) {
        selected[i].removeAttribute('selected')
        selected[i].selected = false
      }

      if (value !== undefined && value !== null) {
        const option = el.querySelector('option[value="' + value + '"]')
        if (option) {
          option.setAttribute('selected', '')
          option.selected = true
        }
      }
    })
  } else {
    // idom.applyAttr(el, name, value)
    idom.applyProp(el, name, value)
  }
}

idom.attributes.content = function(el, name, value) {
  if (isTemplate(el)) {
    el.content.appendChild(value)
  } else {
    applyAttributeTyped(el, name, value)
  }
}

let started = false
const observing = []

function start() {
  if (started) {
    return
  }

  started = true

  const frameLength = 33 // this is ~1/30th of a second, in milliseconds (1000/30)
  let lastFrame = 0
  requestAnimationFrame(function animate(delta) {
    if(delta - lastFrame > frameLength) {
      lastFrame = delta

      for (let i = 0; i < observing.length; ++i) {
        const o = observing[i]

        if (!o.root.parentNode) { // removed from DOM
          observing.splice(i--, 1) // remove
          continue
        }

        let hasChanged = false
        for (let j = 0, len = o.handlers.length; j < len; ++j) {
          const handler = o.handlers[j]
          hasChanged = !handler.model.eql(handler.before)
          if (hasChanged) {
            break
          }
        }

        if (hasChanged) {
          // reset changed state on all handlers of the current observer
          for (let j = 0, len = o.handlers.length; j < len; ++j) {
            const handler = o.handlers[j]
            handler.before = handler.model.state()
          }

          console.log('ipoxy: has changed')

          // call update callback
          o.callback()
        }
      }
    }

    requestAnimationFrame(animate)
  })
}

function observe(root, handlers, callback) {
  if (!handlers.length) {
    return
  }

  observing.push({ root: root, handlers: handlers, callback: callback })
  start()
}

module.exports = function bind(target, template, locals) {
  if(!target || target.nodeType !== Node.ELEMENT_NODE) {
    throw new TypeError('Target must be an element node')
  }

  if (!isTemplate(template)) {
    locals = template
    template = undefined
  }

  if (locals === undefined) {
    locals = []
  }

  if (typeof locals !== 'object') {
    throw new TypeError('locals must be an object or an array')
  }

  locals = Array.isArray(locals) ? locals : [locals]

  const root = target
  let content = root
  if (template) {
    content.innerHTML = '' // clear
    content = importNode(template.content, true)
  }

  const update = prepare(root, content)
  const updateFn = function() {
    idom.patch(target, update(locals))
  }

  // patch content in place
  idom.patch(content, update(locals))
  if (template) {
    // append result to root, if a template was used
    root.appendChild(content)
  }

  const handlers = locals
  .filter(local => Model.isModel(local))
  .map(local => {
    return { before: local.state(), model: local }
  })

  observe(target, handlers, updateFn)
  start()

  return updateFn
}

function prepare(root, content) {
  const ctx = { id: 0 }
  const children = prepareChildren(ctx, root, content)
  return function(locals) {
    return function() {
      children(locals)
    }
  }
}

function prepareChildren(ctx, node, content) {
  const callbacks = []

  for (let child = content.firstChild; child; child = child.nextSibling) {
    switch (child.nodeType) {
      case Node.ELEMENT_NODE:
        callbacks.push.apply(callbacks, visitElementNode(ctx, node, child))
        break
      case Node.TEXT_NODE:
        callbacks.push.apply(callbacks, visitTextNode(child))
        break
      default:
        continue
    }
  }

  return function(locals, id) {
    callbacks.forEach(function(fn) {
      fn(locals, id)
    })
  }
}

const RepeatMixin       = require('./mixin/repeat')
const IfMixin           = require('./mixin/if')
const UnlessMixin       = require('./mixin/unless')

const Attribute         = require('./attribute/attribute')
const BooleanAttribute  = require('./attribute/boolean')
const InputAttribute    = require('./attribute/input')

const MIXINS = [IfMixin, UnlessMixin, RepeatMixin]

function visitElementNode(ctx, parent, node, content) {
  const id = ++ctx.id

  // attributes
  const statics = []
  const attributes = []
  for (let i = 0, len = node.attributes.length; i < len; ++i) {
    const attr = node.attributes[i]
    const template = parser.parse(attr.value)

    if (!template.hasExpressions) {
      statics.push(attr.name, attr.value)
    } else {
      let attribute

      if (BooleanAttribute.isBooleanAttribute(node, attr)) {
        attribute = new BooleanAttribute(template, node, attr)
      } else if (InputAttribute.isInputValue(node, attr)) {
        attribute = new InputAttribute(template, node, attr)
      } else {
        attribute = new Attribute(template, node, attr)
      }

      attributes.push(attribute)
    }
  }

  // <textarea>
  const tagName = node.tagName.toLowerCase()
  if (tagName === 'textarea') {
    const attribute = new InputAttribute(parser.parse(node.value), node, { name: 'input' })
    statics.push.apply(statics, attribute.statics())
    attributes.push(attribute)
  }


  // <template>
  const isTempl = isTemplate(node)
  if (isTempl) {
    let head

    MIXINS.forEach(function(Mixin) {
      if (!Mixin['is' + Mixin.name](node)) {
        return
      }

      const template = parser.parse(node.getAttribute(Mixin.property) || '') || null

      if (!template.isSingleExpression) {
        throw new TypeError('Only one single expression allowd for mixins, '
                          + 'got: ' + template.source)
      }

      const content = head || prepareChildren(ctx, node, node.content)
      head = function(locals, keySuffix) {
        const mixin = new Mixin(template, content)
        mixin.update(locals)
        return mixin.execute()
      }
    })

    if (head) {
      return [head]
    }

    statics.push('content', node.content)
  }

  idom.initData(node, tagName, id)
  if (parent) {
    idom.registerChild(parent, id, node)
  }

  const selfContained = node.hasAttribute('self-contained')
  const children = !selfContained && prepareChildren(ctx, node, content || node)

  return [function(locals, idOverride) {
    // TODO: ignore statics, cause node re-use
    const args = [tagName, id || idOverride || null, statics.slice()]
    if (isTempl || selfContained) {
      args.push('locals', locals)
    }
    attributes.forEach(attr => {
      attr.update(locals)
      args.push.apply(args, attr.statics())
      args.push.apply(args, attr.render())
    })
    if (selfContained) {
      idom.elementPlaceholder.apply(idom, args)
    } else {
      idom.elementOpen.apply(idom, args)
      children(locals)
      idom.elementClose(tagName)
    }
  }]
}

const TextNode = require('./node/text')
const HTMLNode = require('./node/html')

function visitTextNode(node) {
  // ignore formatting
  if (node.nodeValue.match(/^\s+$/)) {
    return []
  }

  const template = parser.parse(node.nodeValue)

  if (!template.hasExpressions) {
    return [function() {
      idom.text(node.nodeValue)
    }]
  }

  return template.body.map(function(child) {
    if (child instanceof ast.Expression) {
      let isHTML = false
      for (let i = 0, len = child.filters.length; i < len; ++i) {
        if (child.filters[i].name === 'html') {
          isHTML = true
          child.filters.splice(i, 1)
          break
        }
      }

      const widget = isHTML ? new HTMLNode(child)
                          : new TextNode(child)
      return function(locals) {
        widget.update(locals)
        widget.render()
      }
    } else {
      return function() {
        if (child.text) {
          idom.text(child.text)
        }
      }
    }
  })
}



