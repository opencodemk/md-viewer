const path = require('path')
const { pathToFileURL } = require('url')

const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i
const WINDOWS_ABSOLUTE_PATH = /^[a-z]:[\\/]/i
const WINDOWS_UNC_PATH = /^\\\\/

function isWindowsPath(filePath) {
  return WINDOWS_ABSOLUTE_PATH.test(filePath) || WINDOWS_UNC_PATH.test(filePath)
}

function decodePathname(pathname) {
  try {
    return decodeURIComponent(pathname)
  } catch (_) {
    // Keep malformed percent sequences as literal filename characters.
    return pathname
  }
}

/**
 * Resolve an image source against the Markdown file that declared it.
 *
 * Markdown is rendered inside the app's index.html, so leaving a relative src
 * untouched would resolve it against the installation directory instead of
 * the directory containing the Markdown document.
 */
function resolveImageSource(source, markdownFilePath) {
  if (typeof source !== 'string') return source

  const trimmedSource = source.trim()
  if (!trimmedSource || trimmedSource.startsWith('#')) return trimmedSource

  // A Windows drive letter looks like a URL scheme, so test it first.
  const sourceIsWindowsPath = isWindowsPath(trimmedSource)
  if (!sourceIsWindowsPath && URL_SCHEME.test(trimmedSource)) return trimmedSource

  // Protocol-relative web URLs inherit file: on an Electron file page, which
  // turns them into invalid local/UNC paths. Treat them as HTTPS resources.
  if (trimmedSource.startsWith('//')) return `https:${trimmedSource}`

  // Files obtained only through the browser drag/drop API have virtual paths;
  // there is no filesystem location against which a relative image can resolve.
  if (
    typeof markdownFilePath !== 'string' ||
    !markdownFilePath ||
    markdownFilePath.startsWith('__') ||
    markdownFilePath.startsWith('(drag-drop')
  ) {
    return trimmedSource
  }

  const suffixIndex = trimmedSource.search(/[?#]/)
  const sourcePath = suffixIndex === -1 ? trimmedSource : trimmedSource.slice(0, suffixIndex)
  const suffix = suffixIndex === -1 ? '' : trimmedSource.slice(suffixIndex)
  if (!sourcePath) return trimmedSource

  const decodedSourcePath = decodePathname(sourcePath)
  const useWindowsPaths = sourceIsWindowsPath || isWindowsPath(markdownFilePath)
  const pathApi = useWindowsPaths ? path.win32 : path.posix
  const absolutePath = pathApi.resolve(pathApi.dirname(markdownFilePath), decodedSourcePath)

  return pathToFileURL(absolutePath, { windows: useWindowsPaths }).href + suffix
}

module.exports = { resolveImageSource }
