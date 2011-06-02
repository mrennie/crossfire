/* See license.txt for terms of usage */

/**
 * Crossfire DOM Tool
 */
FBL.ns(function() {

    Crossfire.DomTool = function DomTool() {

    };

    Crossfire.DomTool.prototype = FBL.extend(Crossfire.ToolListener, {
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
            if (this.transport && this.status == "connected_server") {
                this.transport.sendEvent("onDomMutate", { "contextId": context.Crossfire.crossfire_id, "data": mutateEvent}, "dom");
            }
        }

    });
});