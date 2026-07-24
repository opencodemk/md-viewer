let currentHeadings = []
let currentFilePath = ''
let currentFileName = ''
let currentContent = ''
let dragCounter = 0
let folders = []
let folderIdCounter = 0
let selectedFolderId = null
let isEditing = false
function setTabUnsaved(unsaved) {
  const tab = tabs.find(t => t.id === activeTabId)
  if (tab) tab.unsaved = unsaved
}

// Tabs
let tabs = []
let activeTabId = null
let tabIdCounter = 0

// Find
let findMatches = []
let findCurrentIndex = -1

// Watched file
let watchedFilePath = ''

const folderDropdown = document.getElementById('folder-dropdown')
const folderCloseBtn = document.getElementById('folder-close-btn')
const themeBtn = document.getElementById('theme-btn')

const savedTheme = localStorage.getItem('mdv-theme') || 'light'
document.body.setAttribute('data-theme', savedTheme === 'light' ? 'light' : '')
themeBtn.textContent = savedTheme === 'light' ? '☀️' : '🌙'
themeBtn.addEventListener('click', () => {
  const isLight = document.body.getAttribute('data-theme') === 'light'
  if (isLight) {
    document.body.removeAttribute('data-theme')
    localStorage.setItem('mdv-theme', 'dark')
    themeBtn.textContent = '🌙'
  } else {
    document.body.setAttribute('data-theme', 'light')
    localStorage.setItem('mdv-theme', 'light')
    themeBtn.textContent = '☀️'
  }
})

// Font Size
const savedFontSize = localStorage.getItem('mdv-font-size') || '15'
document.getElementById('content').style.fontSize = savedFontSize + 'px'
document.getElementById('font-dec').addEventListener('click', () => changeFontSize(-1))
document.getElementById('font-inc').addEventListener('click', () => changeFontSize(1))
document.getElementById('font-reset').addEventListener('click', () => changeFontSize(0))

function changeFontSize(delta) {
  let cur = parseInt(localStorage.getItem('mdv-font-size') || '15')
  if (delta === 0) cur = 15
  else cur = Math.max(12, Math.min(24, cur + delta))
  localStorage.setItem('mdv-font-size', cur)
  document.getElementById('content').style.fontSize = cur + 'px'
  document.getElementById('editor-textarea').style.fontSize = (cur - 1) + 'px'
}

// Reading Progress
const contentEl = document.getElementById('content')
const progressBar = document.getElementById('reading-progress')
contentEl.addEventListener('scroll', () => {
  const pct = contentEl.scrollTop / (contentEl.scrollHeight - contentEl.clientHeight)
  progressBar.style.width = Math.min(100, Math.max(0, pct * 100)) + '%'
})

// Recent files (internal, not shown in UI)
let recentFiles = JSON.parse(localStorage.getItem('mdv-recent') || '[]')
function addRecentFile(path, name) {
  recentFiles = recentFiles.filter(f => f.path !== path)
  recentFiles.unshift({ path, name, time: Date.now() })
  if (recentFiles.length > 20) recentFiles = recentFiles.slice(0, 20)
  localStorage.setItem('mdv-recent', JSON.stringify(recentFiles))
}

// App version
window.electronAPI.getVersion().then(v => {
  document.getElementById('status-version').textContent = 'v' + v
})

// Find in Page
const findBar = document.getElementById('find-bar')
const findInput = document.getElementById('find-input')
const findCount = document.getElementById('find-count')
const findPrev = document.getElementById('find-prev')
const findNext = document.getElementById('find-next')
const findClose = document.getElementById('find-close')

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault()
    findBar.classList.toggle('hidden')
    if (!findBar.classList.contains('hidden')) {
      findInput.focus()
      findInput.select()
      if (findInput.value) doFind()
    } else {
      clearFindHighlights()
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
    e.preventDefault()
    window.electronAPI.print()
  }
  if (e.key === 'Escape') {
    if (!findBar.classList.contains('hidden')) {
      findBar.classList.add('hidden')
      clearFindHighlights()
    }
    const lb = document.getElementById('lightbox')
    if (!lb.classList.contains('hidden')) {
      lb.classList.add('hidden')
    }
  }
})

