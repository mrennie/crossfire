/* See license.txt for terms of usage */

/**
 * Crossfire Net Tool
 */
FBL.ns(function() {

    Crossfire.NetTool = function NetTool() {

    };

    Crossfire.NetTool.prototype = FBL.extend(CrossfireModule.ToolListener, {
        toolName: "net",
        commands: [],
        events: ["onNetworkRequest", "onNetworkResponse"],

        onRegistered: function() {
            Firebug.NetMonitor.addListener(this);
        },

        onUnregistered: function() {
            Firebug.NetMonitor.removeListener(this);
        },

        handleRequest: function( request) {

        },

        onConnectionStatusChanged: function( status) {
            this.status = status;
        },

        // --- NetMonitor ---

        onRequest: function(context, file) {
            if (this.status == CROSSFIRE_STATUS.STATUS_CONNECTED_SERVER) {
                this.transport.sendEvent("onNetworkRequest",
                    {
                        "context_id": context.Crossfire.crossfire_id,
                        "data": { "href": file.href, "startTime": file.startTime, "endTime": file.endTime }
                    },
                    "net");
            }
        },

        onResponse: function(context, file) {
            if (this.status == CROSSFIRE_STATUS.STATUS_CONNECTED_SERVER) {
                this.transport.sendEvent("onNetworkResponse",
                    {
                        "context_id": context.Crossfire.crossfire_id,
                        "data": { "href": file.href, "startTime": file.startTime, "endTime": file.endTime }
                    },
                    "net");
            }
        }

    });
});