/* See license.txt for terms of usage */
/**
 * Crossfire
 * Firebug extension to add support for remote debug protocol.
 *
 */

FBL.ns(function() { with(FBL) {
    const SocketTransport = Components.classes["@almaden.ibm.com/crossfire/socket-transport;1"];

    /**
     * @name CrossfireModule
     * @namespace CrossfireModule
     * @module Firebug Module for Crossfire. This module acts as a controller
     * between Firebug and the remote debug connection.  It is responsible for
     * opening a connection to the remote debug host and dispatching any
     * command requests to the FirebugCommandAdaptor (@see FirebugCommandAdaptor.js).
     *
     * This module also adds context and debugger listeners and sends the
     * appropriate events to the remote host.
     */
    var CrossfireModule = extend(Firebug.Module, /**@lends CrossfireModule */ {
        contexts: [],
        dispatchName: "Crossfire",

        /** extends Firebug.Module */
        initialize: function() {
            var commandLine = Components.classes["@almaden.ibm.com/crossfire/command-line-handler;1"].getService().wrappedJSObject;
            var host = commandLine.getHost();
            var port = commandLine.getPort();
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE Got command-line args: host => " + host + " port => " + port);

            if (host && port) {
                this.transport = SocketTransport.createInstance().wrappedJSObject;
                this.transport.open(host, port);

                this.transport.addListener(this);

                Firebug.Debugger.addListener(this);
                Firebug.Console.addListener(this);
                Firebug.Inspector.addListener(this);

                this.running = true;
            }
        },

        // ----- Crossfire transport listener -----

        /**
         * @description
         * Listener function called by the transport when a request is
         * received.
         *
         * @description
         * Looks up the context by the request object's <code>context_id</code>
         * property and calls the requested command on that context's
         * command adaptor.
         */
        handleRequest: function( request) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE received request " + request.toSource());

            var command = request.command;

            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE handling command: " + command + ", with arguments: " + request.arguments );

            var response;
            if (command == "listcontexts") {
                response = this.listContexts();
            } else {
                var commandAdaptor;
                var contextId = request.context_id;
                for (var i = 0; i < this.contexts.length; i++) {
                    var context = this.contexts[i];
                    if (contextId == context.window.location.href) {
                        commandAdaptor = context.Crossfire.commandAdaptor;
                        break;
                    }
                }
                response = commandAdaptor[command].apply(commandAdaptor, [ request.arguments ]);
            }

            if (response) {
                if (FBTrace.DBG_CROSSFIRE)
                    FBTrace.sysout("CROSSFIRE sending response => " + response.toSource());
                this.transport.sendResponse(command, request.seq, response, this.running, true);
            } else {
                this.transport.sendResponse(command, request.seq, {}, this.running, false);
            }
        },

        /**
         *
         * @description send events generated by Firebug to the remote host.
         * @param <code>context</context> context of this event.
         * @param <code>eventName<code> name of the event
         * @param arguments any arguments after the first two will be passed to the event handler.
         */
        handleEvent: function( context, eventName /*, [arg1 [, arg2] ...] */) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE handleEvent " + eventName);

            var args = Array.prototype.slice.apply(arguments, [2]);

            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE handleEvent arguments: " + args);

            var eventAdaptor = context.Crossfire.eventAdaptor;
            var eventData = eventAdaptor[eventName].apply(eventAdaptor, args);
            this.transport.sendEvent(eventName, eventData);
        },


        // ----- firebug listeners -----
        /*
        onSourceFileCreated: function( context, sourceFile) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE:  onSourceFileCreated");
            // send afterCompile event?
        },
        */

        // ----- context listeners -----
        /**
         * @description Add the new context to our list of contexts.
         * @param context
         */
        initContext: function( context) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE:  initContext");
            context.Crossfire = {};
            this.contexts.push(context);
        },

        /**
         * @description Create a new command adaptor for the context when it is loaded. Send "navigated" event.
         * @param context
         */
        loadedContext: function( context) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE:  loadedContext");
            var contextId = context.window.location.href;

            context.Crossfire["commandAdaptor"] = new Crossfire.FirebugCommandAdaptor(context);
            context.Crossfire["eventAdaptor"] = new Crossfire.FirebugEventAdaptor(context);

            //this.handleEvent("navigated");
        },

        /* @ignore
        showContext: function() {

        },
        */

        /**
         *  @description Remove the context from our list of contexts.
         *  @param context
         */
        destroyContext: function( context) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE: destroyContext");
            var contextId = context.window.location.href;
            for (var i = 0; i < this.contexts.length; i++) {
                if (this.contexts[i].window && this.contexts[i].window.location.href == contextId) {
                    this.contexts.splice(i, 1);
                    break;
                }
            }
        },

        // ----- utils -----

        /**
         * listContexts method is called in response to a <code>listcontexts</code> command.
         * This method returns all the context id's that we know about.
         *
         * This is the only method that returns a protocol command response
         * that is not implemented in FirebugCommandAdaptor, because it is
         * not specific to one context.
         */
        listContexts: function() {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE listing " + this.contexts.length + " contexts...");
            var contextIds = [];
            for (var i = 0; i < this.contexts.length; i++) {
                contextIds.push(this.contexts[i].window.location.href);
            }
            return { "contexts": contextIds };
        },

        /**
         * Make a copy of a frame since the jsdIStackFrame's are ephemeral,
         * but our protocol is asynchronous so the original frame object may
         * be gone by the time the remote host requests it.
         */
        copyFrame: function copyFrame( frame) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("copy frame => " + frame);

            var frameCopy = {};

            // recursively copy scope chain
            function copyScope( aScope) {
                if (FBTrace.DBG_CROSSFIRE)
                    FBTrace.sysout("Copying scope => " + aScope);

                var copiedScope = {};
                try {
                    var listValue = {value: null}, lengthValue = {value: 0};
                    aScope.getProperties(listValue, lengthValue);

                    for (var i = 0; i < lengthValue.value; ++i) {
                        var prop = listValue.value[i];
                        var name = prop.name.getWrappedValue();
                        copiedScope[name.toString()] = prop.value.getWrappedValue();
                    }

                    if (aScope.jsParent) {
                        copiedScope.parent = copyScope(aScope.jsParent);
                    }
                } catch (ex) {
                    if (FBTrace.DBG_CROSSFIRE) FBTrace.sysout("Exception copying scope => " + e);
                }
                return copiedScope;
            }
            frameCopy["scope"] =  copyScope(frame.scope);

            if (frame && frame.isValid) {
                var thisObj = {};

                try {
                   var thisVal = frame.thisValue.getWrappedValue();
                   for (var p in thisVal) {
                       if (thisVal.hasOwnProperty(p)) {
                           thisObj[p] = thisVal[p];
                       }
                   }
                } catch( e) {
                    if (FBTrace.DBG_CROSSFIRE) FBTrace.sysout("Exception copying thisValue => " + e);
                     frameCopy["thisValue"] = frame.thisValue;
                }
                frameCopy["thisValue"] = thisObj;

                try {
                    frameCopy["callee"] = frame.callee.getWrappedValue();
                } catch( e) {
                    frameCopy["callee"] = frame.callee;
                }

                frameCopy["functionName"] = frame.functionName;

                frameCopy["line"] = frame.line;

                // recursively copy all the frames in the stack
                function copyStack( aFrame) {
                    if (FBTrace.DBG_CROSSFIRE)
                        FBTrace.sysout("CROSSFIRE copyStack: calling frame is => " + aFrame.callingFrame);
                    if (aFrame.callingFrame && aFrame.callingFrame.isValid) {
                        var stack = copyStack(aFrame.callingFrame);
                        stack.push(copyFrame(aFrame));
                        return stack;
                    } else {
                        return [ copyFrame(aFrame) ];
                    }
                }
                if (frame.callingFrame) {
                    var stack = copyStack(frame.callingFrame);
                    frameCopy["stack"] = stack;
                    frameCopy["frameIndex"] = stack.length -1;
                } else {
                    frameCopy["frameIndex"] = 0;
                }

            }
            return frameCopy;
        },


        // ----- Firebug Debugger listener -----

        /**
         * Copy the current frame (in case remote host requests it)
         * and send <code>onBreak</code> event.
         */
        onStartDebugging: function( context) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE:  onStartDebugging");

            var frame = context.currentFrame;
            var lineno = 1;
            var sourceFile = Firebug.SourceFile.getSourceFileByScript(context, frame.script)
            if (sourceFile) {
                var analyzer = sourceFile.getScriptAnalyzer(frame.script);
                if (analyzer)
                    lineno = analyzer.getSourceLineFromFrame(context, frame);
            }
            var href = sourceFile.href.toString();
            var contextId = context.window.location.href;

            var copiedFrame = this.copyFrame(frame);

            context.Crossfire.commandAdaptor.currentFrame = copiedFrame;

            this.handleEvent(context, "onBreak", href, lineno);
            this.running = false;
        },

        onStop: function(context, frame, type, rv) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE:  onStop");
        },

        /**
         * Send <code>onResume</code> event and set status 'running' to true.
         */
        onResume: function( context) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE: onResume");
            context.Crossfire.commandAdaptor.currentFrame = null;
            this.handleEvent(context, "onResume");
            this.running = true;
        },

        /**
         * Send <code>onToggleBreakpoint</code> event.
         */
        onToggleBreakpoint: function(context, url, lineNo, isSet, props) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE: onToggleBreakpoint");
            this.handleEvent(context, "onToggleBreakpoint");
        },

        /**
         * Send <code>onToggleBreakpoint</code> event.
         */
        onToggleErrorBreakpoint: function(context, url, lineNo, isSet, props) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE: onToggleErrorBreakpoint");
            this.handleEvent(context, "onToggleBreakpoint");

        },

        onJSDActivtate: function() {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE:  onJSDActivtate");

        },

        onJSDDeactivate: function() {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE: onJSDDeactivate");
        },

        // ----- Firebug Console listener -----

        /**
         * logFormatted listener.
         * @description Generates event packets based on the className (log,debug,info,warn,error).
         * @description The object or message logged is contained in the packet's <code>data</code> property.
         * The generated event names are:
         * 		<code>onConsoleLog</code>,
         * 		<code>onConsoleDebug</code>,
         * 		<code>onConsoleInfo</code>,
         * 		<code>onConsoleWarn</code>,
         * 		<code>onConsoleError</code>
         */
        logFormatted: function(context, objects, className, sourceLink) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE logFormatted");

            var win = context.window;
            var eventName = "onConsole" + className.substring(0,1).toUpperCase() + className.substring(1);
            var data = (win.wrappedJSObject?win.wrappedJSObject:win)._firebug.userObjects;

            this.handleEvent(context, eventName, data);
        },

        // ----- Firebug.Inspector Listener -----

        /**
         * @description Send <code>onInspectNode</code> event.
         */
        onInspectNode: function(context, node) {
            node = node.wrappedJSObject;
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE onInspectNode", node);
            this.handleEvent(context, "onInspectNode", node);
        },

        /* @ignore
        onStopInspecting: function(context, node) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE onStopInspecting");

            var contextId = context.window.location.href;
            this.transport.sendEvent("onStopInspecting", { "context_id": contextId });
        }
        */
    });

    // register module
    Firebug.registerModule(CrossfireModule);

//end FBL.ns()
}});