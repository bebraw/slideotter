// fallow-ignore-file unused-file
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("slideotterDesktop", {
  platform: process.platform
});
