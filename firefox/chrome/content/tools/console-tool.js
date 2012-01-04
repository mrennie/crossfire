/* See license.txt for terms of usage */

/**
 * Crossfire Console Tool
 */
FBL.ns(function() {

	/**
	 * @constructor
	 * @returns a new {@link ConsoleTool} object
	 */
    Crossfire.ConsoleTool = function ConsoleTool() {

    };

    Crossfire.ConsoleTool.prototype = FBL.extend(Crossfire.Tool, {
        toolName: "console",
        commands: ["setloglevel", "setloglimit"],
        events: ["onConsoleLog", "onConsoleDebug", "onConsoleInfo", "onConsoleWarn", "onConsoleError" ],
        
        /**
         * @see Crossfire.Tool#handleRequest in /firefox/chrome/content/tools/tool.js
         */
        handleRequest: function(request) {
        },

        /**
         * @see Crossfire.Tool#onRegistered in /firefox/chrome/content/tools/tool.js
         */
        onRegistered: function() {
            Firebug.Console.addListener(this);
        },

        /**
         * @see Crossfire.Tool#onUnregistered in /firefox/chrome/content/tools/tool.js
         */
        onUnregistered: function() {
            Firebug.Console.removeListener(this);
        },

        /**
         * @name log
         * @description
         * This function is a callback for <code>Firebug.ConsoleBase</code> located
         * in <code>../content/firebug/console.js</code>.
         * <br><br>
         * The object or message logged is contained in the packet's <code>body</code> property.
         * <br><br>
         * Fires the <code>onConsoleError</code> event.
         * <br><br>
         * The event body contains the following:
         * <ul>
         * <li><code>contextId</code> - the id of the current Crossfire context</li>
         * <li><code>body</code> - the event payload from Firebug</li>
         * </ul>
         * @function
         * @public
         * @memberOf Crossfire.ConsoleTool
         * @param object the object causing the error
         * @param context the current context
         * @param className the name of the kind of console event.
         * @param rep
         * @param noThrottle
         * @param sourceLink
         */
        log: function(context, object, className, rep, noThrottle, sourceLink) {
            if (FBTrace.DBG_CROSSFIRE_CONSOLE_TOOL) {
                FBTrace.sysout("console-tool log -> "+className, context);
            }
            if(className == "errorMessage") {
	            var trace = context.trace ? context.trace : context.thrownStackTrace;
	            var body = {
	            	"message": object.message,
	            	"stackTrace": (trace ? Crossfire.serialize(trace.frames) : null)
	            };
	            if (this.transport && this.status == CROSSFIRE_STATUS.STATUS_CONNECTED_SERVER) {
	            	this.transport.sendEvent("onConsoleError", {"contextId": context.Crossfire.crossfire_id, "body": body}, "console");
	            }
            }
        },
        
        /**
         * @name logFormatted
         * @description Generates event packets based on the className (log,debug,info,warn).
         * The object or message logged is contained in the packet's <code>body</code> property.
         * <br><br>
         * Fires one of the following events:
         * <ul>
         * <li><code>onConsoleLog</code></li>
         * <li><code>onConsoleDebug</code></li>
         * <li><code>onConsoleInfo</code></li>
         * <li><code>onConsoleWarn</code></li>
         * </ul>
         * <br><br>
         * The event body contains the following:
         * <ul>
         * <li><code>contextId</code> - the id of the current Crossfire context</li>
         * <li><code>body</code> - the event payload from Firebug</li>
         * </ul>
         * @function
         * @public
         * @memberOf Crossfire.ConsoleTool
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
         * </ul>
         * @param sourceLink
         */
        logFormatted: function(context, objects, className, sourceLink) {
            if (FBTrace.DBG_CROSSFIRE_CONSOLE_TOOL) {
                FBTrace.sysout("console-tool logFormatted -> "+className, context);
            }
            if (this.transport && this.status == CROSSFIRE_STATUS.STATUS_CONNECTED_SERVER) {
            	var eventName = "onConsole" + className.substring(0,1).toUpperCase() + className.substring(1);
                this.transport.sendEvent(eventName, {"contextId": context.Crossfire.crossfire_id, "body": Crossfire.serialize(objects)}, "console");
            }
        }
    });
});