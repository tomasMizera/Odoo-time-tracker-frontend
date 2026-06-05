const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  keychain: {
    get:    ()     => ipcRenderer.invoke("keychain:get"),
    save:   (data) => ipcRenderer.invoke("keychain:save", data),
    delete: ()     => ipcRenderer.invoke("keychain:delete"),
  },
  odoo: {
    rpc: (payload) => ipcRenderer.invoke("odoo:rpc", payload),
  },
});
