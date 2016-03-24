# ipoxy

Declarative template data binding.

[![NPM][npm]](https://npmjs.org/package/ipoxy)
[![Build Status][drone]](https://ci.rkusa.st/rkusa/ipoxy)

Features:

- Immutable data
- [Incremental DOM](https://github.com/google/incremental-dom)

## Usage

```js
    ipoxy.bind(target, data)
```

## Syntax

#### Variables

Can be used inside text:
```html
    <input type="text" value="{{ todo.task }}" />
    Your task: {{ todo.task }}
```

#### Repeat

```html
    <ul>
      <template repeat="{{ todos }}">
        <li>{{ task }}</li>
      </template>
    </ul>
```

#### If

```html
  <template if="{{ todos.length }}">
    You have {{ todos.length }} todos left.
  </template>
```

You can also combine `if` and `repeat`.

#### Unless

```html
  <template unless="{{ todos.length }}">
    Well done, you have no todos left!
  </template>
```

You can also combine `unless` and `repeat`.

## Inputs

```html
    <input type="checkbox" checked="{{ todo.isDone }}" />

    <select value="{{ isDone }}">
      <option value="true">true</option>
      <option value="false">false</option>
    </select>

    <input type="radio" name="isDone" value="true" checked="{{ isDone }}" /> True
    <input type="radio" name="isDone" value="false" checked="{{ isDone }}" /> False

    <input type="text" value="{{ todo.task }}" />

    <textarea>{{ todo.task }}</textarea>
```

## Filters

`{{ expression | filterName }}`

## `html`

Do not encode html entities.

## `class`

```html
  <span class="{{ item.selected | class('active') }}"></span>
```

### Create Custom Filter

```js
// getter only
epoxy.registerFilter('uppercase', function(value) {
  return value.length
})

// getter and setter
epoxy.registerFilter('uppercase', {
  get: function(value) {
    return value
  },
  set: function(value) {
    return value.toUpperCase()
  }
})
```

## MIT License

[MIT](LICENSE)

[npm]: http://img.shields.io/npm/v/ipoxy.svg?style=flat-square
[drone]: http://ci.rkusa.st/api/badges/rkusa/ipoxy/status.svg?style=flat-square