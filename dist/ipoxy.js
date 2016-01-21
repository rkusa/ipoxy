(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.ipoxy = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (process){

/**
 * @license
 * Copyright 2015 The Incremental DOM Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/**
 * Copyright 2015 The Incremental DOM Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
  * Keeps track whether or not we are in an attributes declaration (after
  * elementOpenStart, but before elementOpenEnd).
  * @type {boolean}
  */
var inAttributes = false;

/**
  * Keeps track whether or not we are in an element that should not have its
  * children cleared.
  * @type {boolean}
  */
var inSkip = false;

/**
 * Makes sure that there is a current patch context.
 * @param {*} context
 */
var assertInPatch = function (context) {
  if (!context) {
    throw new Error('Cannot call currentElement() unless in patch');
  }
};

/**
* Makes sure that keyed Element matches the tag name provided.
* @param {!string} nodeName The nodeName of the node that is being matched.
* @param {string=} tag The tag name of the Element.
* @param {?string=} key The key of the Element.
*/
var assertKeyedTagMatches = function (nodeName, tag, key) {
  if (nodeName !== tag) {
    throw new Error('Was expecting node with key "' + key + '" to be a ' + tag + ', not a ' + nodeName + '.');
  }
};

/**
 * Makes sure that a patch closes every node that it opened.
 * @param {?Node} openElement
 * @param {!Node|!DocumentFragment} root
 */
var assertNoUnclosedTags = function (openElement, root) {
  if (openElement === root) {
    return;
  }

  var currentElement = openElement;
  var openTags = [];
  while (currentElement && currentElement !== root) {
    openTags.push(currentElement.nodeName.toLowerCase());
    currentElement = currentElement.parentNode;
  }

  throw new Error('One or more tags were not closed:\n' + openTags.join('\n'));
};

/**
 * Makes sure that the caller is not where attributes are expected.
 * @param {string} functionName
 */
var assertNotInAttributes = function (functionName) {
  if (inAttributes) {
    throw new Error(functionName + '() may not be called between ' + 'elementOpenStart() and elementOpenEnd().');
  }
};

/**
 * Makes sure that the caller is not inside an element that has declared skip.
 * @param {string} functionName
 */
var assertNotInSkip = function (functionName) {
  if (inSkip) {
    throw new Error(functionName + '() may not be called inside an element ' + 'that has called skip().');
  }
};

/**
 * Makes sure that the caller is where attributes are expected.
 * @param {string} functionName
 */
var assertInAttributes = function (functionName) {
  if (!inAttributes) {
    throw new Error(functionName + '() must be called after ' + 'elementOpenStart().');
  }
};

/**
 * Makes sure the patch closes virtual attributes call
 */
var assertVirtualAttributesClosed = function () {
  if (inAttributes) {
    throw new Error('elementOpenEnd() must be called after calling ' + 'elementOpenStart().');
  }
};

/**
  * Makes sure that placeholders have a key specified. Otherwise, conditional
  * placeholders and conditional elements next to placeholders will cause
  * placeholder elements to be re-used as non-placeholders and vice versa.
  * @param {string} key
  */
var assertPlaceholderKeySpecified = function (key) {
  if (!key) {
    throw new Error('Placeholder elements must have a key specified.');
  }
};

/**
  * Makes sure that tags are correctly nested.
  * @param {string} nodeName
  * @param {string} tag
  */
var assertCloseMatchesOpenTag = function (nodeName, tag) {
  if (nodeName !== tag) {
    throw new Error('Received a call to close ' + tag + ' but ' + nodeName + ' was open.');
  }
};

/**
 * Makes sure that no children elements have been declared yet in the current
 * element.
 * @param {string} functionName
 * @param {?Node} previousNode
 */
var assertNoChildrenDeclaredYet = function (functionName, previousNode) {
  if (previousNode !== null) {
    throw new Error(functionName + '() must come before any child ' + 'declarations inside the current element.');
  }
};

/**
 * Checks that a call to patchElement actually patched the element.
 * @param {?Node} node The node requested to be patched.
 * @param {?Node} currentNode The currentNode after the patch.
 */
var assertPatchElementNotEmpty = function (node, currentNode) {
  if (node === currentNode) {
    throw new Error('There must be exactly one top level call corresponding ' + 'to the patched element.');
  }
};

/**
 * Checks that a call to patchElement actually patched the element.
 * @param {?Node} node The node requested to be patched.
 * @param {?Node} previousNode The previousNode after the patch.
 */
var assertPatchElementNoExtras = function (node, previousNode) {
  if (node !== previousNode) {
    throw new Error('There must be exactly one top level call corresponding ' + 'to the patched element.');
  }
};

/**
 * Updates the state of being in an attribute declaration.
 * @param {boolean} value
 * @return {boolean} the previous value.
 */
var setInAttributes = function (value) {
  var previous = inAttributes;
  inAttributes = value;
  return previous;
};

/**
 * Updates the state of being in a skip element.
 * @param {boolean} value
 * @return {boolean} the previous value.
 */
var setInSkip = function (value) {
  var previous = inSkip;
  inSkip = value;
  return previous;
};

/**
 * Copyright 2015 The Incremental DOM Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/** */
exports.notifications = {
  /**
   * Called after patch has compleated with any Nodes that have been created
   * and added to the DOM.
   * @type {?function(Array<!Node>)}
   */
  nodesCreated: null,

  /**
   * Called after patch has compleated with any Nodes that have been removed
   * from the DOM.
   * Note it's an applications responsibility to handle any childNodes.
   * @type {?function(Array<!Node>)}
   */
  nodesDeleted: null
};

/**
 * Keeps track of the state of a patch.
 * @constructor
 */
function Context() {
  /**
   * @type {(Array<!Node>|undefined)}
   */
  this.created = exports.notifications.nodesCreated && [];

  /**
   * @type {(Array<!Node>|undefined)}
   */
  this.deleted = exports.notifications.nodesDeleted && [];
}

/**
 * @param {!Node} node
 */
Context.prototype.markCreated = function (node) {
  if (this.created) {
    this.created.push(node);
  }
};

/**
 * @param {!Node} node
 */
Context.prototype.markDeleted = function (node) {
  if (this.deleted) {
    this.deleted.push(node);
  }
};

/**
 * Notifies about nodes that were created during the patch opearation.
 */
Context.prototype.notifyChanges = function () {
  if (this.created && this.created.length > 0) {
    exports.notifications.nodesCreated(this.created);
  }

  if (this.deleted && this.deleted.length > 0) {
    exports.notifications.nodesDeleted(this.deleted);
  }
};

/**
 * Copyright 2015 The Incremental DOM Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * A cached reference to the hasOwnProperty function.
 */
var hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * A cached reference to the create function.
 */
var create = Object.create;

/**
 * Used to prevent property collisions between our "map" and its prototype.
 * @param {!Object<string, *>} map The map to check.
 * @param {string} property The property to check.
 * @return {boolean} Whether map has property.
 */
var has = function (map, property) {
  return hasOwnProperty.call(map, property);
};

/**
 * Creates an map object without a prototype.
 * @return {!Object}
 */
var createMap = function () {
  return create(null);
};

/**
 * Keeps track of information needed to perform diffs for a given DOM node.
 * @param {!string} nodeName
 * @param {?string=} key
 * @constructor
 */
function NodeData(nodeName, key) {
  /**
   * The attributes and their values.
   * @const {!Object<string, *>}
   */
  this.attrs = createMap();

  /**
   * An array of attribute name/value pairs, used for quickly diffing the
   * incomming attributes to see if the DOM node's attributes need to be
   * updated.
   * @const {Array<*>}
   */
  this.attrsArr = [];

  /**
   * The incoming attributes for this Node, before they are updated.
   * @const {!Object<string, *>}
   */
  this.newAttrs = createMap();

  /**
   * The key used to identify this node, used to preserve DOM nodes when they
   * move within their parent.
   * @const
   */
  this.key = key;

  /**
   * Keeps track of children within this node by their key.
   * {?Object<string, !Element>}
   */
  this.keyMap = null;

  /**
   * Whether or not the keyMap is currently valid.
   * {boolean}
   */
  this.keyMapValid = true;

  /**
   * The node name for this node.
   * @const {string}
   */
  this.nodeName = nodeName;

  /**
   * @type {?string}
   */
  this.text = null;
}

/**
 * Initializes a NodeData object for a Node.
 *
 * @param {Node} node The node to initialize data for.
 * @param {string} nodeName The node name of node.
 * @param {?string=} key The key that identifies the node.
 * @return {!NodeData} The newly initialized data object
 */
var initData = function (node, nodeName, key) {
  var data = new NodeData(nodeName, key);
  node['__incrementalDOMData'] = data;
  return data;
};

/**
 * Retrieves the NodeData object for a Node, creating it if necessary.
 *
 * @param {Node} node The node to retrieve the data for.
 * @return {!NodeData} The NodeData for this Node.
 */
var getData = function (node) {
  var data = node['__incrementalDOMData'];

  if (!data) {
    var nodeName = node.nodeName.toLowerCase();
    var key = null;

    if (node instanceof Element) {
      key = node.getAttribute('key');
    }

    data = initData(node, nodeName, key);
  }

  return data;
};

/**
 * Copyright 2015 The Incremental DOM Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

exports.symbols = {
  default: '__default',

  placeholder: '__placeholder'
};

/**
 * Applies an attribute or property to a given Element. If the value is null
 * or undefined, it is removed from the Element. Otherwise, the value is set
 * as an attribute.
 * @param {!Element} el
 * @param {string} name The attribute's name.
 * @param {?(boolean|number|string)=} value The attribute's value.
 */
exports.applyAttr = function (el, name, value) {
  if (value == null) {
    el.removeAttribute(name);
  } else {
    el.setAttribute(name, value);
  }
};

/**
 * Applies a property to a given Element.
 * @param {!Element} el
 * @param {string} name The property's name.
 * @param {*} value The property's value.
 */
exports.applyProp = function (el, name, value) {
  el[name] = value;
};

/**
 * Applies a style to an Element. No vendor prefix expansion is done for
 * property names/values.
 * @param {!Element} el
 * @param {string} name The attribute's name.
 * @param {*} style The style to set. Either a string of css or an object
 *     containing property-value pairs.
 */
var applyStyle = function (el, name, style) {
  if (typeof style === 'string') {
    el.style.cssText = style;
  } else {
    el.style.cssText = '';
    var elStyle = el.style;
    var obj = /** @type {!Object<string,string>} */style;

    for (var prop in obj) {
      if (has(obj, prop)) {
        elStyle[prop] = obj[prop];
      }
    }
  }
};

/**
 * Updates a single attribute on an Element.
 * @param {!Element} el
 * @param {string} name The attribute's name.
 * @param {*} value The attribute's value. If the value is an object or
 *     function it is set on the Element, otherwise, it is set as an HTML
 *     attribute.
 */
var applyAttributeTyped = function (el, name, value) {
  var type = typeof value;

  if (type === 'object' || type === 'function') {
    exports.applyProp(el, name, value);
  } else {
    exports.applyAttr(el, name, /** @type {?(boolean|number|string)} */value);
  }
};

/**
 * Calls the appropriate attribute mutator for this attribute.
 * @param {!Element} el
 * @param {string} name The attribute's name.
 * @param {*} value The attribute's value.
 */
var updateAttribute = function (el, name, value) {
  var data = getData(el);
  var attrs = data.attrs;

  if (attrs[name] === value) {
    return;
  }

  var mutator = exports.attributes[name] || exports.attributes[exports.symbols.default];
  mutator(el, name, value);

  attrs[name] = value;
};

/**
 * A publicly mutable object to provide custom mutators for attributes.
 * @const {!Object<string, function(!Element, string, *)>}
 */
exports.attributes = createMap();

// Special generic mutator that's called for any attribute that does not
// have a specific mutator.
exports.attributes[exports.symbols.default] = applyAttributeTyped;

exports.attributes[exports.symbols.placeholder] = function () {};

exports.attributes['style'] = applyStyle;

/**
 * Gets the namespace to create an element (of a given tag) in.
 * @param {string} tag The tag to get the namespace for.
 * @param {?Node} parent
 * @return {?string} The namespace to create the tag in.
 */
var getNamespaceForTag = function (tag, parent) {
  if (tag === 'svg') {
    return 'http://www.w3.org/2000/svg';
  }

  if (getData(parent).nodeName === 'foreignObject') {
    return null;
  }

  return parent.namespaceURI;
};

/**
 * Creates an Element.
 * @param {Document} doc The document with which to create the Element.
 * @param {?Node} parent
 * @param {string} tag The tag for the Element.
 * @param {?string=} key A key to identify the Element.
 * @param {?Array<*>=} statics An array of attribute name/value pairs of the
 *     static attributes for the Element.
 * @return {!Element}
 */
var createElement = function (doc, parent, tag, key, statics) {
  var namespace = getNamespaceForTag(tag, parent);
  var is = statics && statics[0] === 'is' && statics[1];
  var el;

  if (is) {
    if (namespace) {
      el = doc.createElementNS(namespace, tag, is);
    } else {
      el = doc.createElement(tag, is);
    }
  } else {
    if (namespace) {
      el = doc.createElementNS(namespace, tag);
    } else {
      el = doc.createElement(tag);
    }
  }

  initData(el, tag, key);

  if (statics) {
    for (var i = 0; i < statics.length; i += 2) {
      updateAttribute(el, /** @type {!string}*/statics[i], statics[i + 1]);
    }
  }

  return el;
};

/**
 * Creates a Text Node.
 * @param {Document} doc The document with which to create the Element.
 * @return {!Text}
 */
var createText = function (doc) {
  var node = doc.createTextNode('');
  initData(node, '#text', null);
  return node;
};

/**
 * Creates a mapping that can be used to look up children using a key.
 * @param {?Node} el
 * @return {!Object<string, !Element>} A mapping of keys to the children of the
 *     Element.
 */
var createKeyMap = function (el) {
  var map = createMap();
  var children = el.children;
  var count = children.length;

  for (var i = 0; i < count; i += 1) {
    var child = children[i];
    var key = getData(child).key;

    if (key) {
      map[key] = child;
    }
  }

  return map;
};

/**
 * Retrieves the mapping of key to child node for a given Element, creating it
 * if necessary.
 * @param {?Node} el
 * @return {!Object<string, !Node>} A mapping of keys to child Elements
 */
var getKeyMap = function (el) {
  var data = getData(el);

  if (!data.keyMap) {
    data.keyMap = createKeyMap(el);
  }

  return data.keyMap;
};

/**
 * Retrieves a child from the parent with the given key.
 * @param {?Node} parent
 * @param {?string=} key
 * @return {?Node} The child corresponding to the key.
 */
var getChild = function (parent, key) {
  return key ? getKeyMap(parent)[key] : null;
};

/**
 * Registers an element as being a child. The parent will keep track of the
 * child using the key. The child can be retrieved using the same key using
 * getKeyMap. The provided key should be unique within the parent Element.
 * @param {?Node} parent The parent of child.
 * @param {string} key A key to identify the child with.
 * @param {!Node} child The child to register.
 */
var registerChild = function (parent, key, child) {
  getKeyMap(parent)[key] = child;
};

/** @type {?Context} */
var context = null;

/** @type {?Node} */
var currentNode;

/** @type {?Node} */
var currentParent;

/** @type {?Node} */
var previousNode;

/** @type {?Element|?DocumentFragment} */
var root;

/** @type {?Document} */
var doc;

/**
 * Sets up and restores a patch context, running the patch function with the
 * provided data.
 * @param {!Element|!DocumentFragment} node The Element or Document
 *     where the patch should start.
 * @param {!function(T)} fn The patching function.
 * @param {T=} data An argument passed to fn.
 * @template T
 */
var runPatch = function (node, fn, data) {
  var prevContext = context;
  var prevRoot = root;
  var prevDoc = doc;
  var prevCurrentNode = currentNode;
  var prevCurrentParent = currentParent;
  var prevPreviousNode = previousNode;
  var previousInAttributes = false;
  var previousInSkip = false;

  context = new Context();
  root = node;
  doc = node.ownerDocument;
  currentNode = node;
  currentParent = node.parentNode;
  previousNode = null;

  if (process.env.NODE_ENV !== 'production') {
    previousInAttributes = setInAttributes(false);
    previousInSkip = setInSkip(false);
  }

  fn(data);

  if (process.env.NODE_ENV !== 'production') {
    assertVirtualAttributesClosed();
    setInAttributes(previousInAttributes);
    setInSkip(previousInSkip);
  }

  context.notifyChanges();

  context = prevContext;
  root = prevRoot;
  doc = prevDoc;
  currentNode = prevCurrentNode;
  currentParent = prevCurrentParent;
  previousNode = prevPreviousNode;
};

/**
 * Patches the document starting at node with the provided function. This
 * function may be called during an existing patch operation.
 * @param {!Element|!DocumentFragment} node The Element or Document
 *     to patch.
 * @param {!function(T)} fn A function containing elementOpen/elementClose/etc.
 *     calls that describe the DOM.
 * @param {T=} data An argument passed to fn to represent DOM state.
 * @template T
 */
exports.patch = function (node, fn, data) {
  runPatch(node, function (data) {
    enterNode();
    fn(data);
    exitNode();

    if (process.env.NODE_ENV !== 'production') {
      assertNoUnclosedTags(previousNode, node);
    }
  }, data);
};

/**
 * Patches an Element with the the provided function. Exactly one top level
 * element call should be made corresponding to `node`.
 * @param {!Element} node The Element where the patch should start.
 * @param {!function(T)} fn A function containing elementOpen/elementClose/etc.
 *     calls that describe the DOM. This should have at most one top level
 *     element call.
 * @param {T=} data An argument passed to fn to represent DOM state.
 * @template T
 */
exports.patchElement = function (node, fn, data) {
  runPatch(node, function (data) {
    fn(data);

    if (process.env.NODE_ENV !== 'production') {
      assertPatchElementNotEmpty(node, currentNode);
      assertPatchElementNoExtras(node, previousNode);
    }
  }, data);
};

/**
 * Checks whether or not the current node matches the specified nodeName and
 * key.
 *
 * @param {?string} nodeName The nodeName for this node.
 * @param {?string=} key An optional key that identifies a node.
 * @return {boolean} True if the node matches, false otherwise.
 */
var matches = function (nodeName, key) {
  var data = getData(currentNode);

  // Key check is done using double equals as we want to treat a null key the
  // same as undefined. This should be okay as the only values allowed are
  // strings, null and undefined so the == semantics are not too weird.
  return nodeName === data.nodeName && key == data.key;
};

/**
 * Aligns the virtual Element definition with the actual DOM, moving the
 * corresponding DOM node to the correct location or creating it if necessary.
 * @param {string} nodeName For an Element, this should be a valid tag string.
 *     For a Text, this should be #text.
 * @param {?string=} key The key used to identify this element.
 * @param {?Array<*>=} statics For an Element, this should be an array of
 *     name-value pairs.
 */
var alignWithDOM = function (nodeName, key, statics) {
  if (currentNode && matches(nodeName, key)) {
    return;
  }

  var node;

  // Check to see if the node has moved within the parent.
  if (key) {
    node = getChild(currentParent, key);
    if (node && process.env.NODE_ENV !== 'production') {
      assertKeyedTagMatches(getData(node).nodeName, nodeName, key);
    }
  }

  // Create the node if it doesn't exist.
  if (!node) {
    if (nodeName === '#text') {
      node = createText(doc);
    } else {
      node = createElement(doc, currentParent, nodeName, key, statics);
    }

    if (key) {
      registerChild(currentParent, key, node);
    }

    context.markCreated(node);
  }

  // If the node has a key, remove it from the DOM to prevent a large number
  // of re-orders in the case that it moved far or was completely removed.
  // Since we hold on to a reference through the keyMap, we can always add it
  // back.
  if (currentNode && getData(currentNode).key) {
    currentParent.replaceChild(node, currentNode);
    getData(currentParent).keyMapValid = false;
  } else {
    currentParent.insertBefore(node, currentNode);
  }

  currentNode = node;
};

/**
 * Clears out any unvisited Nodes, as the corresponding virtual element
 * functions were never called for them.
 */
var clearUnvisitedDOM = function () {
  var node = currentParent;
  var data = getData(node);
  var keyMap = data.keyMap;
  var keyMapValid = data.keyMapValid;
  var child = node.lastChild;
  var key;

  if (child === previousNode && keyMapValid) {
    return;
  }

  if (data.attrs[exports.symbols.placeholder] && node !== root) {
    return;
  }

  while (child !== previousNode) {
    node.removeChild(child);
    context.markDeleted( /** @type {!Node}*/child);

    key = getData(child).key;
    if (key) {
      delete keyMap[key];
    }
    child = node.lastChild;
  }

  // Clean the keyMap, removing any unusued keys.
  if (!keyMapValid) {
    for (key in keyMap) {
      child = keyMap[key];
      if (child.parentNode !== node) {
        context.markDeleted(child);
        delete keyMap[key];
      }
    }

    data.keyMapValid = true;
  }
};

/**
 * Changes to the first child of the current node.
 */
var enterNode = function () {
  currentParent = currentNode;
  currentNode = currentNode.firstChild;
  previousNode = null;
};

/**
 * Changes to the next sibling of the current node.
 */
var nextNode = function () {
  previousNode = currentNode;
  currentNode = currentNode.nextSibling;
};

/**
 * Changes to the parent of the current node, removing any unvisited children.
 */
var exitNode = function () {
  clearUnvisitedDOM();

  previousNode = currentParent;
  currentNode = currentParent.nextSibling;
  currentParent = currentParent.parentNode;
};

/**
 * Makes sure that the current node is an Element with a matching tagName and
 * key.
 *
 * @param {string} tag The element's tag.
 * @param {?string=} key The key used to identify this element. This can be an
 *     empty string, but performance may be better if a unique value is used
 *     when iterating over an array of items.
 * @param {?Array<*>=} statics An array of attribute name/value pairs of the
 *     static attributes for the Element. These will only be set once when the
 *     Element is created.
 * @return {!Element} The corresponding Element.
 */
var _elementOpen = function (tag, key, statics) {
  alignWithDOM(tag, key, statics);
  enterNode();
  return (/** @type {!Element} */currentParent
  );
};

/**
 * Closes the currently open Element, removing any unvisited children if
 * necessary.
 *
 * @return {!Element} The corresponding Element.
 */
var _elementClose = function () {
  if (process.env.NODE_ENV !== 'production') {
    setInSkip(false);
  }

  exitNode();
  return (/** @type {!Element} */previousNode
  );
};

/**
 * Makes sure the current node is a Text node and creates a Text node if it is
 * not.
 *
 * @return {!Text} The corresponding Text Node.
 */
var _text = function () {
  alignWithDOM('#text', null, null);
  nextNode();
  return (/** @type {!Text} */previousNode
  );
};

/**
 * Gets the current Element being patched.
 * @return {!Element}
 */
exports.currentElement = function () {
  if (process.env.NODE_ENV !== 'production') {
    assertInPatch(context);
    assertNotInAttributes('currentElement');
  }
  return (/** @type {!Element} */currentParent
  );
};

/**
 * Skips the children in a subtree, allowing an Element to be closed without
 * clearing out the children.
 */
exports.skip = function () {
  if (process.env.NODE_ENV !== 'production') {
    assertNoChildrenDeclaredYet('skip', previousNode);
    setInSkip(true);
  }
  previousNode = currentParent.lastChild;
};

/**
 * The offset in the virtual element declaration where the attributes are
 * specified.
 * @const
 */
var ATTRIBUTES_OFFSET = 3;

/**
 * Builds an array of arguments for use with elementOpenStart, attr and
 * elementOpenEnd.
 * @const {Array<*>}
 */
var argsBuilder = [];

/**
 * @param {string} tag The element's tag.
 * @param {?string=} key The key used to identify this element. This can be an
 *     empty string, but performance may be better if a unique value is used
 *     when iterating over an array of items.
 * @param {?Array<*>=} statics An array of attribute name/value pairs of the
 *     static attributes for the Element. These will only be set once when the
 *     Element is created.
 * @param {...*} var_args Attribute name/value pairs of the dynamic attributes
 *     for the Element.
 * @return {!Element} The corresponding Element.
 */
exports.elementOpen = function (tag, key, statics, var_args) {
  if (process.env.NODE_ENV !== 'production') {
    assertNotInAttributes('elementOpen');
    assertNotInSkip('elementOpen');
  }

  var node = _elementOpen(tag, key, statics);
  var data = getData(node);

  /*
   * Checks to see if one or more attributes have changed for a given Element.
   * When no attributes have changed, this is much faster than checking each
   * individual argument. When attributes have changed, the overhead of this is
   * minimal.
   */
  var attrsArr = data.attrsArr;
  var newAttrs = data.newAttrs;
  var attrsChanged = false;
  var i = ATTRIBUTES_OFFSET;
  var j = 0;

  for (; i < arguments.length; i += 1, j += 1) {
    if (attrsArr[j] !== arguments[i]) {
      attrsChanged = true;
      break;
    }
  }

  for (; i < arguments.length; i += 1, j += 1) {
    attrsArr[j] = arguments[i];
  }

  if (j < attrsArr.length) {
    attrsChanged = true;
    attrsArr.length = j;
  }

  /*
   * Actually perform the attribute update.
   */
  if (attrsChanged) {
    for (i = ATTRIBUTES_OFFSET; i < arguments.length; i += 2) {
      newAttrs[arguments[i]] = arguments[i + 1];
    }

    for (var attr in newAttrs) {
      updateAttribute(node, attr, newAttrs[attr]);
      newAttrs[attr] = undefined;
    }
  }

  return node;
};

/**
 * Declares a virtual Element at the current location in the document. This
 * corresponds to an opening tag and a elementClose tag is required. This is
 * like elementOpen, but the attributes are defined using the attr function
 * rather than being passed as arguments. Must be folllowed by 0 or more calls
 * to attr, then a call to elementOpenEnd.
 * @param {string} tag The element's tag.
 * @param {?string=} key The key used to identify this element. This can be an
 *     empty string, but performance may be better if a unique value is used
 *     when iterating over an array of items.
 * @param {?Array<*>=} statics An array of attribute name/value pairs of the
 *     static attributes for the Element. These will only be set once when the
 *     Element is created.
 */
exports.elementOpenStart = function (tag, key, statics) {
  if (process.env.NODE_ENV !== 'production') {
    assertNotInAttributes('elementOpenStart');
    setInAttributes(true);
  }

  argsBuilder[0] = tag;
  argsBuilder[1] = key;
  argsBuilder[2] = statics;
};

/***
 * Defines a virtual attribute at this point of the DOM. This is only valid
 * when called between elementOpenStart and elementOpenEnd.
 *
 * @param {string} name
 * @param {*} value
 */
exports.attr = function (name, value) {
  if (process.env.NODE_ENV !== 'production') {
    assertInAttributes('attr');
  }

  argsBuilder.push(name, value);
};

/**
 * Closes an open tag started with elementOpenStart.
 * @return {!Element} The corresponding Element.
 */
exports.elementOpenEnd = function () {
  if (process.env.NODE_ENV !== 'production') {
    assertInAttributes('elementOpenEnd');
    setInAttributes(false);
  }

  var node = exports.elementOpen.apply(null, argsBuilder);
  argsBuilder.length = 0;
  return node;
};

/**
 * Closes an open virtual Element.
 *
 * @param {string} tag The element's tag.
 * @return {!Element} The corresponding Element.
 */
exports.elementClose = function (tag) {
  if (process.env.NODE_ENV !== 'production') {
    assertNotInAttributes('elementClose');
  }

  var node = _elementClose();

  if (process.env.NODE_ENV !== 'production') {
    assertCloseMatchesOpenTag(getData(node).nodeName, tag);
  }

  return node;
};

/**
 * Declares a virtual Element at the current location in the document that has
 * no children.
 * @param {string} tag The element's tag.
 * @param {?string=} key The key used to identify this element. This can be an
 *     empty string, but performance may be better if a unique value is used
 *     when iterating over an array of items.
 * @param {?Array<*>=} statics An array of attribute name/value pairs of the
 *     static attributes for the Element. These will only be set once when the
 *     Element is created.
 * @param {...*} var_args Attribute name/value pairs of the dynamic attributes
 *     for the Element.
 * @return {!Element} The corresponding Element.
 */
exports.elementVoid = function (tag, key, statics, var_args) {
  var node = exports.elementOpen.apply(null, arguments);
  exports.elementClose.apply(null, arguments);
  return node;
};

/**
 * Declares a virtual Element at the current location in the document that is a
 * placeholder element. Children of this Element can be manually managed and
 * will not be cleared by the library.
 *
 * A key must be specified to make sure that this node is correctly preserved
 * across all conditionals.
 *
 * @param {string} tag The element's tag.
 * @param {string} key The key used to identify this element.
 * @param {?Array<*>=} statics An array of attribute name/value pairs of the
 *     static attributes for the Element. These will only be set once when the
 *     Element is created.
 * @param {...*} var_args Attribute name/value pairs of the dynamic attributes
 *     for the Element.
 * @return {!Element} The corresponding Element.
 */
exports.elementPlaceholder = function (tag, key, statics, var_args) {
  if (process.env.NODE_ENV !== 'production') {
    assertPlaceholderKeySpecified(key);
  }

  exports.elementOpen.apply(null, arguments);
  exports.skip();
  return exports.elementClose.apply(null, arguments);
};

/**
 * Declares a virtual Text at this point in the document.
 *
 * @param {string|number|boolean} value The value of the Text.
 * @param {...(function((string|number|boolean)):string)} var_args
 *     Functions to format the value which are called only when the value has
 *     changed.
 * @return {!Text} The corresponding text node.
 */
exports.text = function (value, var_args) {
  if (process.env.NODE_ENV !== 'production') {
    assertNotInAttributes('text');
    assertNotInSkip('text');
  }

  var node = _text();
  var data = getData(node);

  if (data.text !== value) {
    data.text = /** @type {string} */value;

    var formatted = value;
    for (var i = 1; i < arguments.length; i += 1) {
      formatted = arguments[i](formatted);
    }

    node.data = formatted;
  }

  return node;
};

}).call(this,require('_process'))
},{"_process":21}],2:[function(require,module,exports){
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


},{"../node/base":13}],3:[function(require,module,exports){
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


},{"../node/base":13}],4:[function(require,module,exports){
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


},{"../node/base":13}],5:[function(require,module,exports){
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
    var getter = function() {
      return reference.get()
    }
    getter.parent = reference.obj
    getter.key    = reference.key
    getter.alias  = reference.alias

    Object.defineProperty(el, name, {
      get: getter,
      set: function(val) {
        reference.set(val)
      },
      enumerable: true
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

  target.innerHTML = '' // clear
  // const root = target.cloneNode(false)
  const root = target
  if (template) {
    root.appendChild(importNode(template.content, true))
  }

  const update = prepare(root)
  const updateFn = function() {
    idom.patchElement(target, update(locals))
  }

  updateFn()

  const handlers = locals
  .filter(local => Model.isModel(local))
  .map(local => {
    return { before: local.state(), model: local }
  })

  observe(target, handlers, updateFn)
  start()

  return updateFn
}

function prepare(root) {
  const callbacks = visitElementNode(root)

  return function(locals) {
    return function() {
      callbacks.forEach(function(callback) {
        callback(locals)
      })
    }
  }
}

function prepareChildren(node) {
  const callbacks = []

  for (let child = node.firstChild; child; child = child.nextSibling) {
    switch (child.nodeType) {
      case Node.ELEMENT_NODE:
        callbacks.push.apply(callbacks, visitElementNode(child))
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

function visitElementNode(node) {
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
  if (isTemplate(node)) {
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

      const content = head || prepareChildren(node.content)
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

  const children = prepareChildren(node)
  return [function(locals, id) {
    const args = [tagName, id || null, statics]
    attributes.forEach(attr => {
      attr.update(locals)
      args[2].push.apply(args[2], attr.statics())
      args.push.apply(args, attr.render())
    })
    idom.elementOpen.apply(idom, args)
    children(locals)
    idom.elementClose(tagName)
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




},{"./attribute/attribute":2,"./attribute/boolean":3,"./attribute/input":4,"./mixin/if":9,"./mixin/repeat":10,"./mixin/unless":11,"./model":12,"./node/html":14,"./node/text":15,"./parser":17,"./parser/ast":16,"./utils":19,"incremental-dom":1}],6:[function(require,module,exports){
'use strict'

exports.filter = Object.create(null)

exports.registerFilter = function(name, fn) {
  exports.filter[name] = fn
}

exports.registerFilter('class', function(condition, name) {
  return condition ? name : ''
})

},{}],7:[function(require,module,exports){
'use strict'

var parser = require('./parser')
exports.parse = parser.parse
exports.ast   = parser.ast

exports.registerFilter = require('./filter').registerFilter

exports.bind = require('./bind')

var utils = require('./utils')
exports.importNode = utils.importNode
exports.cloneNode  = utils.cloneNode
exports.isTemplate = utils.isTemplate

var Model = exports.Model = require('./model')
exports.model = function(fns) {
  return new Model(fns)
}
exports.alias = Model.alias

Object.defineProperties(exports, {
  updateProperty: {
    get: function() {
      return Model.updateProperty
    },
    set: function(fn) {
      Model.updateProperty = fn
    },
    enumerable: true
  },
  createCursor: {
    get: function() {
      return Model.createCursor
    },
    set: function(fn) {
      Model.createCursor = fn
    },
    enumerable: true
  }
})

},{"./bind":5,"./filter":6,"./model":12,"./parser":17,"./utils":19}],8:[function(require,module,exports){
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


},{"../node/base":13}],9:[function(require,module,exports){
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


},{"./base":8}],10:[function(require,module,exports){
'use strict'

const BaseMixin = require('./base')
const Model = require('../model')

module.exports = class RepeatMixin extends BaseMixin {
  constructor(template, content) {
    super(template)

    this.content = content
  }

  execute() {
    const value = this.value
    if (!value) {
      return []
    }

    const children = []

    value.forEach((row, i) => {
      const model = {
        get: () => {
          return this.value && (Array.isArray(this.value) ? this.value[i] : this.value.get(i))
        },
        // TODO: used?
        set: val => {
          console.log('SET')
          if (Array.isArray(this.value)) {
            this.value[i] = val
          } else {
            this.value.set(i, val)
          }
        }
      }

      const locals = this.locals.slice()
      const alias = this.contents[0].alias

      if (alias) {
        if (Array.isArray(alias)) {
          const local = {}
          local[alias[0]] = i
          locals.unshift(local)
          alias = alias[1]
        }

        locals.unshift(Model.alias(alias, model))
      } else {
        locals.unshift(new Model(model))
      }

      const item = model.get()
      const id = item.id

      children.push.apply(children, this.content(locals, id))
    }, this)

    return children
  }

  static get property() {
    return 'repeat'
  }

  static isRepeatMixin(node) {
    return node.tagName === 'TEMPLATE' && node.hasAttribute(this.property)
  }
}


},{"../model":12,"./base":8}],11:[function(require,module,exports){
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


},{"./if":9}],12:[function(require,module,exports){
'use strict'

var Model = module.exports = function(fns) {
  this.getFn   = fns.get
  this.setFn   = fns.set
  this.eqlFn   = fns.eql
  this.stateFn = fns.state
}

Model.isModel = function(val) {
  return val && (val instanceof Model ||
    (typeof val.getFn === 'function'
      && typeof val.setFn === 'function'))
}

// TODO: remove
Model.updateProperty = function(obj, prop, val) {
  obj[prop] = val
  return obj
}

Model.createCursor = function(/*obj, path, callback*/) {
  throw new Error('No default implementation; a custom one must be provided')
}

Model.prototype.get = function() {
  if (this.getFn) {
    return this.getFn()
  }
}

// TODO: used?
Model.prototype.set = function(val) {
  if (this.setFn) {
    this.setFn(val)
  }
}

Model.prototype.eql = function(rhs) {
  if (this.eqlFn) {
    return this.eqlFn(rhs)
  }

  var cur = this.state()
  return rhs === cur
}

Model.prototype.state = function() {
  if (this.stateFn) {
    return this.stateFn()
  }

  var val = this.get()
  return val
}

Model.alias = function(alias, fns) {
  var local = {}
  var model = new Model(fns)

  return new Model({
    get: function() {
      local[alias] = model.get()
      return local
    },
    set: function(newVal) {
      model.set(newVal.get(alias))
    },
    eql: function(rhs) {
      return model.eql(rhs)
    },
    state: function() {
      return model.state()
    }
  })
}

},{}],13:[function(require,module,exports){
'use strict'

const filter = require('../filter').filter

module.exports = class BaseNode {
  constructor(template) {
    this.template = template
  }

  get value() {
    if (this.template.isSingleExpression) {
      return this.contents[0].get()
    } else {
      return this.contents.map(function(val) {
        val = val.valueOf()
        if (val === undefined || val === null) {
          return ''
        }
        val = String(val)
        if (val === '[object Object]') {
          return ''
        }
        return val
      }).join('')
    }
  }

  // TODO: used?
  set value(val) {
    this.set(val)
  }

  set(val) {
    if (this.template.isSingleExpression) {
      return this.contents[0].set(val)
    }

    return val
  }

  render() {
    // abstract
  }

  update(locals) {
    if (!this.template) {
      return
    }

    this.contents = this.template.compile(locals, { filter: filter }) || []
    this.locals   = locals
    if (!Array.isArray(this.contents)) {
      this.contents = [this.contents]
    }
  }
}


},{"../filter":6}],14:[function(require,module,exports){
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


},{"./base":13,"incremental-dom":1}],15:[function(require,module,exports){
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


},{"./base":13,"incremental-dom":1}],16:[function(require,module,exports){
/*eslint-disable no-constant-condition, no-loop-func*/
'use strict'

var Program = exports.Program = function(body, source) {
  this.body   = body || []
  this.source = source
}

Program.prototype.compile = function(locals, opts) {
  return this.body.map(function(node) {
    return node.compile(locals, opts)
  })
}

Object.defineProperties(Program.prototype, {
  isSingleExpression: {
    get: function() {
      return this.body.length === 1 && this.body[0] instanceof Expression
    },
    enumerable: true
  },
  hasExpressions: {
    get: function() {
      return this.body.length > 1 ||
        (this.body.length && !(this.body[0] instanceof Text))
    },
    enumerable: true
  },
  isEmpty: {
    get: function() {
      return this.body.length === 0
    },
    enumerable: true
  }
})

var Text = exports.Text = function(text) {
  this.text = text
}

Text.prototype.compile = function() {
  return this.text
}

var Expression = exports.Expression = function(path, alias, filters) {
  this.path    = path
  this.alias   = alias
  this.filters = filters || []
}

Expression.prototype.compile = function(locals, opts) {
  var ref   = this.path.compile(locals)
  ref.alias = this.alias
  if (this.filters.length && opts && opts.filter) {
    ref.filters = this.filters.filter(function(filter) {
      return filter.name in opts.filter
    }).map(function(filter) {
      var fn = opts.filter[filter.name], dispose
      if ('initialize' in fn) {
        dispose = fn.initialize(ref)
      }
      return {
        name:    filter.name,
        fn:      fn,
        dispose: dispose,
        args:    filter.args && filter.args.map(function(arg) {
          if (arg && typeof arg.compile === 'function') {
            return arg.compile(locals)
          } else {
            return arg
          }
        })
      }
    })
  }
  return ref
}

var Model = require('../model')

var Path = exports.Path = function(path) {
  this.keys = path
}

Path.prototype.compile = function(locals) {
  if (!this.keys.length) {
    return new Reference(locals[0])
  }

  var path = this.keys.slice()

  var obj
  for (var i = 0, len = locals.length; i < len; ++i) {
    var local = locals[i]
    if (Model.isModel(local)) {
      local = local.get()
    }
    if (local.has && local.has(path[0]) || path[0] in local) {
      obj = locals[i]
      break
    }
  }

  if (obj === undefined) {
    console.warn('No locals for `' + path[0] + '` found')
    return new Reference()
  }

  var key = path.pop()
  var root, prop
  while (true) {
    if (Model.isModel(obj)) {
      var parent = obj
      obj = obj.get()

      if (!root) {
        root = obj
      }

      if (obj && typeof obj === 'object' && prop) {
        obj = Model.createCursor(obj, [prop], function(newData) {
          parent.set(newData)
        })
        continue
      }
    }

    if (!(prop = path.shift())) {
      break
    }

    if (obj && typeof obj.get === 'function') {
      obj = obj.get(prop)
    } else if (!obj || !(prop in obj)) {
      throw new Error('Path ' + this.keys.join('.') + ' not set')
    } else {
      obj = obj[prop]
    }
  }

  if (!obj) {
    console.warn('Try creating a reference for an undefined object')
  }

  return new Reference(obj, key, root || locals[i])
}

var Reference = exports.Reference = function(obj, key, root) {
  this.obj     = obj
  this.key     = key
  this.root    = root
  this.filters = []
}

Reference.prototype.get = function() {
  var result
  if (!this.key) {
    result = this.obj
  } else if (this.obj && typeof this.obj.get === 'function') {
    result = this.obj.get(this.key)
  } else {
    result = this.obj && this.obj[this.key]
  }

  for (var i = 0, len = this.filters.length; i < len; ++i) {
    var filter = this.filters[i]
    var fn     = filter.fn.get || filter.fn
    var args   = filter.args && filter.args.map(function(arg) {
      return arg instanceof Reference ? arg.get() : arg
    }) || []

    result = fn.apply(this, [result].concat(args))
  }
  return result
}

Reference.prototype.set = function(val) {
  if (!this.obj) {
    console.warn('Try setting an undefined reference')
    return undefined
  }

  for (var i = this.filters.length - 1; i >= 0; --i) {
    var filter = this.filters[i]
    if (!('set' in filter.fn)) {
      continue
    }

    var fn     = filter.fn.set
    var args   = filter.args && filter.args.map(function(arg) {
      return arg instanceof Reference ? arg.get() : args
    }) || []

    val = fn.apply(this, [val].concat(args))
  }

  if (!this.key) {
    this.obj = val
  } else {
    Model.updateProperty(this.obj, this.key, val)
  }

  return val
}

Reference.prototype.valueOf = Reference.prototype.toString = function() {
  return this.get()
}

Reference.prototype.dispose = function() {
  this.filters.forEach(function(filter) {
    if (filter.dispose) {
      filter.dispose()
    }
  })
}

exports.Filter = function(name, args) {
  this.name = name
  this.args = args
}

},{"../model":12}],17:[function(require,module,exports){
'use strict'

var parser = require('./parser').parser
exports.ast = parser.yy = require('./ast')

function parse(input) {
  var program = parser.parse(input)
  program.source = input
  return program
}

exports.parse = parse

},{"./ast":16,"./parser":18}],18:[function(require,module,exports){
(function (process){
/* parser generated by jison 0.4.15 */
/*
  Returns a Parser object of the following structure:

  Parser: {
    yy: {}
  }

  Parser.prototype: {
    yy: {},
    trace: function(),
    symbols_: {associative list: name ==> number},
    terminals_: {associative list: number ==> name},
    productions_: [...],
    performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$),
    table: [...],
    defaultActions: {...},
    parseError: function(str, hash),
    parse: function(input),

    lexer: {
        EOF: 1,
        parseError: function(str, hash),
        setInput: function(input),
        input: function(),
        unput: function(str),
        more: function(),
        less: function(n),
        pastInput: function(),
        upcomingInput: function(),
        showPosition: function(),
        test_match: function(regex_match_array, rule_index),
        next: function(),
        lex: function(),
        begin: function(condition),
        popState: function(),
        _currentRules: function(),
        topState: function(),
        pushState: function(condition),

        options: {
            ranges: boolean           (optional: true ==> token location info will include a .range[] member)
            flex: boolean             (optional: true ==> flex-like lexing behaviour where the rules are tested exhaustively to find the longest match)
            backtrack_lexer: boolean  (optional: true ==> lexer regexes are tested in order and for each matching regex the action code is invoked; the lexer terminates the scan when a token is returned by the action code)
        },

        performAction: function(yy, yy_, $avoiding_name_collisions, YY_START),
        rules: [...],
        conditions: {associative list: name ==> set},
    }
  }


  token location info (@$, _$, etc.): {
    first_line: n,
    last_line: n,
    first_column: n,
    last_column: n,
    range: [start_number, end_number]       (where the numbers are indexes into the input string, regular zero-based)
  }


  the parseError function receives a 'hash' object with these members for lexer and parser errors: {
    text:        (matched text)
    token:       (the produced terminal token, if any)
    line:        (yylineno)
  }
  while parser (grammar) errors will also provide these members, i.e. parser errors deliver a superset of attributes: {
    loc:         (yylloc)
    expected:    (string describing the set of expected tokens)
    recoverable: (boolean: TRUE when the parser has a error recovery rule available for this particular error)
  }
*/
var parser = (function(){
var o=function(k,v,o,l){for(o=o||{},l=k.length;l--;o[k[l]]=v);return o},$V0=[1,6],$V1=[1,7],$V2=[5,8,14],$V3=[1,14],$V4=[1,19],$V5=[1,20],$V6=[10,13,16,18,21,24],$V7=[13,21],$V8=[1,38],$V9=[1,39],$Va=[18,24];
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"expression":3,"body":4,"EOF":5,"parts":6,"part":7,"OPEN":8,"statement":9,"as":10,"alias":11,"filters":12,"CLOSE":13,"TEXT":14,"path":15,".":16,"identifier":17,",":18,"IDENTIFIER":19,"filter":20,"|":21,"(":22,"arguments":23,")":24,"argument":25,"string":26,"number":27,"STRING":28,"NUMBER":29,"$accept":0,"$end":1},
terminals_: {2:"error",5:"EOF",8:"OPEN",10:"as",13:"CLOSE",14:"TEXT",16:".",18:",",19:"IDENTIFIER",21:"|",22:"(",24:")",28:"STRING",29:"NUMBER"},
productions_: [0,[3,2],[3,1],[4,1],[6,2],[6,1],[7,6],[7,5],[7,4],[7,3],[7,2],[7,1],[9,1],[15,3],[15,1],[11,3],[11,1],[17,1],[12,2],[12,1],[20,5],[20,2],[23,3],[23,1],[25,1],[25,1],[25,1],[26,1],[27,1]],
performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */) {
/* this == yyval */

var $0 = $$.length - 1;
switch (yystate) {
case 1:
 return new yy.Program($$[$0-1]) 
break;
case 2:
 return new yy.Program() 
break;
case 3: case 12: case 16: case 17:
 this.$ = $$[$0] 
break;
case 4: case 18:
 $$[$0-1].push($$[$0]); this.$ = $$[$0-1] 
break;
case 5: case 14: case 19: case 23:
 this.$ = [$$[$0]] 
break;
case 6:
 this.$ = new yy.Expression(new yy.Path($$[$0-4]), $$[$0-2], $$[$0-1]) 
break;
case 7:
 this.$ = new yy.Expression(new yy.Path($$[$0-3]), $$[$0-1]) 
break;
case 8:
 this.$ = new yy.Expression(new yy.Path($$[$0-2]), undefined, $$[$0-1])
break;
case 9:
 this.$ = new yy.Expression(new yy.Path($$[$0-1])) 
break;
case 10:
 this.$ = new yy.Expression(new yy.Path([])) 
break;
case 11:
 this.$ = new yy.Text($$[$0]) 
break;
case 13: case 22:
 $$[$0-2].push($$[$0]); this.$ = $$[$0-2] 
break;
case 15:
 this.$ = [$$[$0-2], $$[$0]] 
break;
case 20:
 this.$ = new yy.Filter($$[$0-3], $$[$0-1]) 
break;
case 21:
 this.$ = new yy.Filter($$[$0]) 
break;
case 24: case 25:
 this.$ = $$[$0]
break;
case 26:
 this.$ = new yy.Path($$[$0]) 
break;
case 27:
 this.$ = $$[$0].slice(1, -1) 
break;
case 28:
 this.$ = parseFloat($$[$0], 10) 
break;
}
},
table: [{3:1,4:2,5:[1,3],6:4,7:5,8:$V0,14:$V1},{1:[3]},{5:[1,8]},{1:[2,2]},{5:[2,3],7:9,8:$V0,14:$V1},o($V2,[2,5]),{9:10,13:[1,11],15:12,17:13,19:$V3},o($V2,[2,11]),{1:[2,1]},o($V2,[2,4]),{10:[1,15],12:16,13:[1,17],20:18,21:$V4},o($V2,[2,10]),o([10,13,21],[2,12],{16:$V5}),o($V6,[2,14]),o([10,13,16,18,21,22,24],[2,17]),{11:21,17:22,19:$V3},{13:[1,23],20:24,21:$V4},o($V2,[2,9]),o($V7,[2,19]),{17:25,19:$V3},{17:26,19:$V3},{12:27,13:[1,28],20:18,21:$V4},o($V7,[2,16],{18:[1,29]}),o($V2,[2,8]),o($V7,[2,18]),o($V7,[2,21],{22:[1,30]}),o($V6,[2,13]),{13:[1,31],20:24,21:$V4},o($V2,[2,7]),{17:32,19:$V3},{15:37,17:13,19:$V3,23:33,25:34,26:35,27:36,28:$V8,29:$V9},o($V2,[2,6]),o($V7,[2,15]),{18:[1,41],24:[1,40]},o($Va,[2,23]),o($Va,[2,24]),o($Va,[2,25]),o($Va,[2,26],{16:$V5}),o($Va,[2,27]),o($Va,[2,28]),o($V7,[2,20]),{15:37,17:13,19:$V3,25:42,26:35,27:36,28:$V8,29:$V9},o($Va,[2,22])],
defaultActions: {3:[2,2],8:[2,1]},
parseError: function parseError(str, hash) {
    if (hash.recoverable) {
        this.trace(str);
    } else {
        throw new Error(str);
    }
},
parse: function parse(input) {
    var self = this, stack = [0], tstack = [], vstack = [null], lstack = [], table = this.table, yytext = '', yylineno = 0, yyleng = 0, recovering = 0, TERROR = 2, EOF = 1;
    var args = lstack.slice.call(arguments, 1);
    var lexer = Object.create(this.lexer);
    var sharedState = { yy: {} };
    for (var k in this.yy) {
        if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
            sharedState.yy[k] = this.yy[k];
        }
    }
    lexer.setInput(input, sharedState.yy);
    sharedState.yy.lexer = lexer;
    sharedState.yy.parser = this;
    if (typeof lexer.yylloc == 'undefined') {
        lexer.yylloc = {};
    }
    var yyloc = lexer.yylloc;
    lstack.push(yyloc);
    var ranges = lexer.options && lexer.options.ranges;
    if (typeof sharedState.yy.parseError === 'function') {
        this.parseError = sharedState.yy.parseError;
    } else {
        this.parseError = Object.getPrototypeOf(this).parseError;
    }
    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }
    _token_stack:
        function lex() {
            var token;
            token = lexer.lex() || EOF;
            if (typeof token !== 'number') {
                token = self.symbols_[token] || token;
            }
            return token;
        }
    var symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected;
    while (true) {
        state = stack[stack.length - 1];
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol === null || typeof symbol == 'undefined') {
                symbol = lex();
            }
            action = table[state] && table[state][symbol];
        }
                    if (typeof action === 'undefined' || !action.length || !action[0]) {
                var errStr = '';
                expected = [];
                for (p in table[state]) {
                    if (this.terminals_[p] && p > TERROR) {
                        expected.push('\'' + this.terminals_[p] + '\'');
                    }
                }
                if (lexer.showPosition) {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ':\n' + lexer.showPosition() + '\nExpecting ' + expected.join(', ') + ', got \'' + (this.terminals_[symbol] || symbol) + '\'';
                } else {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ': Unexpected ' + (symbol == EOF ? 'end of input' : '\'' + (this.terminals_[symbol] || symbol) + '\'');
                }
                this.parseError(errStr, {
                    text: lexer.match,
                    token: this.terminals_[symbol] || symbol,
                    line: lexer.yylineno,
                    loc: yyloc,
                    expected: expected
                });
            }
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol);
        }
        switch (action[0]) {
        case 1:
            stack.push(symbol);
            vstack.push(lexer.yytext);
            lstack.push(lexer.yylloc);
            stack.push(action[1]);
            symbol = null;
            if (!preErrorSymbol) {
                yyleng = lexer.yyleng;
                yytext = lexer.yytext;
                yylineno = lexer.yylineno;
                yyloc = lexer.yylloc;
                if (recovering > 0) {
                    recovering--;
                }
            } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
            }
            break;
        case 2:
            len = this.productions_[action[1]][1];
            yyval.$ = vstack[vstack.length - len];
            yyval._$ = {
                first_line: lstack[lstack.length - (len || 1)].first_line,
                last_line: lstack[lstack.length - 1].last_line,
                first_column: lstack[lstack.length - (len || 1)].first_column,
                last_column: lstack[lstack.length - 1].last_column
            };
            if (ranges) {
                yyval._$.range = [
                    lstack[lstack.length - (len || 1)].range[0],
                    lstack[lstack.length - 1].range[1]
                ];
            }
            r = this.performAction.apply(yyval, [
                yytext,
                yyleng,
                yylineno,
                sharedState.yy,
                action[1],
                vstack,
                lstack
            ].concat(args));
            if (typeof r !== 'undefined') {
                return r;
            }
            if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
                lstack = lstack.slice(0, -1 * len);
            }
            stack.push(this.productions_[action[1]][0]);
            vstack.push(yyval.$);
            lstack.push(yyval._$);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
        case 3:
            return true;
        }
    }
    return true;
}};
/* generated by jison-lex 0.3.4 */
var lexer = (function(){
var lexer = ({

EOF:1,

parseError:function parseError(str, hash) {
        if (this.yy.parser) {
            this.yy.parser.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },

// resets the lexer, sets new input
setInput:function (input, yy) {
        this.yy = yy || this.yy || {};
        this._input = input;
        this._more = this._backtrack = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {
            first_line: 1,
            first_column: 0,
            last_line: 1,
            last_column: 0
        };
        if (this.options.ranges) {
            this.yylloc.range = [0,0];
        }
        this.offset = 0;
        return this;
    },

// consumes and returns one char from the input
input:function () {
        var ch = this._input[0];
        this.yytext += ch;
        this.yyleng++;
        this.offset++;
        this.match += ch;
        this.matched += ch;
        var lines = ch.match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
        } else {
            this.yylloc.last_column++;
        }
        if (this.options.ranges) {
            this.yylloc.range[1]++;
        }

        this._input = this._input.slice(1);
        return ch;
    },

// unshifts one char (or a string) into the input
unput:function (ch) {
        var len = ch.length;
        var lines = ch.split(/(?:\r\n?|\n)/g);

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length - len);
        //this.yyleng -= len;
        this.offset -= len;
        var oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length - 1);
        this.matched = this.matched.substr(0, this.matched.length - 1);

        if (lines.length - 1) {
            this.yylineno -= lines.length - 1;
        }
        var r = this.yylloc.range;

        this.yylloc = {
            first_line: this.yylloc.first_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.first_column,
            last_column: lines ?
                (lines.length === oldLines.length ? this.yylloc.first_column : 0)
                 + oldLines[oldLines.length - lines.length].length - lines[0].length :
              this.yylloc.first_column - len
        };

        if (this.options.ranges) {
            this.yylloc.range = [r[0], r[0] + this.yyleng - len];
        }
        this.yyleng = this.yytext.length;
        return this;
    },

// When called from action, caches matched text and appends it on next action
more:function () {
        this._more = true;
        return this;
    },

// When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
reject:function () {
        if (this.options.backtrack_lexer) {
            this._backtrack = true;
        } else {
            return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n' + this.showPosition(), {
                text: "",
                token: null,
                line: this.yylineno
            });

        }
        return this;
    },

// retain first n characters of the match
less:function (n) {
        this.unput(this.match.slice(n));
    },

// displays already matched input, i.e. for error messages
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },

// displays upcoming input, i.e. for error messages
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20) + (next.length > 20 ? '...' : '')).replace(/\n/g, "");
    },

