/* See license.txt for terms of usage */


const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

/**
 * @name CommandLineHandler
 * @constructor CommandLineHandler
 * @description Processes command-line arguments to connect to a remote debug host and port.
 * <br><br>
 * List of accepted command line arguments includes:
 * <ul>
 * <li><code>crossfire-server-port</code> - the port to start the crossfire server listening on</li>
 * <li><code>crossfire-host</code> - the name of the host computer to try and connect to, this is consulted iff <code>crossfire-server-port</code> is not present</li>
 * <li><code>crossfire-port</code> - the port of the host computer to try and connect to, this is consulted iff <code>crossfire-server-port</code> is not present</li>
 * <li><code>-load-fb-modules</code> - this flag will enable all of the Firebug modules when Firefox starts</li> 
 * <li><code>-no-fb-modules</code> - this flag will cause no Firebug modules to be loaded when Firefox starts regardless of any other settings</li>
 * </ul>
 * @property serverPort the port the server was started on
 * @property host the hostname of the computer to connect to
 * @property port the port of the computer to connect to
 * @property loadFBModules if the Firebug modules should be loaded at startup
 * @property noFBModules if no Firebug modules should be loaded at startup
 */
function CommandLineHandler() {
    this.wrappedJSObject = this;
}
CommandLineHandler.prototype =
/** @lends CommandLineHandler */
{

      classDescription: "command line handler",
      contractID: "@almaden.ibm.com/crossfire/command-line-handler;1",
      classID: Components.ID("3AB17C22-D1A6-4FF0-9A66-3DBD42114D61"),
      QueryInterface: XPCOMUtils.generateQI([Ci.nsICommandLineHandler]),
      _xpcom_categories: [{ category: "command-line-handler", entry: "m-crossfire-clh" }],

    /**
     * @name CommandLineHandler.handle
     * @function
     * @description default call-back to look for the crossfire command line arguments. 
     * @param cmdLine an {@link nsICommandLine} object
     * @see https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsICommandLine
     */
    handle: function(cmdLine) {
        try {
            this.serverPort = cmdLine.handleFlagWithParam("crossfire-server-port", false);
            if (!this.serverPort) {
                this.host = cmdLine.handleFlagWithParam("crossfire-host", false);
                this.port = cmdLine.handleFlagWithParam("crossfire-port", false);
            }
        } catch (e) {
            Cu.reportError("Command Line Handler failed: " + e);
        }

        try {
            this.loadFBModules = cmdLine.handleFlag("-load-fb-modules", false);
            this.noFBModules = cmdLine.handleFlag("-no-fb-modules", false);

            if (this.loadFBModules) {
                this._watchAndInitializeFirebug();
            }

        } catch (e2) {
            Cu.reportError("Command Line Handler failed: " + e2);
        }
    },

    /**
     * @name CommandLineHandler.getServerPort
     * @function
     * @description  returns the port that the server was started on.
     * <br><br>
     * This value is specified using the <code>crossfire-server-port</code> argument.
     * @return the server port that was specified on the command-line.
     */
    getServerPort: function() {
        return this.serverPort;
    },

    /**
     * @name CommandLineHandler.getPort
     * @function
     * @description  returns the port that Crossfire should try and connect to. 
     * <br><br>
     * This value is specified using the <code>crossfire-port</code> argument.
     * @return the port that was specified on the command-line.
     */
    getPort: function() {
        return this.port;
    },

    /**
     * @name CommandLineHandler.getHost
     * @function
     * @description returns the host computer name that Crossfire should try and connect to. This value can be a computer name or IP address -
     * for example <code>localhost</code> or <code>127.0.0.1</code>.
     * <br><br>
     * This value is specified using the <code>crossfire-host</code> argument.
     * @return the host that was specified on the command-line.
     */
    getHost: function() {
        return this.host;
    },

    /**
     * @name CommandLineHandler.shouldLoadFBModules
     * @function
     * @description if the Firebug modules should be loaded when Firefox starts.
     * <br><br>
     * This value is specified using the <code>-load-fb-modules</code> or <code>-no-fb-modules</code> flag.
     * <br><br>
     * If both <code>-no-fb-modules</code> and <code>-load-fb-modules</code> are specified <code>-no-fb-modules</code> will be 
     * considered to 'win' and no Firebug modules will be loaded.
     * @return boolean indicating whether <code>-no-fb-modules</code> or <code>-load-fb-modules</code> was specified on the command-line.
     */
    shouldLoadFBModules: function() {
        return (this.loadFBModules && !this.noFBModules);
    },

    /** 
     * @ignore 
     * @function
     * @description registers an observer to an {@link nsIWindowWatcher}
     * @see https://developer.mozilla.org/en/nsIWindowWatcher
     */
    _watchAndInitializeFirebug: function() {
        // initialize Firebug Modules before panels are loaded...
        var windowWatcher = Cc["@mozilla.org/embedcomp/window-watcher;1"].getService(Ci.nsIWindowWatcher);

        var windowObserver = {
            QueryInterface: function(iid) {
                    if(!iid.equals(Ci.nsISupports) && !iid.equals(Ci.nsIObserver))
                        throw NS_ERROR_NO_INTERFACE;
                    return this;
            },

            observe: function( subject, topic, data) {
                if (topic == "domwindowopened") {
                    if (/* nsIDOMWindow */ subject.Firebug) {
                        subject.Firebug.initialize();
                        windowWatcher.unregisterNotification(windowObserver);
                    }
                }
            }
        };

        windowWatcher.registerNotification(windowObserver);
    }

};

/** @ignore */
if (XPCOMUtils.generateNSGetFactory) {
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([CommandLineHandler])
} else {
    //mcollins: FF3 complains if NSGetModule is not a function
    function NSGetModule() {
        return XPCOMUtils.generateModule([CommandLineHandler]);
    }
}