/* See license.txt for terms of usage */

/**
 * Crossfire DOM Tool
 */
FBL.ns(function() {

	/**
	 * @constructor
	 * @returns a new {@link DomTool} object
	 */
    Crossfire.DomTool = function DomTool() {

    };

    Crossfire.DomTool.prototype = FBL.extend(Crossfire.Tool, {
        toolName: "dom",
        commands: [],
        events: ["onDomMutate"],

        /**
         * @see Crossfire.Tool#onRegistered in /firefox/chrome/content/tools/tool.js
         */
        onRegistered: function() {
            Firebug.registerModule(this);
        },

        /**
         * @see Crossfire.Tool#onUnregistered in /firefox/chrome/content/tools/tool.js
         */
        onUnregistered: function() {
            Firebug.unregisterModule(this);
        },

        loadedContext: function(context) {
        	if (FBTrace.DBG_CROSSFIRE_DOM_TOOL) {
        		FBTrace.sysout("dom-tool loadedContext");
        	}
            var doc, self = this;
            if (context.window) {
                doc = context.window.document;

                doc.addEventListener("DOMAttrModified", function(e) { self.onDomMutate(context, e); }, true);
                doc.addEventListener("DOMNodeInserted", function(e) { self.onDomMutate(context, e); }, true);
                doc.addEventListener("DOMNodeRemoved", function(e) { self.onDomMutate(context, e); }, true);
            }
        },

        onDomMutate: function(context, mutateEvent) {
        	if (FBTrace.DBG_CROSSFIRE_DOM_TOOL) {
        		FBTrace.sysout("dom-tool onDomMutate");
        	}
            if (this.transport && this.status == "connected_server") {
                this.transport.sendEvent("onDomMutate", { "contextId": context.Crossfire.crossfire_id, "body": mutateEvent}, "dom");
            }
        }

    });
});