/* See license.txt for terms of usage */

/**
 * Crossfire Net Tool
 */
define("NetTool", ["crossfireModules/crossfire-status.js", "crossfireModules/tools/tool-listener.js"], function( CrossfireStatus, ToolListener) {

    function NetTool() {

    };

    NetTool.prototype = FBL.extend(ToolListener, {
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
            if (this.status == CrossfireStatus.STATUS_CONNECTED_SERVER) {
                this.transport.sendEvent("onNetworkRequest",
                    {
                        "context_id": context.Crossfire.crossfire_id,
                        "data": { "href": file.href, "startTime": file.startTime, "endTime": file.endTime }
                    },
                    "net");
            }
        },

        onResponse: function(context, file) {
            if (this.status == CrossfireStatus.STATUS_CONNECTED_SERVER) {
                this.transport.sendEvent("onNetworkResponse",
                    {
                        "context_id": context.Crossfire.crossfire_id,
                        "data": { "href": file.href, "startTime": file.startTime, "endTime": file.endTime }
                    },
                    "net");
            }
        }

    });

    return NetTool;
});