findInput.addEventListener('input', doFind)
findPrev.addEventListener('click', () => findNavigate(-1))
findNext.addEventListener('click', () => findNavigate(1))
findClose.addEventListener('click', () => {
  findBar.classList.add('hidden')
  clearFindHighlights()
})

function doFind() {
  clearFindHighlights()
  const q = findInput.value.trim()
  if (!q) { findCount.textContent = ''; findMatches = []; return }
  const body = document.getElementById('content')
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
  const ranges = []
  while (walker.nextNode()) {
    const node = walker.currentNode
    const text = node.textContent
    let idx = 0
    while ((idx = text.toLowerCase().indexOf(q.toLowerCase(), idx)) !== -1) {
      const range = document.createRange()
      range.setStart(node, idx)
      range.setEnd(node, idx + q.length)
      ranges.push(range)
      idx += q.length
    }
  }
  findMatches = ranges
  findCurrentIndex = ranges.length > 0 ? 0 : -1
  findCount.textContent = ranges.length > 0 ? `1/${ranges.length}` : '0 matches'
  
  ranges.forEach((r, i) => {
    try {
      const mark = document.createElement('mark')
      mark.className = 'find-highlight' + (i === findCurrentIndex ? ' active' : '')
      r.surroundContents(mark)
    } catch (_) {}
  })
  if (findCurrentIndex >= 0) scrollToMatch(findCurrentIndex)
}

function clearFindHighlights() {
  const body = document.getElementById('content')
  body.querySelectorAll('mark.find-highlight').forEach(m => {
    const parent = m.parentNode
    parent.replaceChild(document.createTextNode(m.textContent), m)
    parent.normalize()
  })
  findMatches = []
  findCurrentIndex = -1
}

function findNavigate(dir) {
  if (findMatches.length === 0) return
  document.querySelectorAll('mark.find-highlight').forEach(m => m.classList.remove('active'))
  findCurrentIndex = (findCurrentIndex + dir + findMatches.length) % findMatches.length
  findCount.textContent = `${findCurrentIndex + 1}/${findMatches.length}`
  const active = document.querySelectorAll('mark.find-highlight')[findCurrentIndex]
  if (active) active.classList.add('active')
  scrollToMatch(findCurrentIndex)
}

