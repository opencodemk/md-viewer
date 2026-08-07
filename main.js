const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { execFile } = require('child_process')

let mainWindow
let startupFileData = null
let startupFolderData = null
let watchedFile = null
let recentFiles = []
let recentFilePath = ''

function watchFile(filePath) {
  if (watchedFile) { try { fs.unwatchFile(watchedFile) } catch (_) {} }
  watchedFile = filePath
  try {
    fs.watchFile(filePath, { interval: 1000 }, (curr, prev) => {
      if (curr.mtimeMs !== prev.mtimeMs) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8')
          const lines = content.split('\n').length
          const words = content.trim() ? content.trim().split(/\s+/).length : 0
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('file-changed', { content, filePath, lines, words })
          }
        } catch (_) {}
      }
    })
  } catch (_) {}
}

function parseStartupArgs() {
  const arg = process.argv.slice(1).find(a => {
    const s = a.replace(/^["']|["']$/g, '')
    return s.endsWith('.md') || s.endsWith('.markdown')
  })
  if (!arg) return

  const resolved = path.resolve(arg.replace(/^["']|["']$/g, ''))
  if (!fs.existsSync(resolved)) return

  try {
    const stat = fs.statSync(resolved)
    if (stat.isDirectory()) {
      const files = fs.readdirSync(resolved)
        .filter(f => f.endsWith('.md') || f.endsWith('.markdown'))
        .sort()
        .map(f => ({ name: f, path: path.join(resolved, f) }))
      startupFolderData = { folderName: path.basename(resolved), folderPath: resolved, files }
      if (files.length > 0) {
        const content = fs.readFileSync(files[0].path, 'utf-8')
        const lines = content.split('\n').length
        const words = content.trim() ? content.trim().split(/\s+/).length : 0
        startupFileData = { content, fileName: path.basename(files[0].path), filePath: files[0].path, parentDir: path.dirname(files[0].path), lines, words }
      }
    } else if (stat.isFile()) {
      const content = fs.readFileSync(resolved, 'utf-8')
      const lines = content.split('\n').length
      const words = content.trim() ? content.trim().split(/\s+/).length : 0
      startupFileData = { content, fileName: path.basename(resolved), filePath: resolved, parentDir: path.dirname(resolved), lines, words }
    }
  } catch (_) {}
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    show: false,
    icon: path.join(__dirname, 'img', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.loadFile('index.html')
  mainWindow.on('page-title-updated', (e) => e.preventDefault())
  mainWindow.setTitle(`Markdown Viewer v${app.getVersion()}`)

  mainWindow.once('ready-to-show', () => {
    if (startupFileData) {
      mainWindow.webContents.send('file-opened', startupFileData)
    }
    if (startupFolderData) {
      mainWindow.webContents.send('folder-opened', startupFolderData)
    }
    mainWindow.show()
  })

  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('file:///')) e.preventDefault()
  })

  mainWindow.webContents.on('drop-files', (_e, files) => {
    if (!files) return
    for (const p of files) {
      try {
        const stat = fs.statSync(p)
        if (stat.isDirectory()) { loadFolder(p) }
        else if (stat.isFile() && (p.endsWith('.md') || p.endsWith('.markdown'))) { loadFile(p) }
      } catch (_) {}
    }
  })

  mainWindow.webContents.on('context-menu', (_e, params) => {
    const template = [
      params.hasImageContents && {
        label: 'Copy Image',
        click: () => mainWindow.webContents.copyImageAt(params.x, params.y),
      },
      params.linkURL && {
        label: 'Copy Link',
        click: () => require('electron').clipboard.writeText(params.linkURL),
      },
      params.selectionText && {
        label: 'Copy',
        accelerator: 'CmdOrCtrl+C',
        click: () => {
          mainWindow.webContents.copy()
          mainWindow.webContents.executeJavaScript('showToast("Copied to clipboard!")')
        },
      },
      params.selectionText && {
        label: 'Cut',
        accelerator: 'CmdOrCtrl+X',
        click: () => {
          mainWindow.webContents.cut()
          mainWindow.webContents.executeJavaScript('showToast("Cut to clipboard!")')
        },
      },
      (params.selectionText || require('electron').clipboard.readText()) && { type: 'separator' },
      require('electron').clipboard.readText() && {
        label: 'Paste',
        accelerator: 'CmdOrCtrl+V',
        click: () => {
          mainWindow.webContents.paste()
          mainWindow.webContents.executeJavaScript('showToast("Pasted!")')
        },
      },
      (params.hasImageContents || params.linkURL || params.selectionText || require('electron').clipboard.readText()) && { type: 'separator' },
      {
        label: 'Select All',
        accelerator: 'CmdOrCtrl+A',
        click: () => mainWindow.webContents.executeJavaScript(`
          const c = document.getElementById('content');
          if (c) { const r = document.createRange(); r.selectNodeContents(c); window.getSelection().removeAllRanges(); window.getSelection().addRange(r) }
        `),
      },
    ].filter(Boolean)

    if (template.length > 0) {
      Menu.buildFromTemplate(template).popup()
    }
  })
}

function addRecent(name, filePath, isDir) {
  const norm = p => path.normalize(p).replace(/[\/\\]$/, '').toLowerCase()
  const key = norm(filePath)
  recentFiles = recentFiles.filter(f => norm(f.filePath) !== key)
  recentFiles.unshift({ name, filePath, isDir })
  if (recentFiles.length > 3) recentFiles = recentFiles.slice(0, 3)
  try { fs.writeFileSync(recentFilePath, JSON.stringify(recentFiles)) } catch (_) {}
  buildMenu()
}

function buildMenu() {
  const norm = p => path.normalize(p).replace(/[\/\\]$/, '').toLowerCase()
  const seen = new Set()
  const unique = recentFiles.filter(f => {
    const k = norm(f.filePath)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  recentFiles = unique
  let recentSubmenu
  if (recentFiles.length > 0) {
    recentSubmenu = recentFiles.map(f => ({
      label: f.name,
      click: () => {
        if (f.isDir) {
          loadFolder(f.filePath)
        } else {
          loadFile(f.filePath)
        }
      }
    }))
    recentSubmenu.push({ type: 'separator' })
    recentSubmenu.push({ label: 'Clear Recent', click: () => { recentFiles = []; try { fs.writeFileSync(recentFilePath, '[]') } catch (_) {}; buildMenu() } })
  } else {
    recentSubmenu = [{ label: '(Empty)', enabled: false }]
  }

  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'Open Markdown File...', accelerator: 'CmdOrCtrl+O', click: () => openFile() },
        { label: 'Open Folder...', accelerator: 'CmdOrCtrl+K', click: () => openFolder() },
        { type: 'separator' },
        { label: 'Print...', accelerator: 'CmdOrCtrl+P', click: () => mainWindow.webContents.send('print') },
        { type: 'separator' },
        { label: 'Exit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Recent Files', submenu: recentSubmenu },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Welcome', click: () => mainWindow.webContents.send('show-welcome') },
      ],
    },
  ])
  Menu.setApplicationMenu(menu)
}

