/*global expect, ipoxy*/

'use strict'

describe('expression parser', function() {
  it('should parse identifiers', function() {
    var expr = '{{ foobar }}'
    var ast  = ipoxy.parse(expr)
    expect(ast.body).to.have.lengthOf(1)
    expect(ast.body[0]).to.be.an.instanceOf(ipoxy.ast.Expression)
    expect(ast.body[0].path).to.be.an.instanceOf(ipoxy.ast.Path)
    expect(ast.body[0].path.keys).to.eql(['foobar'])
  })

  it('should parse paths', function() {
    var expr = '{{ foo.bar }}'
    var ast  = ipoxy.parse(expr)
    expect(ast.body).to.have.lengthOf(1)
    expect(ast.body[0].path).to.be.an.instanceOf(ipoxy.ast.Path)
    expect(ast.body[0].path.keys).to.eql(['foo', 'bar'])
  })

  it('should find expression inside text', function() {
    var expr = 'some {{ foo.bar }} content'
    var ast  = ipoxy.parse(expr)
    expect(ast.body).to.have.lengthOf(3)

    expect(ast.body[0]).to.be.an.instanceOf(ipoxy.ast.Text)
    expect(ast.body[0].text).to.equal('some ')

    expect(ast.body[1].path).to.be.an.instanceOf(ipoxy.ast.Path)
    expect(ast.body[1].path.keys).to.eql(['foo', 'bar'])

    expect(ast.body[2]).to.be.an.instanceOf(ipoxy.ast.Text)
    expect(ast.body[2].text).to.equal(' content')
  })

  it('should parse aliases', function() {
    var expr = '{{ foo as bar }}'
    var ast  = ipoxy.parse(expr)
    expect(ast.body).to.have.lengthOf(1)
    expect(ast.body[0].path.keys).to.eql(['foo'])
    expect(ast.body[0].alias).to.equal('bar')
  })

  it('should parse filter', function() {
    var expr = '{{ foo | bar }}'
    var ast  = ipoxy.parse(expr)
    expect(ast.body).to.have.lengthOf(1)
    expect(ast.body[0].path.keys).to.eql(['foo'])
    expect(ast.body[0].filters).to.eql([{ name: 'bar', args: undefined }])
  })
})

describe('template', function() {
  var model
  function resetModel() {
    model = ipoxy.fromJS({
      name: 'rkusa',
      isVisible: true,
      color: 'red',
      tasks: [
        { id: 1, isDone: true, task: 'this' },
        { id: 2, isDone: false, task: 'that' }
      ]
    })
  }
  resetModel()
  afterEach(resetModel)

  describe('expressions', function() {
    it('should find and update expression inside a text node',
      compile('text', model))

    it('should find expression inside an attribute node',
      compile('attribute', model.get('tasks').get(0)))
  })

  describe('boolean attributes', function() {
    it('should be true accordingly', function() {
      var result = compile('boolattr', model.get('tasks').get(0))()
      var checkbox = result.querySelector('input')
      expect(checkbox.checked).to.be.true
    })

    it('should be false accordingly', function() {
      var result = compile('boolattr', model.get('tasks').get(1))()
      var checkbox = result.querySelector('input')
      expect(checkbox.checked).to.be.false
    })
  })

  describe('if helper', function() {
    it('should be rendered if evaluated to true',
      compile('iftrue', model.get('tasks').get(0)))

    it('should not be rendered if evaluated to false',
      compile('iffalse', model.get('tasks').get(1)))
  })

  describe('repeat helper', function() {
    it('should work without alias', compile('repeat', model))

    it('should work with alias', compile('repeatalias', model))
  })

  describe('repeat and if helper combined', function() {
    it('should be rendered if evaluated to true', function() {
      model = model.set('isVisible', true)
      compile('repeattrue', model)()
    })

    it('should not be rendered if evaluated to false', function() {
      model = model.set('isVisible', false)
      compile('repeatfalse', model)()
    })
  })

  describe('two-way data binding', function() {
    it('should work for attributes', function(done) {
      var fragment = bind('binding-attribute', ipoxy.model({
        get: function() { return model }
      }))

      var span = fragment.querySelector('span')
      expect(span.getAttribute('style')).to.equal('color: red')

      model = model.set('color', 'blue')
      setTimeout(function() {
        alert(span.getAttribute('style'))
        expect(span.getAttribute('style')).to.equal('color: blue')
        done()
      }, 1000)
    })

    it('should work for boolean attributes (int)', function(done) {
      var task     = model.get('tasks').get(0)
      var fragment = bind('binding-boolean-attribute', ipoxy.model({
        get: function() {
          return task
        }
      }))

      var checkbox = fragment.querySelector('input')
      expect(checkbox.checked).to.be.true

      task = task.set('isDone', false)
      setTimeout(function() {
        expect(checkbox.checked).to.be.false
        done()
      })
    })

    it('should work for boolean attributes (out)', function(done) {
      var task     = model.get('tasks').get(0)
      var fragment = bind('binding-boolean-attribute', task)
      var checkbox = fragment.querySelector('input')
      expect(checkbox.checked).to.be.true

      checkbox.checked = false
      var changeEvent = document.createEvent('HTMLEvents')
      changeEvent.initEvent('change', false, true)
      checkbox.dispatchEvent(changeEvent)

      setTimeout(function() {
        expect(task.isDone).to.be.false
        done()
      })
    })

    it('should work for input values (in)', function(done) {
      var task     = model.get('tasks').get(0)
      var fragment = bind('binding-input-value', task)
      var input    = fragment.querySelector('input')
      expect(input.value).to.equal('this')

      task.task = 'something'
      setTimeout(function() {
        expect(input.value).to.equal('something')
        done()
      })
    })

    it('should work for input values (out)', function(done) {
      var task     = model.get('tasks').get(0)
      var fragment = bind('binding-input-value', task)
      var input    = fragment.querySelector('input')
      expect(input.value).to.equal('this')

      input.value = 'something'
      var changeEvent = document.createEvent('HTMLEvents')
      changeEvent.initEvent('change', false, true)
      input.dispatchEvent(changeEvent)

      setTimeout(function() {
        expect(task.task).to.equal('something')
        done()
      })
    })
  })
})

function compile(name, model) {
  return function() {
    var template    = document.querySelector('#' + name + '-template')
    var expectation = document.querySelector('#' + name + '-expectation')

    var div = document.createElement('div')
    ipoxy.bind(div, template, model)

    expectation = expectation.innerHTML.replace(/\n\s*/g, '')
    var result = div.innerHTML.replace(/\n\s*/g, '')

    expect(result).to.equal(expectation)

    return div
  }
}

function bind(name, model) {
  var template  = document.querySelector('#' + name + '-template')
  var container = document.createElement('div')
  ipoxy.bind(container, template, model)

  return container
}