function scrollToMatch(idx) {
  const marks = document.querySelectorAll('mark.find-highlight')
  if (marks[idx]) marks[idx].scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// Tab bar
const tabBar = document.getElementById('tab-bar')

function renderTabs() {
  const perTabPx = tabBar.clientWidth / Math.max(tabs.length, 1)
  const overhead = 30 // padding + close button
  const maxChars = Math.max(3, Math.floor((perTabPx - overhead) / 7))
  tabBar.innerHTML = tabs.map(t => {
    const label = t.name.length > maxChars ? t.name.slice(0, Math.max(maxChars - 1, 1)) + '\u2026' : t.name
    return `<div class="tab-item${t.id === activeTabId ? ' active' : ''}" data-tab-id="${t.id}" title="${escapeHtml(t.name)}">
      <span class="tab-label">${escapeHtml(label)}</span>
      <span class="tab-close" data-tab-id="${t.id}">&times;</span>
    </div>`
  }).join('')
  tabBar.querySelectorAll('.tab-item').forEach(el => {
    el.addEventListener('click', async (e) => {
      if (e.target.classList.contains('tab-close')) {
        closeTab(parseInt(e.target.dataset.tabId))
        return
      }
      const id = parseInt(el.dataset.tabId)
      if (id === activeTabId) return
      const tab = tabs.find(t => t.id === id)
      if (!tab) return
      activeTabId = id
      renderTabs()
      try {
        if (tab.path.startsWith('__v')) {
          for (const folder of folders) {
            const file = folder.files.find(f => f.path === tab.path)
            if (file) { await openFile(tab.path, file.content, tab.name); break }
          }
        } else {
          await openFile(tab.path, null, tab.name)
        }
      } catch (err) {
        console.error('Tab switch error:', err)
      }
    })
  })
}

function addTab(path, name) {
  const existing = tabs.find(t => t.path === path)
  if (existing) { switchTab(existing.id); return }
  const id = ++tabIdCounter
  tabs.push({ id, path, name, unsaved: false })
  activeTabId = id
  showToast('addTab: ' + name)
  renderTabs()
}

function switchTab(id) {
  if (id === activeTabId) return
  activeTabId = id
  renderTabs()
}

async function closeTab(id) {
  const tab = tabs.find(t => t.id === id)
  if (tab && tab.unsaved) {
    const msg = `"${tab.name}" has unsaved changes. Save before closing?`
    if (confirm(msg)) {
      if (id === activeTabId) {
        await saveEditor()
      } else {
        // Switch to the tab, save, then close
        activeTabId = id
        renderTabs()
        if (tab.path.startsWith('__v')) {
          const folder = folders.find(f => f.files.some(ff => ff.path === tab.path))
          const file = folder?.files.find(ff => ff.path === tab.path)
          if (file) await openFile(tab.path, file.content, tab.name)
        } else {
          await openFile(tab.path, null, tab.name)
        }
        await saveEditor()
      }
    } else {
      tab.unsaved = false
    }
  }
  const idx = tabs.findIndex(t => t.id === id)
  if (idx === -1) return
  tabs.splice(idx, 1)
  if (tabs.length === 0) {
    activeTabId = null
    showPlaceholder()
  } else if (id === activeTabId) {
    const newIdx = Math.min(idx, tabs.length - 1)
    activeTabId = tabs[newIdx].id
    renderTabs()
    await loadTabContent(tabs[newIdx])
  } else {
    renderTabs()
  }
}

async function loadTabContent(tab) {
  if (tab.path.startsWith('__v')) {
    for (const folder of folders) {
      const file = folder.files.find(f => f.path === tab.path)
      if (file) { await openFile(tab.path, file.content, tab.name); break }
    }
  } else {
    await openFile(tab.path, null, tab.name)
  }
}

function showPlaceholder() {
  document.getElementById('content').innerHTML = ''
  document.getElementById('placeholder').style.display = ''
  document.getElementById('file-info').innerHTML = ''
  document.getElementById('toc').innerHTML = ''
  document.getElementById('status-info').textContent = 'Ready'
  document.getElementById('status-stats').textContent = ''
  progressBar.style.width = '0'
}

// Print
window.electronAPI.onPrint(() => {
  window.electronAPI.print()
})

// Auto-reload
window.electronAPI.onFileChanged(({ content, filePath, lines, words }) => {
  if (filePath === currentFilePath) {
    currentContent = content
    if (!isEditing) { renderMarkdown(content, currentFileName, filePath) }
    updateStatusBar(currentFileName, lines, words)
    showToast('File updated')
  }
})
const sidebar = document.getElementById('sidebar')
const resizeHandle = document.getElementById('sidebar-resize-handle')
let isResizing = false

const savedSidebarWidth = localStorage.getItem('mdv-sidebar-width')
if (savedSidebarWidth) sidebar.style.width = savedSidebarWidth + 'px'

resizeHandle.addEventListener('mousedown', (e) => {
  isResizing = true
  document.body.style.cursor = 'col-resize'
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  e.preventDefault()
})

function onMouseMove(e) {
  if (!isResizing) return
  let w = e.clientX
  w = Math.max(180, Math.min(500, w))
  sidebar.style.width = w + 'px'
}

function onMouseUp() {
  isResizing = false
  document.body.style.cursor = ''
  localStorage.setItem('mdv-sidebar-width', parseInt(sidebar.style.width))
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

// File Search
const fileSearch = document.getElementById('file-search')
fileSearch.addEventListener('input', () => {
  const q = fileSearch.value.trim().toLowerCase()
  document.querySelectorAll('.file-list-item').forEach(el => {
    const label = el.querySelector('.file-label')?.textContent?.toLowerCase() || ''
    if (!q || label.includes(q)) {
      el.classList.remove('search-hide')
      el.classList.add('search-match')
    } else {
      el.classList.add('search-hide')
      el.classList.remove('search-match')
    }
  })
})

// Global functions for inline onclick handlers
window.copyCode = function(btn) {
  const wrapper = btn.closest('.code-block-wrapper')
  const code = wrapper?.querySelector('pre code')
  if (!code) return
  const text = code.textContent
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied!'
    btn.classList.add('copied')
    setTimeout(() => {
      btn.textContent = 'Copy'
      btn.classList.remove('copied')
    }, 2000)
  })
}

