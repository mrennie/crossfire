/* See license.txt for terms of usage */

/**
 * Crossfire Net Tool
 */
FBL.ns(function() {

    Crossfire.NetTool = function NetTool() {

    };

    Crossfire.NetTool.prototype = FBL.extend(Crossfire.Tool, {
        toolName: "net",
        commands: [],
        events: ["onNetworkRequest", "onNetworkResponse"],

        getName: function() {
        	return this.toolName;
        },
        
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
            if (this.status == "connected_server") {
                this.transport.sendEvent("onNetworkRequest",
                    {
                        "contextId": context.Crossfire.crossfire_id,
                        "body": { "href": file.href, "startTime": file.startTime, "endTime": file.endTime }
                    },
                    "net");
            }
        },

        onResponse: function(context, file) {
            if (this.status == "connected_server") {
                this.transport.sendEvent("onNetworkResponse",
                    {
                        "contextId": context.Crossfire.crossfire_id,
                        "body": { "href": file.href, "startTime": file.startTime, "endTime": file.endTime }
                    },
                    "net");
            }
        }

    });
});