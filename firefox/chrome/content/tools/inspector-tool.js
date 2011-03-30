/* See license.txt for terms of usage */

/**
 * Crossfire Inspector Tool
 */
FBL.ns(function() {

    Crossfire.InspectorTool = function InspectorTool() {

    };

    Crossfire.InspectorTool.prototype = FBL.extend(Crossfire.ToolListener, {
        toolName: "inspector",
        commands: ["inspect"],
        events: ["onInspectNode"],

        onRegistered: function() {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE inspectorTool onRegistered");
            }
            Firebug.Inspector.addListener(this);
        },

        onUnregistered: function() {
            Firebug.Inspector.removeListener(this);
        },

        handleRequest: function( request) {
            var response;
            if (request.command == "inspect") {
                var context = CrossfireModule.findContext(request.context_id);
                var contextid;
                if (context) {
                    response = this.doInspect(context, args);
                    contextid = context.Crossfire.crossfire_id;
                }
                this.transport.sendResponse(request.command, request.seq, contextid, response, true, true, this.toolName);
            }
        },

        onConnectionStatusChanged: function( status) {
            this.status = status;
        },

        /**
         * @name doInspect
         * @description Tells Firebug to enter 'inspect' mode.
         * @function
         * @private
         * @memberOf InspectorTool
         * @type Array
         * @returns always returns <code>null</code>
         * @param context the associated context {@link Object}
         * @param args the arguments array that contains:
         * <ul>
         * <li>optionally a {@link String} <code>xpath</code>, which is the xpath to the item to be inspected.</li>
         * <li>optionally a {@link String} <code>selector</code>, which is the selector to the item to be inspected.</li>
         * </ul>
         * <br><br>
         * If both <code>xpath</code> and <code>selector</code> are given <code>xpath</code> is used.
         * @since 0.3a1
         */
        doInspect: function(context, args) {
            var selector = args["selector"];
            var xpath = args["xpath"];
            var doc = context.window.document;
            var node;
            if (xpath) {
                node = FBL.getElementsByXPath(doc, xpath)[0];
            } else if (selector) {
                node = FBL.getElementsBySelector(doc, selector)[0];
            }
            Firebug.toggleBar(true);
            Firebug.Inspector.startInspecting(this.context);
            if (node) {
                if (node.wrappedJSObject) {
                    node = node.wrappedJSObject;
                }
                setTimeout(function() {
                    Firebug.Inspector.inspectNode(node);
                    FirebugChrome.select(node, 'html');
                });
            }
            return {};
        },

        // ----- Firebug.Inspector Listener -----

        /**
         * @name onInspectNode
         * @description Handles a node being inspected in Firebug.
         * <br><br>
         * Fires an <code>onInspectNode</code> event.
         * <br><br>
         * The event body contains the following:
         * <ul>
         * <li><code>context_id</code> - the id of the current Crossfire context</li>
         * <li><code>data</code> - the event payload from Firebug with the <code>node</code> value set</li>
         * </ul>
         * @function
         * @public
         * @memberOf InspectorTool
         * @param context the current Crossfire context
         * @param node the node being inspected
         */
        onInspectNode: function(context, node) {
            if (this.status == "connected_server") {
                node = node.wrappedJSObject;
                if (FBTrace.DBG_CROSSFIRE) {
                    FBTrace.sysout("CROSSFIRE onInspectNode", node);
                }
                var path = this._resolveElementPath(node, true);
                if(path) {
                    this.transport.sendEvent("onInspectNode", { "context_id": context.Crossfire.crossfire_id, "data": {"node": path}}, "inspector");
                }
            }
        },

        /**
         * @name _resolveElementPath
         * @description resolves the path to the given element within the DOM tree.
         * @function
         * @private
         * @memberOf CrossfireModule
         * @param element the current DOM node context
         * @param if we should use the tags names when constructing the path. i.e. <code>/html[1]/body[1]/div[4]/span[21]/...</code>
         * @since 0.3a1
         */
        _resolveElementPath: function(element, useTagNames) {
            var nameLookup = [];
            nameLookup[Node.COMMENT_NODE] = "comment()";
            nameLookup[Node.TEXT_NODE] = "text()";
            nameLookup[Node.PROCESSING_INSTRUCTION_NODE] = "processing-instruction()";
            var paths = [];
            for (; element && element.nodeType != Node.DOCUMENT_NODE; element = element.parentNode) {
                var tagName = element.localName || nameLookup[element.nodeType];
                var index = 0;
                for (var sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
                    var siblingTagName = sibling.localName || nameLookup[sibling.nodeType];
                    if (!useTagNames || tagName == siblingTagName || !tagName) {
                        ++index;
                    }
                }
                var pathIndex = "[" + (index+1) + "]";
                paths.splice(0, 0, (useTagNames && tagName ? tagName.toLowerCase() : "node()") + pathIndex);
            }
            return "/" + paths.join("/");
        }

    });
});