window.closeLightbox = function() {
  document.getElementById('lightbox').classList.add('hidden')
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const lb = document.getElementById('lightbox')
    if (!lb.classList.contains('hidden')) {
      lb.classList.add('hidden')
    }
  }
})

document.addEventListener('dragenter', () => { dragCounter++; document.body.classList.add('drag-over') })
document.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' })
document.addEventListener('dragleave', () => { dragCounter--; if (dragCounter === 0) document.body.classList.remove('drag-over') })
document.addEventListener('drop', (e) => {
  e.preventDefault()
  document.body.classList.remove('drag-over')
  dragCounter = 0
  let handled = false
  try {
    for (const item of e.dataTransfer.items) {
      const f = item.getAsFile()
      const p = f?.path
      if (p) {
        window.electronAPI.openPath(p)
        handled = true
        continue
      }
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry()
        if (entry?.isDirectory) {
          loadDroppedFolder(entry)
          handled = true
        } else if (entry?.isFile && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
          entry.file((f2) => {
            const r = new FileReader()
            r.onload = () => renderMarkdown(r.result, entry.name, entry.fullPath)
            r.readAsText(f2)
          })
          handled = true
        }
      }
    }
  } catch (_) {}
  if (handled) return
  const types = Array.from(e.dataTransfer.types)
  let p
  if (types.includes('text/uri-list')) {
    const uri = e.dataTransfer.getData('text/uri-list').trim().split('\n')[0].trim()
    if (uri.startsWith('file:///')) p = decodeURIComponent(uri.slice(8))
  }
  if (!p && types.includes('text/plain')) {
    const text = e.dataTransfer.getData('text/plain').trim()
    if (text.match(/^[a-zA-Z]:\\/) || text.startsWith('\\\\')) p = text
  }
  if (p) window.electronAPI.openPath(p.replace(/\r$/, ''))
})

document.getElementById('open-folder-btn')?.addEventListener('click', () => {
  window.electronAPI.selectFolder()
})
document.getElementById('sidebar-open-btn')?.addEventListener('click', () => {
  window.electronAPI.selectFolder()
})

folderDropdown.addEventListener('change', async () => {
  selectedFolderId = parseInt(folderDropdown.value) || null
  if (treeMode) {
    const folder = folders.find(f => f.id === selectedFolderId)
    if (folder && !folder.path.startsWith('(drag-drop')) {
      treeData = await window.electronAPI.getTreeData(folder.path)
    } else {
      treeMode = false
      treeData = null
    }
  }
  renderFileList()
  const folder = folders.find(f => f.id === selectedFolderId)
  if (folder && folder.files.length > 0) {
    const first = folder.files[0]
    if (first.path.startsWith('__v')) {
      openFile(first.path, first.content, first.name)
    } else {
      openFile(first.path, null, first.name)
    }
  }
})

folderCloseBtn.addEventListener('click', () => {
  if (!selectedFolderId) return
  folders = folders.filter(f => f.id !== selectedFolderId)
  if (folders.length > 0) {
    selectedFolderId = folders[folders.length - 1].id
  } else {
    selectedFolderId = null
  }
  updateFolderBar()
  renderFileList()
})

async function loadDroppedFolder(dirEntry) {
  const id = ++folderIdCounter
  const entries = await readAllDirEntries(dirEntry)
  const files = []
  for (const entry of entries) {
    if (entry.isFile && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
      const blob = await new Promise(resolve => entry.file(resolve))
      const text = await new Promise(resolve => {
        const r = new FileReader()
        r.onload = () => resolve(r.result)
        r.readAsText(blob)
      })
      files.push({ name: entry.name, path: '__v' + id + '__' + entry.name, content: text })
    }
  }
  if (files.length === 0) return
  folders.push({ id, name: dirEntry.name, path: '(drag-drop folder)', files })
  selectedFolderId = id
  updateFolderBar()
  renderFileList()
  openFile(files[0].path, files[0].content, files[0].name)
}

