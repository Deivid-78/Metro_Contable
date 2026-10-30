const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
function createWindow() {
  Menu.setApplicationMenu(null);
  const w = new BrowserWindow({ width: 1280, height: 800, title: "Metro Contable", icon: path.join(__dirname, "www", "icon-512.png") });
  w.loadFile(path.join(__dirname, "www", "index.html"));
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