// displays the character position where the lexing error occurred, i.e. for error messages
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c + "^";
    },

// test the lexed token: return FALSE when not a match, otherwise return token
test_match:function (match, indexed_rule) {
        var token,
            lines,
            backup;

        if (this.options.backtrack_lexer) {
            // save context
            backup = {
                yylineno: this.yylineno,
                yylloc: {
                    first_line: this.yylloc.first_line,
                    last_line: this.last_line,
                    first_column: this.yylloc.first_column,
                    last_column: this.yylloc.last_column
                },
                yytext: this.yytext,
                match: this.match,
                matches: this.matches,
                matched: this.matched,
                yyleng: this.yyleng,
                offset: this.offset,
                _more: this._more,
                _input: this._input,
                yy: this.yy,
                conditionStack: this.conditionStack.slice(0),
                done: this.done
            };
            if (this.options.ranges) {
                backup.yylloc.range = this.yylloc.range.slice(0);
            }
        }

        lines = match[0].match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno += lines.length;
        }
        this.yylloc = {
            first_line: this.yylloc.last_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.last_column,
            last_column: lines ?
                         lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
                         this.yylloc.last_column + match[0].length
        };
        this.yytext += match[0];
        this.match += match[0];
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
            this.yylloc.range = [this.offset, this.offset += this.yyleng];
        }
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match[0].length);
        this.matched += match[0];
        token = this.performAction.call(this, this.yy, this, indexed_rule, this.conditionStack[this.conditionStack.length - 1]);
        if (this.done && this._input) {
            this.done = false;
        }
        if (token) {
            return token;
        } else if (this._backtrack) {
            // recover context
            for (var k in backup) {
                this[k] = backup[k];
            }
            return false; // rule action called reject() implying the next rule should be tested instead.
        }
        return false;
    },