function readAllDirEntries(dirEntry) {
  return new Promise(resolve => {
    const all = []
    const reader = dirEntry.createReader()
    function read() {
      reader.readEntries(entries => {
        if (entries.length === 0) { resolve(all); return }
        all.push(...entries)
        read()
      })
    }
    read()
  })
}

window.electronAPI.onFileOpened(({ content, fileName, filePath, parentDir, lines, words }) => {
  currentFilePath = filePath
  currentFileName = fileName
  currentContent = content
  watchedFilePath = filePath
  if (parentDir && !folders.some(f => f.path === parentDir)) {
    folders.push({ id: ++folderIdCounter, name: fileName, path: parentDir, files: [{ name: fileName, path: filePath }] })
    selectedFolderId = folderIdCounter
    updateFolderBar()
    renderFileList()
  }
  addTab(filePath, fileName)
  addRecentFile(filePath, fileName)
  renderMarkdown(content, fileName, filePath)
  updateStatusBar(fileName, lines, words)
  highlightActiveFile(filePath)
})

window.electronAPI.onFolderOpened(({ folderName, folderPath, files }) => {
  const mapped = files.map(f => ({ name: f.name, path: f.path }))
  folders.push({ id: ++folderIdCounter, name: folderName, path: folderPath, files: mapped })
  selectedFolderId = folderIdCounter
  updateFolderBar()
  renderFileList()
  if (mapped.length > 0 && !currentFilePath) {
    openFile(mapped[0].path, null, mapped[0].name)
  }
})

async function openFile(filePath, content, fileName) {
  showToast('openFile: ' + fileName)
  currentFilePath = filePath
  currentFileName = fileName
  addTab(filePath, fileName)
  addRecentFile(filePath, fileName)
  // Mark current tab as saved (no unsaved changes)
  const currentTab = tabs.find(t => t.path === filePath)
  if (currentTab) currentTab.unsaved = false
  if (content !== null && content !== undefined) {
    currentContent = content
    renderMarkdown(content, fileName, filePath)
  } else {
    const text = await window.electronAPI.getFileContent(filePath)
    currentContent = text
    const lines = text.split('\n').length
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    renderMarkdown(text, fileName, filePath)
    updateStatusBar(fileName, lines, words)
  }
  highlightActiveFile(filePath)
  if (isEditing && editorTextarea) {
    editorTextarea.value = currentContent || ''
    editorTextarea.setSelectionRange(0, 0)
    editorTextarea.scrollTop = 0
  }
}

function renderMarkdown(content, fileName, filePath) {
  const { html, headings } = window.electronAPI.parseMarkdown(content)

  document.getElementById('content').innerHTML = html
  document.getElementById('content').className = 'markdown-body'
  const ph = document.getElementById('placeholder')
  if (ph) ph.style.display = 'none'
  document.getElementById('file-info').innerHTML = `<div class="file-name">${escapeHtml(fileName)}</div><div class="file-path">${escapeHtml(filePath)}</div>`
  renderToc(headings)
  document.querySelectorAll('#content h1, #content h2, #content h3, #content h4').forEach(h => {
    h.addEventListener('click', () => {
      const tocItem = document.querySelector(`.toc-item[data-target="${h.id}"]`)
      if (tocItem) tocItem.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  })

  // Image lightbox
  document.querySelectorAll('#content img').forEach(img => {
    img.addEventListener('click', (e) => {
      e.stopPropagation()
      const lb = document.getElementById('lightbox')
      const lbImg = document.getElementById('lightbox-img')
      lbImg.src = img.src
      lb.classList.remove('hidden')
    })
  })
}

function updateStatusBar(fileName, lines, words) {
  document.getElementById('status-info').textContent = fileName || 'Ready'
  if (lines !== undefined && words !== undefined) {
    document.getElementById('status-stats').textContent = `${lines} lines · ${words} words`
  } else {
    document.getElementById('status-stats').textContent = ''
  }
}

// Editor Toggle
const editBtn = document.getElementById('status-edit-btn')
const editorTextarea = document.getElementById('editor-textarea')
const editControls = document.getElementById('edit-controls')
const saveBtn = document.getElementById('save-btn')
const editStatus = document.getElementById('edit-status')

editBtn.addEventListener('click', toggleEdit)

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    if (isEditing) saveEditor()
  }
})
saveBtn.addEventListener('click', saveEditor)

