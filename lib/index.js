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
