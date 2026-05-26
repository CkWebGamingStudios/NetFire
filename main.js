const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // This enables the secure native webview tag feature
      webviewTag: true 
    }
  });

  // Load your local launcher front-end
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);