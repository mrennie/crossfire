pref("toolkit.defaultChromeURI", "chrome://remote-client/content/crossfire-remote-client.xul");
pref("toolkit.defaultChromeFeatures", "");
pref("toolkit.singletonWindowType", true);
pref("extensions.logging.enabled", true);

pref("extensions.dss.enabled", false);
pref("extensions.dss.switchPending", false);
pref("extensions.ignoreMTimeChanges", false);

pref("xpinstall.dialog.confirm", "chrome://mozapps/content/xpinstall/xpinstallConfirm.xul");
pref("xpinstall.dialog.progress.skin", "chrome://mozapps/content/extensions/extensions.xul?type=themes");
pref("xpinstall.dialog.progress.chrome", "chrome://mozapps/content/extensions/extensions.xul?type=extensions");
pref("xpinstall.dialog.progress.type.skin", "Extension:Manager-themes");
pref("xpinstall.dialog.progress.type.chrome", "Extension:Manager-extensions");

/* debugging prefs */
pref("browser.dom.window.dump.enabled", true);
pref("javascript.options.showInConsole", true);
pref("nglayout.debug.disable_xul_cache", true);
pref("nglayout.debug.disable_xul_fastload", true);

/* crossfire prefs */
pref("extensions.firebug.DBG_CROSSFIRE_REMOTE", true);
pref("extensions.firebug.DBG_CROSSFIRE", true);
pref("extensions.firebug.DBG_CROSSFIRE_FRAMES", false);
pref("extensions.firebug.DBG_CROSSFIRE_TRANSPORT", true);
pref("extensions.firebug.DBG_CROSSFIRE_TOOLS", false);
pref("extensions.firebug.crossfire.loopbackOnly", false);
