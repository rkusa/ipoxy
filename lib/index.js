'use strict'

var parser = require('./parser')
exports.parse = parser.parse
exports.ast   = parser.ast

exports.registerFilter = require('./filter').registerFilter

exports.bind = require('./bind')
exports.importNode = require('./import-node').importNode
exports.cloneNode = require('./import-node').cloneNode

var Model = require('./model')
exports.model = function(fns) {
  return new Model(fns)
}
exports.alias = Model.alias

var immutable = require('immutable')
exports.fromJS = immutable.fromJS
exports.Stack = immutable.Stack
