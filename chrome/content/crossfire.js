/* See license.txt for terms of usage */
/**
 * Crossfire
 * Firebug extension to add support for remote debug protocol.
 *
 */

const CROSSFIRE_VERSION = "0.2";
var CONTEXT_ID_SEED = Math.round(Math.random() * 10000000);

var Crossfire = Crossfire || {};

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
            Firebug.Debugger.addListener(this);
            Firebug.Console.addListener(this);
            Firebug.Inspector.addListener(this);

            var commandLine = Components.classes["@almaden.ibm.com/crossfire/command-line-handler;1"].getService().wrappedJSObject;
            var host = commandLine.getHost();
            var port = commandLine.getPort();
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE Got command-line args: host => " + host + " port => " + port);

            if (host && port) {
                this.connect(host, port);
            }
        },

        /**
         * @description attempt to connect to remote host/port
         * @param {String} host the host name.
         * @param {Number} port the port number.
         */
        connect: function(host, port) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE connect: host => " + host + " port => " + port);
            this.host = host;
            this.port = port;
            this.getTransport().open(host, port);
        },

        /**
         * @description listen for incoming connections on a port.
         * @param {String} host the host name.
         * @param {Number} port the port number to listen on.
         */
        listen: function( host, port) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE listen: host => " + host + " port => " + port);
            this.host = host;
            this.port = port;
            this.listening = true;
            var transport = this.getTransport();
            FBTrace.sysout("transport is => " + transport);
            transport.listen(host, port);
            FBTrace.sysout("transport is listening...");
        },

        /**
         * @description disconnect the current connection.
         */
        disconnect: function() {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE disconnect");
            if (this.status != "disconnected" && this.transport) {
                this.transport.close();
                this.transport = null;
            }
        },

        getTransport: function() {
            if (!this.transport) {
                this.transport = SocketTransport.createInstance().wrappedJSObject;
                this.transport.addListener(this);
            }
            return this.transport;
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
                FBTrace.sysout("CROSSFIRE handling command: " + command + ", with arguments: ",  request.arguments );

            var response;
            if (command == "listcontexts") {
                response = this.listContexts();
            } else if (command == "version") {
                response =  { "version": CROSSFIRE_VERSION };
            } else {
                var commandAdaptor;
                var contextId = request.context_id;
                for (var i = 0; i < this.contexts.length; i++) {
                    var context = this.contexts[i];
                    if (contextId == context.Crossfire.crossfire_id) {
                        commandAdaptor = context.Crossfire.commandAdaptor;
                        break;
                    }
                }
                try {
                    response = commandAdaptor[command].apply(commandAdaptor, [ request.arguments ]);
                } catch (e) {
                    if (FBTrace.DBG_CROSSFIRE)
                        FBTrace.sysout("CROSSFIRE exception while executing command " + e);
                }
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
         * @description called when the transport is listening
         */
        handleResponse: function( response) {

        },

        /**
         * @description called when the status of the transport's connection changes.
         * @param {String} status
         */
        onConnectionStatusChanged: function( status) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE onConnectionStatusChanged: " + status, status);
            if (status == "handshakeComplete") {
                this.setConnected(true);
            } else if (status == "closed") {
                this.setConnected(false);
            } else {
                this.status = status;
            }
        },

        /**
         *
         * @description send events generated by Firebug to the remote host.
         * @param <code>context</context> context of this event.
         * @param {String} <code>eventName<code> name of the event
         * @param {Object} arguments any arguments after the first two will be passed to the event handler.
         */
        handleEvent: function( context, eventName /*, [arg1 [, arg2] ...] */) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE handleEvent " + eventName);

            var args = Array.prototype.slice.apply(arguments, [2]);

            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE handleEvent arguments: " + args);

            if (this.transport && this.status == "connected") {
                var eventAdaptor = context.Crossfire.eventAdaptor;
                var eventData = eventAdaptor[eventName].apply(eventAdaptor, args);
                this.transport.sendEvent(eventName, eventData);
            }
        },

        /**
         * @description called when the transport receives an event when listening
         */
        fireEvent: function(eventPacket) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE fireEvent " + eventPacket);
        },


        // ----- firebug listeners -----

        onSourceFileCreated: function( context, sourceFile) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE:  onSourceFileCreated");
            this.handleEvent(context, "onScript", sourceFile.href);
        },


        // ----- context listeners -----
        /**
         * @description Add the new context to our list of contexts.
         * @param context
         */
        initContext: function( context) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE:  initContext");
            context.Crossfire = { "crossfire_id" : generateId() };
            this.contexts.push(context);
        },

        /**
         * @description Create a new command adaptor for the context when it is loaded. Send "onContextCreated" event.
         * @param context
         */
        loadedContext: function( context) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE:  loadedContext");
            var contextId =  context.Crossfire.crossfire_id;

            context.Crossfire["commandAdaptor"] = new Crossfire.FirebugCommandAdaptor(context);
            context.Crossfire["eventAdaptor"] = new Crossfire.FirebugEventAdaptor(context);
            this.handleEvent(context, "onContextCreated");

        },

        /* @ignore
        showContext: function() {
          //TODO: ?? this.handleEvent("navigated");
        },
        */

        /**
         *  @description Remove the context from our list of contexts.
         *  @param context
         */
        destroyContext: function(context) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE: destroyContext");
            var contextId = context.Crossfire.crossfire_id;
            for (var i = 0; i < this.contexts.length; i++) {
                if (this.contexts[i].Crossfire.crossfire_id == contextId) {
                    this.handleEvent(this.contexts[i], "onContextDestroyed");
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
            var contexts = [];
            var context, href;
            for (var i = 0; i < this.contexts.length; i++) {
                context = this.contexts[i];
                href = "";
                if (context.window && !context.window.closed) {
                    href = context.window.location.href;
                }
                contexts.push( { "crossfire_id" : context.Crossfire.crossfire_id,
                                   "href": href });
            }
            return { "contexts": contexts };
        },

        /**
         * Make a copy of a frame since the jsdIStackFrame's are ephemeral,
         * but our protocol is asynchronous so the original frame object may
         * be gone by the time the remote host requests it.
         */
        copyFrame: function copyFrame( frame, ctx, copyStack) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("copy frame => " + frame);

            if (ctx) {
                var context = ctx;
            }

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
                        //copiedScope.parent = copyScope(aScope.jsParent);
                    }
                } catch (ex) {
                    if (FBTrace.DBG_CROSSFIRE) FBTrace.sysout("Exception copying scope => " + e);
                }
                return context.Crossfire.commandAdaptor.serialize(copiedScope);
                //return copiedScope;
            }

            if (frame && frame.isValid) {
                frameCopy["scope"] =  copyScope(frame.scope);

                if (frame.thisValue) {
                    try {
                       var thisVal = frame.thisValue.getWrappedValue();
                       frameCopy["thisValue"] = context.Crossfire.commandAdaptor.serialize(thisVal);
                    } catch( e) {
                        if (FBTrace.DBG_CROSSFIRE) FBTrace.sysout("Exception copying thisValue => " + e);
                    }
                }

                /* is 'callee' different from 'callingFrame'?
                try {
                    frameCopy["callee"] = frame.callee.getWrappedValue();
                } catch( e) {
                    frameCopy["callee"] = frame.callee;
                }
                */

                frameCopy["functionName"] = frame.functionName;

                try {
                    var sourceFile = Firebug.SourceFile.getSourceFileByScript(context, frame.script)
                    if (sourceFile) {
                        var analyzer = sourceFile.getScriptAnalyzer(frame.script);
                        if (analyzer) {
                            lineno = analyzer.getSourceLineFromFrame(context, frame);
                            frameCopy["line"] = lineno;
                            frameCopy["script"] = sourceFile.href.toString();
                        }
                    }
                } catch (x) {
                    frameCopy["line"] = frame.line;
                }

                // copy eval so we can call it from 'evaluate' command
                frameCopy["eval"] = function() { return frame.eval.apply(frame, arguments); };

                // recursively copy all the frames in the stack
                function copyStack( aFrame) {
                    if (FBTrace.DBG_CROSSFIRE)
                        FBTrace.sysout("CROSSFIRE copyStack: calling frame is => " + aFrame.callingFrame);
                    if (aFrame.callingFrame && aFrame.callingFrame.isValid) {
                        var stack = copyStack(aFrame.callingFrame);
                        stack.splice(0,0,copyFrame(aFrame, context, false));
                        return stack;
                    } else {
                        return [ copyFrame(aFrame, context, false) ];
                    }
                }

                if (copyStack) {
                    if (frame.callingFrame) {
                        var stack = copyStack(frame.callingFrame);
                        frameCopy["stack"] = stack;
                        frameCopy["frameIndex"] = stack.length -1;
                    } else {
                        frameCopy["frameIndex"] = 0;
                    }
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
            var contextId = context.Crossfire.crossfire_id;

            context.Crossfire.currentFrame = this.copyFrame(frame, context, true);

            this.handleEvent(context, "onBreak", href, lineno);

            this.setRunning(false);
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

            context.Crossfire.currentFrame = null;
            context.Crossfire.commandAdaptor.clearRefs();

            this.handleEvent(context, "onResume");
            this.setRunning(true);
        },

        /**
         * Send <code>onToggleBreakpoint</code> event.
         */
        onToggleBreakpoint: function(context, url, lineNo, isSet, props) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE: onToggleBreakpoint");
            FBTrace.sysout("set breakpoint url at: " + url + " , line => "  + lineNo);
            FBTrace.sysout("breakpoint props", props);
            FBTrace.sysout("onToggleBreakpoint arguments => " + arguments.length);
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
            var winFB = (win.wrappedJSObject?win.wrappedJSObject:win)._firebug;
            if (winFB)
            {
                //var data = winFB.userObjects;

                var eventName = "onConsole" + className.substring(0,1).toUpperCase() + className.substring(1);
                var data = (win.wrappedJSObject?win.wrappedJSObject:win)._firebug.userObjects;

                this.handleEvent(context, eventName, data);
            }
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

            var contextId = context.Crossfire.crossfire_id;
            this.transport.sendEvent("onStopInspecting", { "context_id": contextId });
        }
        */

        /**
         * Update Crossfire connection status icon.
         */
        setConnected: function( isConnected) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE setConnected", isConnected);
            var icon = $("crossfireIcon");
            if (icon) {
                if (isConnected) {
                    this.status = "connected";
                    removeClass(icon, "disconnected");
                    setClass(icon, "connected");

                    setClass($("menu_connectCrossfire"), "hidden");
                    setClass($("menu_listenCrossfire"), "hidden");

                    removeClass($("menu_disconnectCrossfire"), "hidden");
                } else {
                    setClass($("menu_disconnectCrossfire"), "hidden");
                    removeClass($("menu_connectCrossfire"), "hidden");
                    removeClass($("menu_listenCrossfire"), "hidden");

                    removeClass(icon, "connected");
                    setClass(icon, "disconnected");
                    this.status = "disconnected";
                }
                this.updateStatusText();
            }
        },

        updateStatusText: function() {
            if (this.status == "listening") {
                $("crossfireIcon").setAttribute("tooltiptext", "Crossfire: listening on port" + this.port);
            } else if (this.status == "connected") {
                $("crossfireIcon").setAttribute("tooltiptext", "Crossfire: connected to " + this.host+":"+this.port);
            } else {
                $("crossfireIcon").setAttribute("tooltiptext", "Crossfire: " + this.status);
            }
        },

        /**
         * Update Crossfire running status.
         */
        setRunning: function( isRunning) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE setRunning", isRunning);
            var icon = $("crossfireIcon");
            if (icon) {
                if (isRunning) {
                     setClass(icon, "running");
                } else {
                     removeClass(icon, "running");
                }
            }
            this.running = isRunning;
        },

        // Crossfire status menu
        onStatusMenuShowing: function( menu) {
            if (FBTrace.DBG_CROSSFIRE)
                 FBTrace.sysout("CROSSFIRE onStatusMenuShowing");
            if (this.running) {

            } else {

            }
        }

    });

    // register module
    Firebug.registerModule(CrossfireModule);


    // ----- Crossfire XUL Event Listeners -----

    Crossfire.onStatusClick = function( el) {
        $("crossfireStatusMenu").openPopup(el, "before_end", 0,0,false,false);
    };

    Crossfire.onStatusMenuShowing = function( menu) {
        //CrossfireModule.onStatusMenuShowing(menu);
    };

    Crossfire.listen = function() {
        if (FBTrace.DBG_CROSSFIRE)
            FBTrace.sysout("Crossfire.listen");
        var params = { "host": null, "port": null };
        window.openDialog("chrome://crossfire/content/connect-dialog.xul", "crossfire-connect","chrome,modal,dialog", params);

        if (params.host && params.port) {
            CrossfireModule.listen(params.host, parseInt(params.port));
        }

    }

    Crossfire.connect = function() {
        if (FBTrace.DBG_CROSSFIRE)
            FBTrace.sysout("Crossfire.connect");
        var params = { "host": null, "port": null };
        window.openDialog("chrome://crossfire/content/connect-dialog.xul", "crossfire-connect","chrome,modal,dialog", params);

        if (params.host && params.port) {
            CrossfireModule.connect(params.host, parseInt(params.port));
        }
    };

    Crossfire.disconnect = function() {
        if (FBTrace.DBG_CROSSFIRE)
            FBTrace.sysout("Crossfire.disconnect");

        CrossfireModule.disconnect();
    };

    // generate a unique id for newly created contexts.
    function generateId() {
        return "xf"+CROSSFIRE_VERSION + "::" + (++CONTEXT_ID_SEED);
    }

//end FBL.ns()
}});