/* See license.txt for terms of usage */

var Crossfire = Crossfire || {};

FBL.ns(function() {

    /**
     * @name CrossfireClient
     * @description Firebug Module for Client-side Crossfire functions.
     */
    top.CrossfireClient = FBL.extend(Firebug.Module, {

        contexts: [],
        dispatchName: "CrossfireClient",
        toolName: "all", // receive all packets, regardless of 'tool' header

        /**
         * @name initialize
         * @description Initializes Crossfire
         * @function
         * @private
         * @memberOf CrossfireModule
         * @extends Firebug.Module
         */
        initialize: function() {
            var host, port;
            var commandLine = Components.classes["@almaden.ibm.com/crossfire/command-line-handler;1"].getService().wrappedJSObject;
            host = commandLine.getHost();
            port = commandLine.getPort();
            if (host && port) {
                this.connectClient(host, port);
            }

            // Begin transitional code
            //Cu.import("resource://firebug/modules/bti/browser.js");
            // End transitional code
        },


        /**
         * @name connectClient
         * @description Attempts to connect to remote host/port
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param {String} host the remote host name.
         * @param {Number} port the remote port number.
         */
        connectClient: function(host, port) {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE connect: host => " + host + " port => " + port);
            }

            this.host = host;
            this.port = port;
            try {

                this.transport = CrossfireModule.getClientTransport();
                this.transport.addListener(this);
                this.transport.open(host, port);
            }
            catch(e) {
                if (FBTrace.DBG_CROSSFIRE) FBTrace.sysout(e);
            }
        },

        /**
         * @name onConnectionStatusChanged
         * @description Called when the status of the transport's connection changes.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param {String} status the status to report
         */
        onConnectionStatusChanged: function( status) {
            if (status == CROSSFIRE_STATUS.STATUS_CONNECTED_CLIENT) {
                this.listContexts();
            }
        },

        /**
         * @name fireEvent
         * @function
         * @description Listens for events from Crossfire socket,
         * and dispatch them to BTI calls.
         */
        fireEvent: function(packet)
        {
            FBL.dispatch(this.fbListeners, "onExecute", [packet]);
        },

        _sendCommand: function(command, data) {
            //TODO:
            this.transport.sendRequest(command, data);
        },

        // ----- BTI-ish things -----
        listContexts: function() {
            this._sendCommand("listcontexts");
        }
    });

    // register module
    Firebug.registerModule(CrossfireClient);
});