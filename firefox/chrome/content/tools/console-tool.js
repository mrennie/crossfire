/* See license.txt for terms of usage */

/**
 * Crossfire Console Tool
 */

FBL.ns(function() {

    Crossfire.ConsoleTool = function ConsoleTool() {

    };

    Crossfire.ConsoleTool.prototype = FBL.extend(CrossfireModule.ToolListener, {
        toolName: "console",
        commands: [],
        events: ["onConsoleLog", "onConsoleDebug", "onConsoleInfo", "onConsoleWarn", "onConsoleError" ],

        handleRequest: function( request) {

        },

        onConnectionStatusChanged: function( status) {
            this.status = status;
        },

        onRegistered: function() {
            Firebug.Console.addListener(this);
        },

        onUnregistered: function() {
            Firebug.Console.removeListener(this);
        },

        // ----- Firebug Console listener -----

        /**
         * @name log
         * @description
         */
        log: function() {
            //TODO:
        },

        /**
         * @name logFormatted
         * @description Generates event packets based on the className (log,debug,info,warn,error).
         * The object or message logged is contained in the packet's <code>data</code> property.
         * <br><br>
         * Fires one of the following events:
         * <ul>
         * <li><code>onConsoleLog</code></li>
         * <li><code>onConsoleDebug</code></li>
         * <li><code>onConsoleInfo</code></li>
         * <li><code>onConsoleWarn</code></li>
         * <li><code>onConsoleError</code></li>
         * </ul>
         * <br><br>
         * The event body contains the following:
         * <ul>
         * <li><code>context_id</code> - the id of the current Crossfire context</li>
         * <li><code>data</code> - the event payload from Firebug</li>
         * </ul>
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param context the current Crossfire context
         * @param objects
         * @param className the name of the kind of console event.
         * <br>
         * One of:
         * <ul>
         * <li>log</li>
         * <li>debug</li>
         * <li>info</li>
         * <li>warn</li>
         * <li>error</li>
         * </ul>
         * @param sourceLink
         */
        logFormatted: function(context, objects, className, sourceLink) {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE ConsoleTool logFormatted");
            }
            var win = context.window;
            var winFB = (win.wrappedJSObject?win.wrappedJSObject:win)._firebug;
            if (winFB) {
                var eventName = "onConsole" + className.substring(0,1).toUpperCase() + className.substring(1);
                var obj = (win.wrappedJSObject?win.wrappedJSObject:win)._firebug.userObjects;
                if (this.transport && this.status == CROSSFIRE_STATUS.STATUS_CONNECTED_SERVER) {
                    this.transport.sendEvent(eventName, {"context_id": context.Crossfire.crossfire_id, "data": obj}, "console");
                }
            }
        }
    });
});