/* See license.txt for terms of usage */

/**
 * @name CROSSFIRE_VERSION
 * @description The current version of Crossfire
 * @constant
 * @public
 * @memberOf Crossfire
 * @type String
 */
const CROSSFIRE_VERSION = "0.3";
/**
 * @name CONTEXT_ID_SEED
 * @description The seed to use when creating new context ids for Crossfire
 * @public
 * @memberOf Crossfire
 * @type Integer
 */
var CONTEXT_ID_SEED = Math.round(Math.random() * 10000000);
/**
 * @name Crossfire
 * @description Firebug extension to add support for remote debug protocol.
 * @public
 */
var Crossfire = Crossfire || {};

FBL.ns(function() { with(FBL) {

    /**
     * @name CrossfireModule
     * @module Firebug Module for Crossfire. This module acts as a controller
     * between Firebug and the remote debug connection.  It is responsible for
     * opening a connection to the remote debug host and dispatching any
     * command requests to the FirebugCommandAdaptor.
     * <br><br>
     * This module also adds context and debugger listeners and sends the
     * appropriate events to the remote host.
     * @see FirebugCommandAdaptor.js
     */
    top.CrossfireModule = extend(Firebug.Module,  {
        contexts: [],
        dispatchName: "Crossfire",

        /** 
         * @name initialize
         * @description Initializes Crossfire
         * @function
         * @private
         * @memberOf CrossfireModule
         * @extends Firebug.Module 
         */
        initialize: function() {
            var host, port, serverPort;
            Components.utils.import("resource://crossfire/SocketTransport.js");
            var commandLine = Components.classes["@almaden.ibm.com/crossfire/command-line-handler;1"].getService().wrappedJSObject;
            serverPort = commandLine.getServerPort();
            if (serverPort) {
                if (FBTrace.DBG_CROSSFIRE)
                    FBTrace.sysout("CROSSFIRE Got command-line args: server-port => " + serverPort);

                this.startServer("localhost", serverPort);
            } else if (host && port) {
                host = commandLine.getHost();
                port = commandLine.getPort();

                if (FBTrace.DBG_CROSSFIRE)
                    FBTrace.sysout("CROSSFIRE Got command-line args: host => " + host + " port => " + port);

                this.connectClient(host, port);
            }
        },

        /**
         * @name connectClient
         * @description Attempts to connect to remote host/port
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param {String} host the remote host name.
         * @param {Number} port the remote port number.
         */
        connectClient: function(host, port) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE connect: host => " + host + " port => " + port);
            this.host = host;
            this.port = port;
            try {
	            this._addListeners();

	            if (!this.clientTransport)
	                this.clientTransport = new CrossfireSocketTransport();

	            this.clientTransport.addListener(this);
	            this.clientTransport.open(host, port);
	        }
	        catch(e) {
	        	this._removeListeners();
	        	FBTrace.sysout(e);
	        }
        },

        /**
         * @name startServer
         * @description Listen for incoming connections on a port.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param {String} host the host name.
         * @param {Number} port the port number to listen on.
         */
        startServer: function( host, port) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE startServer: host => " + host + " port => " + port);

            this.serverPort = port;
            try {
                this.transport = getCrossfireServer();
                this._addListeners();
                this.transport.addListener(this);
                this.transport.open(host, port);
            } catch(e) {
            	this._removeListeners();
                FBTrace.sysout(e);
            }
        },
        
        /**
         * @name _addListeners
         * @description Adds Crossfire as a listener to the core modules
         * @function
         * @private
         * @memberOf CrossfireModule
         */
        _addListeners: function() {
            Firebug.Debugger.addListener(this);
            Firebug.Console.addListener(this);
            Firebug.Inspector.addListener(this);
            Firebug.HTMLModule.addListener(this);
        },
        
        /**
         * @name _removeListeners
         * @description Removes Crossfire as a listener from the core modules
         * @function
         * @private
         * @memberOf CrossfireModule
         */
        _removeListeners: function() {
        	Firebug.Debugger.removeListener(this);
            Firebug.Console.removeListener(this);
            Firebug.Inspector.removeListener(this);
            Firebug.HTMLModule.removeListener(this);
        },
        
        /**
         * @name stopServer
         * @description Stops the server and closes the socket
         * @function
         * @public
         * @memberOf CrossfireModule
         */
        stopServer: function() {
        	this._removeListeners();
            this.transport.close();
            this.transport = null;
        },

        /**
         * @name disconnect
         * @description Disconnects the current connection and closes the socket.
         * @function
         * @public
         * @memberOf CrossfireModule
         */
        disconnect: function() {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE disconnect");
            if (this.status != CROSSFIRE_STATUS.STATUS_DISCONNECTED && this.transport) {
            	this._removeListeners();
                this.transport.close();
                this.transport = null;
            }
        },

        // ----- Crossfire transport listener -----

        /**
         * @name handleRequest
         * @description Looks up the context by the request object's <code>context_id</code>
         * property and calls the requested command on that context's command adaptor.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param request the original request from {@link SocketTransport}
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
         * @name onConnectionStatusChanged
         * @description Called when the status of the transport's connection changes.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param {String} status the status to report
         */
        onConnectionStatusChanged: function( status) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE onConnectionStatusChanged: " + status);
            this.status = status;
            this.updateStatusText(status);
            this.updateStatusIcon(status);
        },

        /**
         * @name handleEvent
         * @description Send events generated by Firebug to the remote host.
         * <br><br>
         * @function
         * @public
         * @memberOf CrossfireModule
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

            if (this.transport && this.status == CROSSFIRE_STATUS.STATUS_CONNECTED_SERVER) {
                var eventAdaptor = context.Crossfire.eventAdaptor;
                var eventData = eventAdaptor[eventName].apply(eventAdaptor, args);
                if (FBTrace.DBG_CROSSFIRE)
                    FBTrace.sysout("CROSSFIRE handleEvent sending to transport: " + eventData);
                this.transport.sendEvent(eventName, eventData);
            }
        },

        // ----- firebug listeners -----
        /**
         * @name onSourceFileCreated
         * @description Handles a script being loaded - i.e. a script has been compiled in the current context.
         * <br><br>
         * Fires an <code>onScript</code> event.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param context the context of this event
         * @param sourceFile the source file object
         */
        onSourceFileCreated: function( context, sourceFile) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE:  onSourceFileCreated => " + sourceFile.href);

            var context_href;
            try {
                context_href = context.window.location.href;
            } catch(e) {
                context_href = "";
            }

            context.Crossfire.commandAdaptor.sourceFileLoaded(sourceFile);

            this.handleEvent(context, "onScript", { "href": sourceFile.href, "context_href": context_href });
        },

        // ----- context listeners -----
        /**
         * @name initContext
         * @description Handles a context being created - i.e. a new tab has been opened.
         * <br><br>
         * Fires an <code>onContextCreated</code> event.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param context the new context
         */
        initContext: function( context) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE:  initContext");

            context.Crossfire = { "crossfire_id" : generateId() };
            context.Crossfire["commandAdaptor"] = new Crossfire.FirebugCommandAdaptor(context);
            context.Crossfire["eventAdaptor"] = new Crossfire.FirebugEventAdaptor(context);
            this.contexts.push(context);
            this.handleEvent(context, "onContextCreated");
        },

        /**
         * @name loadedContext
         * @description Handles a context being loaded - i.e. the scripts in a given context have completed being compiled.
         * <br><br>
         * Fires an <code>onContextCreated</code> event.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param context the context that completed loading
         */
        loadedContext: function( context) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE:  loadedContext");

            //context.Crossfire.commandAdaptor.setContextLoaded();

            this.handleEvent(context, "onContextLoaded");
        },

        /**
         * @name showContext
         * @description Handles a context being shown - i.e. a tab has been switched to. 
         * <br><br>
         * Fires an <code>onContextChanged</code> event
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param browser the browser the context was changed to in
         * @param context the context that was switched from
         */
        showContext: function(browser, context) {
            this.handleEvent(this.currentContext, "onContextChanged", context);
            this.currentContext = context;
        },

        /**
         * @name destroyContext
         * @description Handles a context being destroyed - i.e. a tab has been closed in the browser. 
         * <br><br>
         * Fires an <code>onContextDestroyed</code> event.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param context the context that has been destroyed
         */
        destroyContext: function(context) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE: destroyContext");
            var contextId = context.Crossfire.crossfire_id;
            for (var i = 0; i < this.contexts.length; i++) {
                if (this.contexts[i].Crossfire.crossfire_id == contextId) {
                    delete this.contexts[i].Crossfire.currentFrame;

                    this.handleEvent(this.contexts[i], "onContextDestroyed");

                    this.contexts.splice(i, 1);
                    break;
                }
            }
        },

        // ----- utils -----

        /**
         * @name listContexts
         * @description Called in response to a <code>listcontexts</code> command.
         * This method returns all the context id's that we know about.
         *
         * This is the only method that returns a protocol command response
         * that is not implemented in FirebugCommandAdaptor, because it is
         * not specific to one context.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @type Array
         * @returns an Array of the known list of contexts
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
                contexts.push( { "context_id" : context.Crossfire.crossfire_id,
                                 "href"         : href ,
                                 "current"      : this.currentContext == context });
            }
            return { "contexts": contexts };
        },

        /**
         * @name copyFrame
         * @description Make a copy of a frame since the jsdIStackFrame's are ephemeral,
         * but our protocol is asynchronous so the original frame object may
         * be gone by the time the remote host requests it.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param frame the stackframe to copy
         * @param ctx the current Crossfire context
         * @param shouldCopyStack is the stack of the frame should also be copied
         * @type Array
         * @returns a copy of the given stackframe
         */
        copyFrame: function copyFrame( frame, ctx, shouldCopyStack) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("copy frame => ", frame);

            if (FBTrace.DBG_CROSSFIRE_FRAMES)
                FBTrace.sysout("frame count => " + (++ctx.Crossfire.frameCount));

            if (ctx) {
                var context = ctx;
            }

            var frameCopy = {};

            // recursively copy scope chain
            function copyScope( aScope) {
                if (FBTrace.DBG_CROSSFIRE_FRAMES)
                    FBTrace.sysout("Copying scope => ", aScope);

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
                    if (FBTrace.DBG_CROSSFIRE_FRAMES) FBTrace.sysout("Exception copying scope => " + e);
                }
                return context.Crossfire.commandAdaptor.serialize(copiedScope);
                //return copiedScope;
            }

            if (frame && frame.isValid) {
                try {
                    var sourceFile = Firebug.SourceFile.getSourceFileByScript(context, frame.script)
                    if (sourceFile) {
                        var analyzer = sourceFile.getScriptAnalyzer(frame.script);
                        if (analyzer) {
                            lineno = analyzer.getSourceLineFromFrame(context, frame);
                            frameCopy["line"] = lineno;
                            var frameScript = sourceFile.href.toString();
                            if (FBTrace.DBG_CROSSFIRE_FRAMES)
                                FBTrace.sysout("frame.script is " + frameScript);

                            frameCopy["script"] = frameScript;
                        }
                    }
                } catch (x) {
                    if (FBTrace.DBG_CROSSFIRE) FBTrace.sysout("Exception getting script name");
                    frameCopy["line"] = frame.line;
                }

                frameCopy["scope"] =  copyScope(frame.scope);

                if (frame.thisValue) {
                    if (FBTrace.DBG_CROSSFIRE_FRAMES)
                        FBTrace.sysout("copying thisValue from frame...");
                    try {
                       var thisVal = frame.thisValue.getWrappedValue();
                       frameCopy["thisValue"] = context.Crossfire.commandAdaptor.serialize(thisVal);
                    } catch( e) {
                        if (FBTrace.DBG_CROSSFIRE) FBTrace.sysout("Exception copying thisValue => " + e);
                    }
                } else if (FBTrace.DBG_CROSSFIRE_FRAMES) {
                    FBTrace.sysout("no thisValue in frame");
                }

                /* is 'callee' different from 'callingFrame'?
                try {
                    frameCopy["callee"] = frame.callee.getWrappedValue();
                } catch( e) {
                    frameCopy["callee"] = frame.callee;
                }
                */

                frameCopy["functionName"] = frame.functionName;

                // copy eval so we can call it from 'evaluate' command
                frameCopy["eval"] = function() { return frame.eval.apply(frame, arguments); };

                /**
                 * @name copyStack
                 * @description recursively copies all of the stack elements from the given frame
                 * @function
                 * @private
                 * @memberOf CrossfireModule
                 * @param the current frame
                 * @type Array
                 * @returns the Array for the copied stack
                 */
                function copyStack( aFrame) {
                    if (FBTrace.DBG_CROSSFIRE_FRAMES)
                        FBTrace.sysout("CROSSFIRE copyStack: calling frame is => ", aFrame.callingFrame);
                    if (aFrame.callingFrame && aFrame.callingFrame.isValid) {
                        var stack = copyStack(aFrame.callingFrame);
                        stack.splice(0,0,copyFrame(aFrame, context, false));
                        return stack;
                    } else {
                        return [ copyFrame(aFrame, context, false) ];
                    }
                }

                if (shouldCopyStack) {
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
         * @name onStartDebugging
         * @description Handles Firebug suspending.
         * <br><br>
         * Fires an <code>onBreak</code> event.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param context the current Crossfire context
         */
        onStartDebugging: function( context) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE:  onStartDebugging");

            var frame = context.stoppedFrame;
            var lineno = 1;
            var sourceFile = Firebug.SourceFile.getSourceFileByScript(context, frame.script)
            if (sourceFile) {
                var analyzer = sourceFile.getScriptAnalyzer(frame.script);
                if (analyzer)
                    lineno = analyzer.getSourceLineFromFrame(context, frame);
            }
            var href = sourceFile.href.toString();
            var contextId = context.Crossfire.crossfire_id;

            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE:  onStartDebugging href => " + href);

            context.Crossfire.frameCount = 0;
            context.Crossfire.currentFrame = this.copyFrame(frame, context, true);

            this.handleEvent(context, "onBreak", href, lineno);

            this.setRunning(false);
        },

        /**
         * @name onStop
         * @description Handles Firebug stopping
         * <br><br>
         * Fires an <code>onStop</code> event.
         * @function
         * @public 
         * @memberOf CrossfireModule
         * @param context the current Crossfire context
         * @param frame the current stackframe
         * @param type
         * @param rv
         */
        onStop: function(context, frame, type, rv) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE:  onStop");
        },

        /**
         * @name onResume
         * @description Handles Firebug resuming and sets the running state to <code>true</code>.
         * <br><br>
         * Fires an <code>onResume</code> event.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param context the current Crossfire context
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
         * @name onToggleBreakpoint
         * @description Send <code>onToggleBreakpoint</code> event.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param context the current Crossfire context
         * @param url the URL that the breakpoint was toggled within
         * @param lineNo the number of the line the breakpoint was toggled on
         * @param isSet the toggled state of the breakpoint. 
         * <code>true</code> if the breakpoint was toggled on (created), <code>false</code> otherwise
         * @param props a collection of additional properties from Firebug
         * @see FirebugEventAdapter.onToggleBreakpoint
         */
        onToggleBreakpoint: function(context, url, lineNo, isSet, props) {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE: onToggleBreakpoint");
            }
            this.handleEvent(context, "onToggleBreakpoint", {"url":url,"line":lineNo,"set":isSet,"props":props});
        },

        /**
         * @name onToggleErrorBreakpoint
         * @description Send <code>onToggleBreakpoint</code> event.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param context the current Crossfire context
         * @param url the URL that the breakpoint was toggled within
         * @param lineNo the number of the line the breakpoint was toggled on
         * @param isSet the toggled state of the breakpoint. 
         * <code>true</code> if the breakpoint was toggled on (created), <code>false</code> otherwise
         * @param props a collection of additional properties from Firebug
         * @see FirebugEventAdapter.onToggleBreakpoint
         */
        onToggleErrorBreakpoint: function(context, url, lineNo, isSet, props) {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE: onToggleErrorBreakpoint");
            }
            this.onToggleBreakpoint(context, url, lineNo, isSet, props);
        },


        // ----- Firebug HTMLModule listener -----

        /**
         * @name onModifyBreakpoint
         * @description Send <code>onToggleBreakpoint</code> event for HTML breakpoints.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param context the current Crossfire context
         * @param xpath the xpath the breakpoint was modified for
         * @param type the type of the breakpoint
         */
        onModifyBreakpoint: function(context, xpath, type) {
             if (FBTrace.DBG_CROSSFIRE) {
                 FBTrace.sysout("CROSSFIRE: onModifyBreakpoint");
             }
             this.handleEvent(context, "onToggleBreakpoint", {"xpath":xpath,"type":type});
        },


        // ----- Firebug Console listener -----

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
         * @name onInspectNode
         * @description Handles a node being inspected in Firebug.
         * <br><br>
         * Fires an <code>onInspectNode</code> event.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param context the current Crossfire context
         * @param node the node being inspected
         */
        onInspectNode: function(context, node) {
            node = node.wrappedJSObject;
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE onInspectNode", node);
            this.handleEvent(context, "onInspectNode", node);
        },

        /**
         * @name updateStatusIcon
         * @description Update the Crossfire connection status icon.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param status the status to update the icon to
         */
        updateStatusIcon: function( status) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE updateStatusIcon");
            var icon = $("crossfireIcon");
            if (icon) {
                if (status == CROSSFIRE_STATUS.STATUS_CONNECTED_SERVER
                        || status == CROSSFIRE_STATUS.STATUS_CONNECTED_CLIENT) {
                    setClass($("menu_connectCrossfireClient"), "hidden");
                    setClass($("menu_startCrossfireServer"), "hidden");

                    removeClass($("menu_disconnectCrossfire"), "hidden");

                    removeClass(icon, "disconnected");
                    removeClass(icon, "waiting");
                    setClass(icon, "connected");

                } else if (status == CROSSFIRE_STATUS.STATUS_WAIT_SERVER
                        /* TODO: create a separate icon state for 'connecting' */
                        || status == CROSSFIRE_STATUS.STATUS_CONNECTING) {
                    setClass($("menu_connectCrossfireClient"), "hidden");
                    setClass($("menu_startCrossfireServer"), "hidden");

                    removeClass($("menu_disconnectCrossfire"), "hidden");

                    removeClass(icon, "disconnected");
                    removeClass(icon, "connected");
                    setClass(icon, "waiting");

                } else { //we are disconnected if (status == CROSSFIRE_STATUS.STATUS_DISCONNECTED) {
                    setClass($("menu_disconnectCrossfire"), "hidden");
                    removeClass($("menu_connectCrossfireClient"), "hidden");
                    removeClass($("menu_startCrossfireServer"), "hidden");

                    removeClass(icon, "connected");
                    removeClass(icon, "waiting");
                    setClass(icon, "disconnected");
                }
            }
        },

        /**
         * @name updateStatusText
         * @description Updates the Crossfire status text
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param status the status to update the text to
         */
        updateStatusText: function( status) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE updateStatusText: " + status);

            var icon = $("crossfireIcon");

            if (status == CROSSFIRE_STATUS.STATUS_DISCONNECTED) {
                $("crossfireIcon").setAttribute("tooltiptext", "Crossfire: disconnected.");
            } else if (status == CROSSFIRE_STATUS.STATUS_WAIT_SERVER) {
                $("crossfireIcon").setAttribute("tooltiptext", "Crossfire: accepting connections on port " + this.serverPort);
            } else if (status == CROSSFIRE_STATUS.STATUS_CONNECTING) {
                $("crossfireIcon").setAttribute("tooltiptext", "Crossfire: connecting...");
            } else if (status == CROSSFIRE_STATUS.STATUS_CONNECTED_SERVER) {
                $("crossfireIcon").setAttribute("tooltiptext", "Crossfire: connected to client on port " + this.serverPort);
            } else if (status == CROSSFIRE_STATUS.STATUS_CONNECTED_CLIENT) {
                $("crossfireIcon").setAttribute("tooltiptext", "Crossfire: connected to " + this.host + ":" + this.port);
            }

        },

        /**
         * @name setRunning
         * @description Update the Crossfire running status.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param isRunning the desired running state for Crossfire
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

        /**
         * @name onStatusMenuShowing
         * @description Call-back when the menu is showing
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param menu the menu showing
         */
        onStatusMenuShowing: function( menu) {
            if (FBTrace.DBG_CROSSFIRE)
                 FBTrace.sysout("CROSSFIRE onStatusMenuShowing");
        }

    });

    // register module
    Firebug.registerModule(CrossfireModule);


    // ----- Crossfire XUL Event Listeners -----

    /**
     * @name Crossfire.onStatusClick
     * @description Call-back for menu pop-up
     * @function
     * @public
     * @memberOf Crossfire
     * @param el 
     */
    Crossfire.onStatusClick = function( el) {
        $("crossfireStatusMenu").openPopup(el, "before_end", 0,0,false,false);
    };

    /**
     * @name Crossfire.onStatusMenuShowing
     * @description Call-back for the menu showing 
     * @function
     * @public
     * @memberOf Crossfire
     * @param menu the menu showing
     */
    Crossfire.onStatusMenuShowing = function( menu) {
        //CrossfireModule.onStatusMenuShowing(menu);
    };

    /**
     * @name Crossfire.startServer
     * @description Delegate to {@link CrossfireModule#startServer(host, port)}
     * @function
     * @public
     * @memberOf Crossfire
     */
    Crossfire.startServer = function() {
        if (FBTrace.DBG_CROSSFIRE)
            FBTrace.sysout("Crossfire.startServer");
        var params = _getDialogParams(true);
        window.openDialog("chrome://crossfire/content/connect-dialog.xul", "crossfire-connect","chrome,modal,dialog", params);

        if (params.host && params.port) {
            CrossfireModule.startServer(params.host, parseInt(params.port));
        }
    };

    /**
     * @name Crossfire.stopServer
     * @description Traces the function call
     * @function
     * @public
     * @memberOf Crossfire
     */
    Crossfire.stopServer = function() {
         if (FBTrace.DBG_CROSSFIRE)
             FBTrace.sysout("Crossfire.stopServer");
    };

    /**
     * @name Crossfire.connect
     * @description Delegate to {@link CrossfireModule#connectClient(host, port)}
     * @function
     * @public
     * @memberOf Crossfire
     */
    Crossfire.connect = function() {
        if (FBTrace.DBG_CROSSFIRE)
            FBTrace.sysout("Crossfire.connect");
        var params = _getDialogParams(false);

        window.openDialog("chrome://crossfire/content/connect-dialog.xul", "crossfire-connect","chrome,modal,dialog", params);

        if (params.host && params.port) {
            CrossfireModule.connectClient(params.host, parseInt(params.port));
        }
    };

    /**
     * @name Crossfire.disconnect
     * @description delegate to {@link CrossfireModule#disconnect()}
     * @function
     * @public
     * @memberOf Crossfire
     */
    Crossfire.disconnect = function() {
        if (FBTrace.DBG_CROSSFIRE)
            FBTrace.sysout("Crossfire.disconnect");

        CrossfireModule.disconnect();
    };

    /**
     * @name _getDialogParams
     * @description Fetches the entered parameters from the server-start dialog
     * @function
     * @private
     * @memberOf Crossfire
     * @param isServer if the dialog should ask for server start-up parameters or client connect parameters
     * @type Array
     * @returns an Array of dialog parameters
     */
    function _getDialogParams( isServer) {
        var commandLine = Components.classes["@almaden.ibm.com/crossfire/command-line-handler;1"].getService().wrappedJSObject;
        var host = commandLine.getHost();
        var port = commandLine.getPort();

        var title;
        if (isServer) {
            title = "Crossfire - Start Server";
        } else {
            title = "Crossfire - Connect to Server";
        }

        return { "host": null, "port": null, "title": title, "cli_host": host, "cli_port": port };
    };

    /**
     * @name generateId
     * @description generate a unique id for newly created contexts.
     * @function
     * @public
     * @memberOf Crossfire
     * @type String
     * @returns a unique id for newly created contexts
     */
    function generateId() {
        return "xf"+CROSSFIRE_VERSION + "::" + (++CONTEXT_ID_SEED);
    };

//end FBL.ns()
}});