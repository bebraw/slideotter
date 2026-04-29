const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("slideotterDesktop", {
  platform: process.platform
});