// return next match in input
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) {
            this.done = true;
        }

        var token,
            match,
            tempMatch,
            index;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i = 0; i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (this.options.backtrack_lexer) {
                    token = this.test_match(tempMatch, rules[i]);
                    if (token !== false) {
                        return token;
                    } else if (this._backtrack) {
                        match = false;
                        continue; // rule action called reject() implying a rule MISmatch.
                    } else {
                        // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
                        return false;
                    }
                } else if (!this.options.flex) {
                    break;
                }
            }
        }
        if (match) {
            token = this.test_match(match, rules[index]);
            if (token !== false) {
                return token;
            }
            // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
            return false;
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. Unrecognized text.\n' + this.showPosition(), {
                text: "",
                token: null,
                line: this.yylineno
            });
        }
    },

// return next match that has a token
lex:function lex() {
        var r = this.next();
        if (r) {
            return r;
        } else {
            return this.lex();
        }
    },

// activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },

// pop the previously active lexer condition state off the condition stack
popState:function popState() {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
        }
    },

// produce the lexer rule set which is active for the currently active lexer condition state
_currentRules:function _currentRules() {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
            return this.conditions["INITIAL"].rules;
        }
    },

// return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
topState:function topState(n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
            return this.conditionStack[n];
        } else {
            return "INITIAL";
        }
    },