function toggleEdit() {
  if (!currentFilePath) return
  isEditing = !isEditing
  if (isEditing) {
    editorTextarea.value = currentContent
    document.getElementById('content').style.display = 'none'
    editorTextarea.classList.remove('hidden')
    editControls.classList.remove('hidden')
    editBtn.textContent = '👁️'
    editBtn.title = 'View mode'
    setTabUnsaved(false)
    editStatus.textContent = 'Editing'
    editorTextarea.focus()
    editorTextarea.setSelectionRange(0, 0)
    editorTextarea.scrollTop = 0
  } else {
    document.getElementById('content').style.display = ''
    editorTextarea.classList.add('hidden')
    editControls.classList.add('hidden')
    editBtn.textContent = '✏️'
    editBtn.title = 'Toggle Edit'
    const tab = tabs.find(t => t.id === activeTabId)
    if (tab && tab.unsaved) {
      renderMarkdown(editorTextarea.value, currentFileName, currentFilePath)
      currentContent = editorTextarea.value
      tab.unsaved = false
    }
  }
}

async function saveEditor() {
  const text = editorTextarea.value
  const filePath = currentFilePath
  const fileName = currentFileName
  if (!filePath || filePath.startsWith('__v')) {
    showToast('Open folder via Ctrl+K to enable saving')
    return
  }
  const ok = await window.electronAPI.saveFile(filePath, text)
  if (ok) {
    const tab = tabs.find(t => t.path === filePath)
    if (tab) tab.unsaved = false
    if (filePath === currentFilePath) {
      currentContent = text
      setTabUnsaved(false)
      editStatus.textContent = 'Saved'
      renderMarkdown(text, fileName, filePath)
    }
    showToast('Saved: ' + filePath + ' (' + text.substring(0,20) + '...)')
  } else {
    showToast('Save failed!')
  }
}

editorTextarea.addEventListener('input', () => {
  const tab = tabs.find(t => t.id === activeTabId)
  if (tab && !tab.unsaved) {
    tab.unsaved = true
    editStatus.textContent = 'Unsaved changes'
  }
})

function updateFolderBar() {
  folderDropdown.innerHTML = folders.map(f =>
    `<option value="${f.id}" ${f.id === selectedFolderId ? 'selected' : ''}>${escapeHtml(f.name)}</option>`
  ).join('')
  folderDropdown.style.display = folders.length > 0 ? '' : 'none'
  folderCloseBtn.style.display = folders.length > 0 ? '' : 'none'
}

function renderFileList() {
  if (treeMode && treeData) { renderTreeView(); return }
  const list = document.getElementById('file-list')
  const folder = folders.find(f => f.id === selectedFolderId)
  if (!folder) {
    list.innerHTML = ''
    return
  }
  list.innerHTML = folder.files.map(f => {
    const active = f.path === currentFilePath ? ' active' : ''
    return `<div class="file-list-item${active}" data-path="${f.path}"><span class="file-label">${escapeHtml(f.name)}</span></div>`
  }).join('')

  list.querySelectorAll('.file-list-item').forEach(el => {
    el.addEventListener('click', async () => {
      try {
        const fp = el.dataset.path
        showToast('CLICK: ' + fp)
        const folder = folders.find(f => f.files.some(ff => ff.path === fp))
        if (!folder) { console.error('Folder not found for path:', fp); return }
        const file = folder.files.find(f => f.path === fp)
        if (!file) { console.error('File not found:', fp); return }
        if (fp.startsWith('__v')) {
          openFile(fp, file.content, file.name)
        } else {
          openFile(fp, null, file.name)
        }
      } catch (err) { showToast('ERR: ' + err.message); console.error('File click error:', err) }
    })
  })

  // Re-apply search filter after re-render
  const q = fileSearch.value.trim().toLowerCase()
  if (q) {
    document.querySelectorAll('.file-list-item').forEach(el => {
      const label = el.querySelector('.file-label')?.textContent?.toLowerCase() || ''
      if (!label.includes(q)) {
        el.classList.add('search-hide')
        el.classList.remove('search-match')
      } else {
        el.classList.remove('search-hide')
        el.classList.add('search-match')
      }
    })
  }
}

