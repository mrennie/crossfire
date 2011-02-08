/* See license.txt for terms of usage */
define("DomTool", ["crossfireModules/crossfire-status.js", "crossfireModules/tools/tool-listener.js"], function( CrossfireStatus, ToolListener) {

    /**
     * Crossfire DOM Tool
     */
    DomTool = function DomTool() {

    };

    DomTool.prototype = FBL.extend(ToolListener, {
        toolName: "dom",
        commands: [""],
        events: ["onDomMutate"],

        handleRequest: function( request) {

        },

        handleEvent: function( event) {

        },

        onConnectionStatusChanged: function( status) {
            this.status = status;
        },

        onRegistered: function() {
            Firebug.registerModule(this);
        },

        onUnregistered: function() {
            Firebug.unregisterModule(this);
        },

        // Firebug listener
        initialize: function() {
            FBTrace.sysout("dom-tool initialize");
        },

        initContext: function(context) {

        },

        loadedContext: function(context) {
            var doc, self = this;
            if (context.window) {
                doc = context.window.document;

                doc.addEventListener("DOMAttrModified", function(e) { self.onDomMutate(context, e); }, true);
                doc.addEventListener("DOMNodeInserted", function(e) { self.onDomMutate(context, e); }, true);
                doc.addEventListener("DOMNodeRemoved", function(e) { self.onDomMutate(context, e); }, true);
            }
        },

        onDomMutate: function( context, mutateEvent) {
            if (this.transport && this.status == CrossfireStatus.STATUS_CONNECTED_SERVER) {
                this.transport.sendEvent("onDomMutate", { "context_id": context.Crossfire.crossfire_id, "data": mutateEvent}, "dom");
            }
        }

    });

    return DomTool;
});