async function openFile() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  })
  if (!result.canceled && result.filePaths.length > 0) {
    loadFile(result.filePaths[0])
  }
}

async function openFolder() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  })
  if (!result.canceled && result.filePaths.length > 0) {
    loadFolder(result.filePaths[0])
  }
}

function loadFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').length
  const words = content.trim() ? content.trim().split(/\s+/).length : 0
  addRecent(path.basename(filePath), filePath, false)
  mainWindow.webContents.send('file-opened', { content, fileName: path.basename(filePath), filePath, parentDir: path.dirname(filePath), lines, words })
  watchFile(filePath)
}

function loadFolder(folderPath) {
  const files = fs.readdirSync(folderPath)
    .filter(f => f.endsWith('.md') || f.endsWith('.markdown'))
    .sort()
    .map(f => ({ name: f, path: path.join(folderPath, f) }))

  addRecent(path.basename(folderPath), folderPath, true)
  mainWindow.webContents.send('folder-opened', { folderName: path.basename(folderPath), folderPath, files })
}

ipcMain.on('open-path', (_event, filePath) => {
  if (!fs.existsSync(filePath)) return
  const stat = fs.statSync(filePath)
  if (stat.isDirectory()) { loadFolder(filePath) }
  else if (stat.isFile() && (filePath.endsWith('.md') || filePath.endsWith('.markdown'))) { loadFile(filePath) }
})

ipcMain.handle('get-file-content', async (_event, filePath) => {
  return fs.readFileSync(filePath, 'utf-8')
})

ipcMain.handle('select-folder', async () => {
  if (mainWindow) mainWindow.focus()
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
  if (!result.canceled && result.filePaths.length > 0) {
    loadFolder(result.filePaths[0])
    return result.filePaths[0]
  }
  return ''
})

ipcMain.handle('save-file', async (_event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  } catch (e) {
    return false
  }
})

ipcMain.handle('print-pdf', async () => {
  try {
    const pdf = await mainWindow.webContents.printToPDF({ printBackground: true })
    const name = `Markdown-${Date.now()}.pdf`
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: name,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, pdf)
      return result.filePath
    }
  } catch (_) {}
  return ''
})

ipcMain.handle('get-tree-data', async (_event, dirPath) => {
  function readTree(dir, maxDepth) {
    if (maxDepth <= 0) return null
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      const children = []
      for (const e of entries) {
        const fullPath = path.join(dir, e.name)
        if (e.isDirectory()) {
          const sub = readTree(fullPath, maxDepth - 1)
          if (sub) children.push({ name: e.name, path: fullPath, isDir: true, children: sub.children })
        } else if (e.name.endsWith('.md') || e.name.endsWith('.markdown')) {
          children.push({ name: e.name, path: fullPath, isDir: false })
        }
      }
      if (children.length === 0) return null
      return { name: path.basename(dir), path: dir, isDir: true, children }
    } catch (_) { return null }
  }
  return readTree(dirPath, 5) || { name: path.basename(dirPath), path: dirPath, isDir: true, children: [] }
})

ipcMain.handle('get-app-version', () => app.getVersion())

app.whenReady().then(() => {
  app.setAppUserModelId('com.mdviewer.app')
  recentFilePath = path.join(app.getPath('userData'), 'recent.json')
  try {
    const data = JSON.parse(fs.readFileSync(recentFilePath, 'utf-8'))
    const norm = p => path.normalize(p).replace(/[\/\\]$/, '').toLowerCase()
    const seen = new Set()
    recentFiles = data.filter(f => {
      if (!f.filePath || typeof f.isDir !== 'boolean') return false
      const key = norm(f.filePath)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  } catch (_) {}
  parseStartupArgs(); createWindow(); buildMenu()
})

app.on('window-all-closed', () => { app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
app.on('before-quit', () => {
  if (watchedFile) {
    try { fs.unwatchFile(watchedFile) } catch (_) {}
    watchedFile = null
  }
})
