var parser = require('./parser')
exports.parse = parser.parse
exports.ast   = parser.ast

exports.registerFilter = require('./filter').registerFilter

exports.bind = require('./bind')

var Model = require('./model')
exports.model = function(getFn, setFn) {
  return new Model(getFn, setFn)
}