function highlightActiveFile(filePath) {
  document.querySelectorAll('.file-list-item').forEach(el => el.classList.toggle('active', el.dataset.path === filePath))
  document.querySelectorAll('.file-tree-item').forEach(el => el.classList.toggle('active', el.dataset.path === filePath))
}

// Tree View
let treeMode = false
let treeData = null
const treeToggle = document.getElementById('tree-toggle')
treeToggle.addEventListener('click', async () => {
  const folder = folders.find(f => f.id === selectedFolderId)
  if (!folder || folder.path.startsWith('(drag-drop')) return
  treeMode = !treeMode
  treeToggle.textContent = treeMode ? '📋' : '📂'
  treeToggle.title = treeMode ? 'Show flat list' : 'Show folder tree'
  if (treeMode) {
    treeData = await window.electronAPI.getTreeData(folder.path)
    renderTreeView()
  } else {
    renderFileList()
  }
})

function renderTreeView() {
  const list = document.getElementById('file-list')
  if (!treeData) { list.innerHTML = ''; return }
  list.innerHTML = renderTreeNode(treeData, 0)
  list.querySelectorAll('.file-tree-item').forEach(el => {
    if (el.dataset.isdir === 'true') {
      el.addEventListener('click', () => {
        const children = el.nextElementSibling
        if (children) {
          children.classList.toggle('open')
          el.querySelector('.tree-toggle')?.classList.toggle('open')
        }
      })
    } else {
      el.addEventListener('click', () => {
        const fp = el.dataset.path
        const f = folders.find(f => f.files.some(ff => ff.path === fp))
        const file = f?.files.find(ff => ff.path === fp)
        if (file) openFile(fp, null, file.name)
      })
    }
  })
}

function renderTreeNode(node, depth) {
  if (!node.isDir) {
    const active = node.path === currentFilePath ? ' active' : ''
    return `<div class="file-tree-item${active}" data-path="${node.path}" style="padding-left:${20 + depth * 16}px">
      <span class="file-icon">📄</span>${escapeHtml(node.name)}
    </div>`
  }
  if (!node.children || node.children.length === 0) return ''
  const open = depth < 2 ? 'open' : ''
  const children = node.children.map(c => renderTreeNode(c, depth + 1)).join('')
  return `
    <div class="file-tree-item folder" data-path="${node.path}" data-isdir="true" style="padding-left:${20 + depth * 16}px">
      <span class="tree-toggle ${open}">▶</span><span class="file-icon">📁</span>${escapeHtml(node.name)}
    </div>
    <div class="file-tree-children ${open}">${children}</div>
  `
}

function renderToc(headings) {
  const toc = document.getElementById('toc')
  toc.innerHTML = headings.map(h => `<div class="toc-item toc-h${h.depth}" data-target="${h.id}" onclick="scrollToHeading('${h.id}')">${escapeHtml(h.text)}</div>`).join('')
  currentHeadings = headings
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        document.querySelectorAll('.toc-item').forEach(el => el.classList.remove('active'))
        const tocItem = document.querySelector(`.toc-item[data-target="${entry.target.id}"]`)
        if (tocItem) tocItem.classList.add('active')
      }
    })
  }, { rootMargin: '-80px 0px -60% 0px' })
  document.querySelectorAll('#content h1, #content h2, #content h3, #content h4').forEach(h => observer.observe(h))
}

window.scrollToHeading = function(id) {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    document.querySelectorAll('.toc-item').forEach(e => e.classList.remove('active'))
    const tocItem = document.querySelector(`.toc-item[data-target="${id}"]`)
    if (tocItem) tocItem.classList.add('active')
  }
}

function showToast(msg) {
  const t = document.getElementById('toast')
  if (!t) return
  t.textContent = msg
  t.classList.add('show')
  clearTimeout(t._timer)
  t._timer = setTimeout(() => t.classList.remove('show'), 2000)
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
