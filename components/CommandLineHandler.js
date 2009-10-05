/* See license.txt for terms of usage */


const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

/**
 * @name CommandLineHandler
 * @constructor CommandLineHandler
 * @description Processes command-line arguments to connect to a remote debug host and port.
 *
 */
function CommandLineHandler() {
    this.wrappedJSObject = this;
}
CommandLineHandler.prototype =
/** @lends CommandLineHandler */
{

      classDescription: "command line handler",
      contractID: "@almaden.ibm.com/crossfire/command-line-handler;1",
      classID: Components.ID("3ab17c22-d1a6-4ff0-9a66-3dbd42114d61"),
      QueryInterface: XPCOMUtils.generateQI([Ci.nsICommandLineHandler]),
      _xpcom_categories: [{ category: "command-line-handler", entry: "m-crossfire-clh" }],

    handle: function(cmdLine) {
        try {
            this.host = cmdLine.handleFlagWithParam("crossfire-host", false);
            this.port = cmdLine.handleFlagWithParam("crossfire-port", false);
        } catch (e) {
            Cu.reportError("Command Line Handler failed: "+e);
        }
    },

    /**
     * @name CommandLineHandler.getPort
     * @function
     * @description  getPort
     * @return the port that was specified on the command-line.
     */
    getPort: function() {
        return this.port;
    },

    /**
     * @name CommandLineHandler.getHost
     * @function
     * @description getHost
     * @return the host that was specified on the command-line.
     */
    getHost: function() {
        return this.host;
    }
};

/** @ignore */
function NSGetModule(compMgr, fileSpec)
{
  return XPCOMUtils.generateModule([CommandLineHandler]);
}