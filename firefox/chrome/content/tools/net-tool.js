/* See license.txt for terms of usage */

/**
 * Crossfire Net Tool
 */
FBL.ns(function() {

	/**
	 * @constructor
	 * @returns a new {@link NetTool} object
	 */
    Crossfire.NetTool = function NetTool() {

    };

    Crossfire.NetTool.prototype = FBL.extend(Crossfire.Tool, {
        toolName: "net",
        commands: [],
        events: ["onNetworkRequest", "onNetworkResponse"],
        
        /**
         * @see Crossfire.Tool#onRegistered in /firefox/chrome/content/tools/tool.js
         */
        onRegistered: function() {
            Firebug.NetMonitor.addListener(this);
        },

        /**
         * @see Crossfire.Tool#onUnregistered in /firefox/chrome/content/tools/tool.js
         */
        onUnregistered: function() {
            Firebug.NetMonitor.removeListener(this);
        },

        /**
         * @see Crossfire.Tool#onRequest in /firefox/chrome/content/tools/tool.js
         */
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

        /**
         * @see Crossfire.Tool#onResponse in /firefox/chrome/content/tools/tool.js
         */
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