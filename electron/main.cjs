const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron')
const path = require('path')

const isPreview = process.env.ELECTRON_PREVIEW === 'true'
const isDev = !app.isPackaged && !isPreview
const isSmokeTest = process.env.ELECTRON_SMOKE_TEST === 'true'
const devServerUrl = process.env.ELECTRON_DEV_SERVER_URL || 'http://localhost:5173'

let mainWindow = null

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    backgroundColor: '#0f1117',
    title: 'CanvasForge',
    icon: path.join(__dirname, '../public/icons/canvasforge/icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  })

  if (isDev) {
    mainWindow.loadURL(devServerUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html')
    mainWindow.loadFile(indexPath)
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  if (isSmokeTest) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => app.quit(), 300)
    })

    mainWindow.webContents.once('did-fail-load', (_, errorCode, errorDescription, validatedURL) => {
      console.error('[Electron] Failed to load:', {
        errorCode,
        errorDescription,
        validatedURL,
      })
      app.exit(1)
    })
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.canvasforge.app')
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('dialog:save-file', async (_, options = {}) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: options.title || '保存文件',
    defaultPath: options.defaultPath || 'canvasforge-output.png',
    filters: options.filters || [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })

  return result
})