// alias for begin(condition)
pushState:function pushState(condition) {
        this.begin(condition);
    },

// return the number of states currently on the stack
stateStackSize:function stateStackSize() {
        return this.conditionStack.length;
    },
options: {},
performAction: function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {
var YYSTATE=YY_START;
switch($avoiding_name_collisions) {
case 0: this.begin('epoxy')
                          if (yy_.yytext) return 14 
break;
case 1: return 14; 
break;
case 2:/* skip whitespace */
break;
case 3: return 10 
break;
case 4: return 19 
break;
case 5: return 8 
break;
case 6: this.begin('INITIAL')
                          return 13 
break;
case 7: return 16 
break;
case 8: return 18 
break;
case 9: return 21 
break;
case 10: return 22 
break;
case 11: return 24 
break;
case 12: return 28 
break;
case 13: return 29 
break;
case 14: return 5 
break;
}
},
rules: [/^(?:[^\x00]*?(?=(\{\{)))/,/^(?:[^\x00]+)/,/^(?:\s+)/,/^(?:as\b)/,/^(?:(?!\d)[^\{\}\.\,\s\|\\'\(\)]+)/,/^(?:\{\{)/,/^(?:\}\})/,/^(?:\.)/,/^(?:,)/,/^(?:\|)/,/^(?:\()/,/^(?:\))/,/^(?:'[^\']*')/,/^(?:\d+)/,/^(?:$)/],
conditions: {"epoxy":{"rules":[2,3,4,5,6,7,8,9,10,11,12,13,14],"inclusive":false},"INITIAL":{"rules":[0,1,14],"inclusive":true}}
});
return lexer;
})();
parser.lexer = lexer;
function Parser () {
  this.yy = {};
}
Parser.prototype = parser;parser.Parser = Parser;
return new Parser;
})();


if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
exports.parser = parser;
exports.Parser = parser.Parser;
exports.parse = function () { return parser.parse.apply(parser, arguments); };
exports.main = function commonjsMain(args) {
    if (!args[1]) {
        console.log('Usage: '+args[0]+' FILE');
        process.exit(1);
    }
    var source = require('fs').readFileSync(require('path').normalize(args[1]), "utf8");
    return exports.parser.parse(source);
};
if (typeof module !== 'undefined' && require.main === module) {
  exports.main(process.argv.slice(1));
}
}
}).call(this,require('_process'))
},{"_process":21,"fs":20,"path":22}],19:[function(require,module,exports){
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

},{}],20:[function(require,module,exports){

},{}],21:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],22:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":21}]},{},[7])(7)
});