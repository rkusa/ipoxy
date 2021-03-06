'use strict'

var gulp = require('gulp')

gulp.task('default', ['watch'])

gulp.task('watch', ['browserify', 'jison'], function() {
  gulp.watch(['lib/parser/*.jison'], ['jison'])
  gulp.watch(['lib/**/*.js'], ['browserify'])
})

gulp.task('test', ['testem'], function() {
  setImmediate(function() {
    process.exit(0)
  })
})

var Testem = require('testem')
gulp.task('testem', ['browserify'], function (done) {
  var t = new Testem()
  t.startCI({
    'test_page': 'test/runner.html',
    launch:      'Chrome'
  }, done)
})

var browserify = require('browserify')
var source     = require('vinyl-source-stream')
gulp.task('browserify', function() {
  return browserify({ debug: true, entries: './lib/index.js', standalone: 'ipoxy' })
    .bundle()
    .pipe(source('ipoxy.js'))
    .pipe(gulp.dest('./dist'))
})

var spawn = require('child_process').spawn
gulp.task('jison', function(done) {
  var jison = spawn(
    '../../node_modules/.bin/jison',
    ['parser.jison', '-m commonjs'],
    {
      cwd:   './lib/parser',
      stdio: 'inherit'
    }
  )

  jison.on('close', done)
})
