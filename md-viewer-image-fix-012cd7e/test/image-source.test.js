const test = require('node:test')
const assert = require('node:assert/strict')
const { resolveImageSource } = require('../image-source')

test('resolves a relative POSIX image next to its Markdown file', () => {
  assert.equal(
    resolveImageSource('images/screenshot.png', '/home/alice/notes/readme.md'),
    'file:///home/alice/notes/images/screenshot.png'
  )
})

test('resolves parent segments and safely encodes local filenames', () => {
  assert.equal(
    resolveImageSource('../assets/my%20diagram%20%E2%9C%93.png', '/home/alice/notes/pages/readme.md'),
    'file:///home/alice/notes/assets/my%20diagram%20%E2%9C%93.png'
  )
})

test('preserves a local image query and fragment', () => {
  assert.equal(
    resolveImageSource('./diagram.png?raw=1#preview', '/home/alice/notes/readme.md'),
    'file:///home/alice/notes/diagram.png?raw=1#preview'
  )
})

test('supports Windows relative and absolute paths', () => {
  const markdownPath = 'C:\\Users\\Ali\\Notes\\readme.md'
  assert.equal(
    resolveImageSource('assets\\diagram 1.png', markdownPath),
    'file:///C:/Users/Ali/Notes/assets/diagram%201.png'
  )
  assert.equal(
    resolveImageSource('D:\\Pictures\\cover%20%231.png', markdownPath),
    'file:///D:/Pictures/cover%20%231.png'
  )
  assert.equal(
    resolveImageSource('/Pictures/cover.png', markdownPath),
    'file:///C:/Pictures/cover.png'
  )
})

test('supports Windows UNC paths', () => {
  assert.equal(
    resolveImageSource('\\\\fileserver\\shared images\\cover.png', 'C:\\Notes\\readme.md'),
    'file://fileserver/shared%20images/cover.png'
  )
})

test('leaves already absolute URLs unchanged', () => {
  const sources = [
    'https://example.com/image.png',
    'http://example.com/image.png',
    'file:///home/alice/image.png',
    'data:image/png;base64,AAAA',
    'blob:https://example.com/1234'
  ]

  for (const source of sources) {
    assert.equal(resolveImageSource(source, '/home/alice/readme.md'), source)
  }
})

test('uses HTTPS for protocol-relative web images on a file page', () => {
  assert.equal(
    resolveImageSource('//cdn.example.com/image.png', '/home/alice/readme.md'),
    'https://cdn.example.com/image.png'
  )
})

test('does not invent a filesystem base for virtual drag-and-drop files', () => {
  assert.equal(resolveImageSource('images/pic.png', '__v1__readme.md'), 'images/pic.png')
})
