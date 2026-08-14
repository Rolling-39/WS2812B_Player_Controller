// Tauri v2 API polyfill — uses plugin globals injected by the runtime
var __tauri = (function () {
    var t = window.__TAURI__;
    if (!t || !t.core || !t.core.invoke) {
        var stub = function () { return Promise.reject(new Error('Not inside Tauri')); };
        return { invoke: stub, open: stub, save: stub, listen: stub,
            minimize: stub, toggleMaximize: stub, close: stub };
    }
    var invoke = t.core.invoke.bind(t.core);
    var dlg = window.__TAURI_PLUGIN_DIALOG__;

    return {
        invoke: invoke,
        open:  dlg ? dlg.open.bind(dlg)  : function () { return invoke('plugin:dialog|open', { options: {} }); },
        save:  dlg ? dlg.save.bind(dlg)  : function () { return invoke('plugin:dialog|save', { options: {} }); },
        minimize:       function() { return invoke('minimize_window'); },
        toggleMaximize: function() { return invoke('toggle_maximize_window'); },
        close:          function() { return invoke('close_app_window'); },
        listen: function(evt, cb) {
            if (t.event && t.event.listen) return t.event.listen(evt, function(e) { cb(e.payload || e); });
            return function() {};
        }
    };
})();

export var invoke = __tauri.invoke;
export var open = __tauri.open;
export var save = __tauri.save;
export var minimize = __tauri.minimize;
export var toggleMaximize = __tauri.toggleMaximize;
export var closeWindow = __tauri.close;
export var listen = __tauri.listen;
