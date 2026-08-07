const { contextBridge, ipcRenderer } = require('electron')
const { marked, Renderer } = require('marked')
const hljs = require('highlight.js')

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function parseMarkdown(content) {
  const renderer = new Renderer()
  const headings = []
  renderer.heading = ({ text, depth }) => {
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    headings.push({ id, text, depth })
    return `<h${depth} id="${id}">${text}</h${depth}>`
  }
  renderer.code = ({ text, lang }) => {
    const langClass = lang ? ` class="lang-${lang}"` : ''
    const langLabel = lang ? `<span class="code-lang">${lang}</span>` : ''
    let highlighted = escapeHtml(text)
    if (lang && hljs.getLanguage(lang)) {
      try {
        highlighted = hljs.highlight(text, { language: lang, ignoreIllegals: true }).value
      } catch (_) {}
    }
    return `<div class="code-block-wrapper"><div class="code-header">${langLabel}<button class="copy-btn" onclick="copyCode(this)">Copy</button></div><pre${langClass}><code class="hljs">${highlighted}</code></pre></div>`
  }
  marked.setOptions({ renderer, breaks: true, gfm: true })
  return { html: marked.parse(content), headings }
}

contextBridge.exposeInMainWorld('electronAPI', {
  onFileOpened: (callback) => ipcRenderer.on('file-opened', (_event, data) => callback(data)),
  onFolderOpened: (callback) => ipcRenderer.on('folder-opened', (_event, data) => callback(data)),
  onFileChanged: (callback) => ipcRenderer.on('file-changed', (_event, data) => callback(data)),
  onPrint: (callback) => ipcRenderer.on('print', () => callback()),
  onWindowStateChanged: (callback) => ipcRenderer.on('window-state-changed', (_event, isMaximized) => callback(isMaximized)),
  onShowWelcome: (callback) => ipcRenderer.on('show-welcome', () => callback()),
  getFileContent: (filePath) => ipcRenderer.invoke('get-file-content', filePath),
  openPath: (filePath) => ipcRenderer.send('open-path', filePath),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content),
  print: () => ipcRenderer.invoke('print-pdf'),
  getTreeData: (dirPath) => ipcRenderer.invoke('get-tree-data', dirPath),
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  parseMarkdown,
})
