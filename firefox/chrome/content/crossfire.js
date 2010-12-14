/* See license.txt for terms of usage */

/**
 * @name CROSSFIRE_VERSION
 * @description The current version of Crossfire
 * @constant
 * @public
 * @memberOf Crossfire
 * @type String
 */
var CROSSFIRE_VERSION = "0.3";
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

FBL.ns(function() {

    /**
     * @name CrossfireModule
     * @module Firebug Module for Crossfire. This module acts as a controller
     * between Firebug and the remote debug connection.  It is responsible for
     * opening a connection to the remote debug host.
     */
    top.CrossfireModule = FBL.extend(Firebug.Module,  {
        contexts: [],
        dispatchName: "Crossfire",
        toolName: "all", // receive all packets, regardless of 'tool' header

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

            // -- add tools --
            var consoleTool = new Crossfire.ConsoleTool();
            if (FBTrace.DBG_CROSSFIRE_TOOLS)
                FBTrace.sysout("CROSSFIRE created ConsoleTool: " + consoleTool);
            this.registerTool("console", consoleTool);

            var inspectorTool = new Crossfire.InspectorTool();
            if (FBTrace.DBG_CROSSFIRE_TOOLS)
                FBTrace.sysout("CROSSFIRE created InspectorTool: " + inspectorTool);
            this.registerTool("inspector", inspectorTool);

            var netTool = new Crossfire.NetTool();
            if (FBTrace.DBG_CROSSFIRE_TOOLS)
                FBTrace.sysout("CROSSFIRE created NetTool: " + netTool);
            this.registerTool("net", netTool);

            Components.utils.import("resource://crossfire/SocketTransport.js");
            var commandLine = Components.classes["@almaden.ibm.com/crossfire/command-line-handler;1"].getService().wrappedJSObject;
            serverPort = commandLine.getServerPort();
            if (serverPort) {
                this.startServer("localhost", serverPort);
            } else if (host && port) {
                host = commandLine.getHost();
                port = commandLine.getPort();
                this.connectClient(host, port);
            }
            this._clearRefs();
            this._clearBreakpoints();
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
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE connect: host => " + host + " port => " + port);
            }
            this.host = host;
            this.port = port;
            try {
                this._addListeners();

                if (!this.clientTransport) {
                    this.clientTransport = new CrossfireSocketTransport();
                }
                this.clientTransport.addListener(this);
                this.clientTransport.open(host, port);
            }
            catch(e) {
                this._removeListeners();
                if (FBTrace.DBG_CROSSFIRE) FBTrace.sysout(e);
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
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE startServer: host => " + host + " port => " + port);
            }
            this.serverPort = port;
            try {
                this.transport = getCrossfireServer();
                this._addListeners();
                this.transport.addListener(this);

                this.transport.open(host, port);
            } catch(e) {
                if (FBTrace.DBG_CROSSFIRE) FBTrace.sysout("CROSSFIRE failed to start server "+e);
                this._removeListeners();
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
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE _addListeners");

            Firebug.Debugger.addListener(this);
            Firebug.HTMLModule.addListener(this);
        },

        /**
         * @name _removeListeners
         * @description Removes Crossfire as a listener from the core modules
         * @function
         * @private
         * @memberOf CrossfireModule
         * @since 0.3a1
         */
        _removeListeners: function() {
            Firebug.Debugger.removeListener(this);
            Firebug.HTMLModule.removeListener(this);

            this.unregisterTool("console");
            this.unregisterTool("inspector");
            this.unregisterTool("net");
        },

        /**
         * @name stopServer
         * @description Stops the server and closes the socket
         * @function
         * @public
         * @memberOf CrossfireModule
         */
        stopServer: function() {
            try {
                this.transport.close();
            }
            finally {
                this._removeListeners();
                this.transport = null;
                this._clearRefs();
                this._clearBreakpoints();
            }
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
            this._clearRefs();
            this._clearBreakpoints();
        },

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
        _getDialogParams: function(isServer) {
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
        handleRequest: function(request) {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE received request " + request.toSource());
            }
            var command = request.command;
            var response;
            var args = (request.arguments ? request.arguments : []);
            if (command == "listcontexts") {
                response = this.listContexts();
            } else if (command == "version") {
                response =  { "version": CROSSFIRE_VERSION };
            }
            else if(command == "getbreakpoint") {
                response = this.getBreakpoint(args);
            }
            else {
                var context = this.findContext(request.context_id);
                if(context) {
                    if(command == "backtrace") {
                        response = this.getBacktrace(context, args);
                    }
                    else if(command == "changebreakpoint") {
                        response = this.changeBreakpoint(context, args);
                    }
                    else if(command == "clearbreakpoint") {
                        response = this.clearBreakpoint(context, args);
                    }
                    else if(command == "continue") {
                        response = this.doContinue(context);
                    }
                    else if(command == "evaluate") {
                        response = this.doEvaluate(context, args);
                    }
                    else if(command == "frame") {
                        response = this.getFrame(context, args);
                    }
                    else if(command == "getbreakpoints") {
                        response = this.getBreakpoints(context);
                    }
                    else if(command == "lookup") {
                        response = this.doLookup(context, args);
                    }
                    else if(command == "scopes") {
                        response = this.getScopes(context, args);
                    }
                    else if(command == "scope") {
                        response = this.getScope(context, args);
                    }
                    else if(command == "script") {
                        response = this.getScript(context, args);
                    }
                    else if(command == "scripts") {
                        response = this.getScripts(context, args);
                    }
                    else if(command == "setbreakpoint") {
                        response = this.setBreakpoint(context, args);
                    }
                    else if(command == "source") {
                        response = this.getSource(context, args);
                    }
                    else if(command == "suspend") {
                        response = this.doSuspend(context);
                    }
                }
            }
            if (response) {
                if (FBTrace.DBG_CROSSFIRE) {
                    FBTrace.sysout("CROSSFIRE sending success response => " + response);
                }
                this.transport.sendResponse(command, request.seq, response, this.running, true);
            } else {
                 if (FBTrace.DBG_CROSSFIRE) {
                     FBTrace.sysout("CROSSFIRE sending failure response => " + response);
                 }
                this.transport.sendResponse(command, request.seq, {}, this.running, false);
            }
        },

        fireEvent: function(packet)
        {
            FBL.dispatch(this.fbListeners, "onExecute", [packet]);
        },

        /**
         * @name findContext
         * @description Returns the Context for the given id, or <code>null</code> if no context matches the given id
         * @function
         * @memberOf CrossfireModule
         * @param the String id to look up
         * @type Context
         * @returns the Context for the given id or <code>null</code>
         * @since 0.3a1
         */
        findContext: function(contextid) {
            for (var i = 0; i < this.contexts.length; i++) {
                var context = this.contexts[i];
                if (contextid == context.Crossfire.crossfire_id) {
                    return context;
                }
            }
            return null;
        },

        /**
         * @name getBacktrace
         * @description Returns a backtrace (stacktrace) of frames.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @type Array
         * @returns an {@link Array} of the backtrace information or <code>null</code> if the backtrace could not be computed
         * @param context the associated context {@link Object}
         * @param args the argument {@link Array} which contains:
         * <ul>
         * <li>an {@link Integer} <code>fromFrame</code>, which denotes the stack frame to start the backtrace from</li>
         * <li>optionally an {@link Integer} <code>toFrame</code>, which denotes the stack frame to end the backtrace at. If
         * left out all stack frames will be included in the backtrace</li>
         * <li>and optionally a {@link Boolean} <code>includeScopes</code>, which will cause the associated scopes to be included
         * in the backtrace or not.</li>
         * </ul>
         * @since 0.3a1
         */
        getBacktrace: function(context, args) {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE backtrace");
            }
            if (context && context.Crossfire.currentFrame) {
                if(!args) {
                    args = [];
                }
                var fromFrame, toFrame;
                var stack = context.Crossfire.currentFrame.stack;
                var scopes = args["includeScopes"];
                if(!scopes) {
                    scopes = true;
                }
                if (stack) {
                    fromFrame = args["fromFrame"] || 0;
                    // toFrame set to stack.length if not set, or if set to a number higher than the stack sizes
                    toFrame = (args["toFrame"] && args["toFrame"] <= stack.length) ? args["toFrame"] : stack.length;
                } else {
                    // issue 2559: if there is only one frame, stack is undefined,
                    // but we still want to return that frame.
                    fromFrame = 0;
                    toFrame = 1;
                }
                var frame;
                var frames = [];
                for (var i = fromFrame; i <= toFrame; i++) {
                    frame = this.getFrame(context, {"number": i, "includeScopes": scopes});
                    if (frame) {
                        delete frame.context_id;
                        frames.push(frame);
                    }
                }
                return {
                    "context_id": context.Crossfire.crossfire_id,
                    "fromFrame": 0,
                    "toFrame": frames.length-1,
                    "totalFrames": frames.length,
                    "frames": frames
                };
            }
            return null;
        },

        /**
         * @name changeBreakpoint
         * @description Changes the specified breakpoint, if it exists, with the given information. If the change was successful
         * the new breakpoint information is returned.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @type Array
         * @returns an {@link Array} of the new breakpoint information or <code>null</code> if the change did not succeed.
         * @param context the associated context {@link Object}
         * @param args the array of arguments which contains:
         * <ul>
         * <li>an {@link Integer} <code>breakpoint</code>, which is the id of the breakpoint to change</li>
         * </ul>
         * @since 0.3a1
         */
        changeBreakpoint: function(context, args) {
            var bp,
            condition,
            enabled = true,
            success = false,
            fbs = FBL.fbs;

            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE changeBreakpoint: args => " + args.toSource());

            try {
                bp = this.getBreakpoint(args);

                if (bp) {

                    if (typeof (args["condition"]) != "undefined") {
                        condition = args["condition"];

                        if (FBTrace.DBG_CROSSFIRE)
                            FBTrace.sysout("CROSSFIRE changeBreakpoint set condition => " + condition);

                        fbs.setBreakpointCondition({"href": bp.target}, bp.line, condition, Firebug.Debugger);
                        success = true;
                    }

                    if (typeof (args["enabled"]) != "undefined") {
                        enabled = !!args["enabled"];
                        if (FBTrace.DBG_CROSSFIRE)
                            FBTrace.sysout("CROSSFIRE changeBreakpoint set enabled => " + enabled);

                        if (enabled) {
                            fbs.enableBreakpoint(bp.target, bp.line);
                        } else {
                            fbs.disableBreakpoint(bp.target, bp.line);
                        }
                        bp.enabled = enabled;

                        success = true;
                    }
                }
            } catch ( e) {
                if (FBTrace.DBG_CROSSFIRE)
                    FBTrace.sysout("CROSSFIRE changeBreakpoint exception: " + e);
                success = false;
            }

            if (success) {
                return {"context_id": context.Crossfire.crossfire_id, "breakpoint": bp.handle};
            } else {
                return null;
            }
        },

        /**
         * @name clearBreakpoint
         * @description Remove the breakpoint object with the specified id.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @type Array
         * @returns an {@link Array} of the breakpoint information that was cleared
         * @param context the associated context {@link Object}
         * @param args the array of arguments which contains:
         * <ul>
         * <li>an {@link Integer} <code>handle</code>, which is the id of the breakpoint to clear</li>
         * <li>an {@link String} <code>target</code>, which is the URL of the script the breakpoint is set on</li>
         * <li>and an {@link Integer} <code>line</code>, which is the line number the breakpoint is set on</li>
         * </ul>
         * <br><br>
         * Either the breakpoint handle or the URL / line number can be given to clear a breakpoint - if both are given the breakpoint
         * handle is consulted first.
         * @since 0.3a1
         */
        clearBreakpoint: function(context, args) {
            if(this.breakpoints) {
                var bpId = args["handle"];
                var target = args["target"];
                var line = args["line"];
                if (bpId || (target && line)) {
                    for (var i = 0; i < this.breakpoints.length; i++) {
                        if ((bpId && this.breakpoints[i].handle == bpId)
                            || (target && line && this.breakpoints[i].target == target && this.breakpoints[i].line == line) ) {
                            var breakpoint = this.breakpoints[i];
                            Firebug.Debugger.clearBreakpoint({"href": breakpoint.target }, breakpoint.line);
                            this.breakpoints.splice(i, 1);
                            return {"context_id": context.Crossfire.crossfire_id, "breakpoint": breakpoint.handle};
                        }
                    }
                    // if we get here crossfire didn't know about the breakpoint,
                    // but if we have target and line arguments, try to clear it anyway.
                    if (target && line) {
                        Firebug.Debugger.clearBreakpoint({"href": target}, line);
                        return {"context_id": context.Crossfire.crossfire_id};
                    }
                }
            }
            return null;
        },

        /**
         * @name doContinue
         * @description Continue execution of JavaScript if suspended, if no <code>stepaction</code> is passed, simply resumes execution.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @type Array
         * @returns always returns an empty array
         * @param context the associated context {@link Object}
         * @param args the array of arguments which contains:
         * <ul>
         * <li>optionally a {@link String} <code>stepaction</code>, which can be one of 'in', 'next', or 'out' </li>
         * <li>optionally an {@link Integer} <code>stepcount</code>, which denotes how many steps to take - NO IMPLEMENTED YET</li>
         * </ul>
         * @since 0.3a1
         */
        doContinue: function(context, args) {
            var stepAction = null;
            if(args) {
                stepAction = args["stepaction"];
            }
            if (stepAction == "in") {
                Firebug.Debugger.stepInto(context);
            } else if (stepAction == "next") {
                Firebug.Debugger.stepOver(context);
            } else if (stepAction == "out") {
                Firebug.Debugger.stepOut(context);
            } else {
                Firebug.Debugger.resume(context);
            }
            return {};
        },

        /**
         * @name doEvaluate
         * @description Evaluate a Javascript expression.
         * If a frame argument is passed, evaluates the expression in that frame,
         * otherwise the expression is evaluated in the context's global scope.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @type Array
         * @returns an {@link Array} of the value returned from the evaluation
         * @param context the associated context {@link Object}
         * @param args the array of arguments which contains:
         * <ul>
         * <li>optionally an {@link Integer} <code>frame</code>, which is the index of the stackframe in the current stack to evaluate in</li>
         * <li>a {@link String} <code>expression</code>, which is what will be evaluated</li>
         * </ul>
         * @since 0.3a1
         */
        doEvaluate: function(context, args) {
            var frameNo = args["frame"];
            var expression = args["expression"];
            var frame;
            if (context.Crossfire.currentFrame) {
                if (frameNo == 0) {
                    frame = context.Crossfire.currentFrame;
                } else if (frameNo > 0) {
                    frame = context.Crossfire.currentFrame.stack[frameNo];
                }
            }
            var result = {};
            var contextId = context.Crossfire.crossfire_id;
            if (frame) {
                if (frame.eval(expression, "crossfire_eval_" + contextId, 1, result)) {
                    result = unwrapIValue(result.value);
                }
            } else {
                Firebug.CommandLine.evaluate(expression, this.context,null,null,function(r){
                    result = r;
                },function(){
                    throw new Error("Failure to evaluate expression: " + expression);
                });
            }
            return {"context_id": contextId, "result": result};
        },

        /**
         * @name getFrame
         * @description Returns a new stack frame object.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @type Array
         * @returns an {@link Array} of the new frame information
         * @param context the associated context {@link Object}
         * @param args the array of arguments which contains:
         * <ul>
         * <li>an {@link Integer} <code>number</code>, which is the index of the frame in the current stack</li>
         * <li>a {@link Boolean} <code>includeScopes</code>, which denotes if the associated scopes should be returned as well</li>
         * </ul>
         * @since 0.3a1
         */
        getFrame: function(context, args) {
            var number = args["number"];
            var includeScopes = args["includeScopes"];
            if(!includeScopes) {
                includeScopes = true;
            }
            var frame = context.Crossfire.currentFrame;
            if (frame) {
                if (!number) {
                    number = 0;
                } else if (frame.stack) {
                    frame = frame.stack[number-1];
                }
                try {
                    var locals = {};
                    for (var l in frame.scope) {
                        if (l != "parent") { // ignore parent
                            locals[l] = frame.scope[l];
                        }
                    }
                    if (frame.thisValue) {
                        locals["this"] = frame.thisValue;
                    }
                    if (includeScopes) {
                        var scopes = (this.getScopes(context, {"frameNumber": number })).scopes;
                    }
                    return { "context_id": context.Crossfire.crossfire_id,
                        "index": frame.frameIndex,
                        "func": frame.functionName,
                        "script": frame.script,
                        "locals": locals,
                        "line": frame.line,
                        "scopes": scopes };
                } catch (exc) {
                    if (FBTrace.DBG_CROSSFIRE) {
                        FBTrace.sysout("CROSSFIRE exception returning frame ", exc);
                    }
                }
            }
            return null;
        },

        /**
         * @name getBreakpoint
         * @description Returns the breakpoint object with the specified id. This function will not
         * ping Firebug for breakpoints, it only returns a mapped breakpoint that Crossfire knows about.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @type Array
         * @returns an {@link Array} of the breakpoint information or <code>null</code> if the breakpoint could not be found.
         * @param context the associated context {@link Object}
         * @param args the array of arguments which contains:
         * <ul>
         * <li>an {@link Integer} <code>breakpoint</code>, which is the id of the breakpoint to return</li>
         * </ul>
         * @since 0.3a1
         */
        getBreakpoint: function(args) {
            var handle = args["breakpoint"];
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE getBreakpoint with handle: " + handle);

            for (var i in this.breakpoints) {
                var bp = this.breakpoints[i];
                if (bp && bp.handle == handle) {
                    return bp;
                }
            }
            return null;
        },

        /**
         * @name getBreakpoints
         * @description Returns all the breakpoints. This method requests all breakpoints from Firebug directly
         * for all known source files.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @type Array
         * @returns an {@link Array} of all breakpoints information or <code>null</code> if there are no breakpoints set.
         * @param context the associated context {@link Object}
         * @since 0.3a1
         */
        getBreakpoints: function(context) {
            var found,
            bp,
            bps = [],
            self = this;

            FBTrace.sysout("this.breakpoints => " + this.breakpoints);
            for (var url in context.sourceFileMap) {
                FBL.fbs.enumerateBreakpoints(url, {"call": function(url, line, props, script) {
                    FBTrace.sysout("CROSSFIRE enumerating breakpoints called for: " + url + " line: " +line);
                    FBTrace.sysout("got a bp at line: " + line + "with props: " + props.toSource());
                    found = false;
                    if (self.breakpoints) {
                        for(var i in self.breakpoints) {
                            bp = self.breakpoints[i];
                            FBTrace.sysout("checking bp " +bp.target +"@"+bp.line);
                            if((bp.target == props.href) && (bp.line == props.lineNo)) {
                                FBTrace.sysout("matched: " + bp.toSource());
                                found = true;
                                bps.push(bp);
                                break;
                            }
                        }
                    }
                    if (!found) {
                        bp = {
                                "handle": self.breakpointIds++,
                                "type": "line",
                                "line": line,
                                "target": url,
                                "enabled": !props.disabled
                            };
                        bps.push(bp);
                    }
                }});
            }
            this.breakpoints = bps;
            return {"context_id": context.Crossfire.crossfire_id, "breakpoints": bps};
        },

        /**
         * @name doLookup
         * @description Lookup an object by it's handle.
         * @private
         * @memberOf CrossfireModule
         * @type Array
         * @returns an {@link Array} of the serialized object with the given id or <code>null</code> if the given id does not represent
         * an existing object
         * @param context the associated context {@link Object}
         * @param args the arguments array that contains:
         * <ul>
         * <li>an {@link Integer} <code>handle</code>, which is the id of the object to look up</li>
         * </ul>
         * @since 0.3a1
         */
        doLookup: function(context, args) {
            var handle = args["handle"];
            var source = args["includeSource"];
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE doLookup: handle => " + handle);
            }
            if (handle) {
                var obj;
                for (var i in this.refs) {
                    if (i == handle) {
                        obj = this.refs[i];
                        var arr = this._serialize(obj);
                        if(source) {
                            try {
                                var src = obj.toSource();
                                if(src) {
                                    arr["source"] = src;
                                }
                            }
                            catch(e) {}
                            var cid = context.Crossfire.crossfire_id;
                            arr["context_id"] = cid;
                            return arr;
                        }
                        return arr;
                    }
                }
            }
            return null;
        },

        /**
         * @name getScopes
         * @description  Returns all the scopes for a frame.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @type Array
         * @returns the {@link Array} of scopes for a given frame number or <code>null</code>
         * @param context the associated context {@link Object}
         * @param args the request arguments that contains:
         * <ul>
         * <li>an {@link Integer} <code>number</code>, which is the number of scopes to return</li>
         * <li>an {@link Integer} <code>frameNumber</code>, which is the number of the stack frame to collect scopes from</li>
         * </ul>
         * @since 0.3a1
         */
        getScopes: function(context, args) {
            var scopes = [];
            var scope;
            do {
                scope = this.getScope(context, {"number": scopes.length, "frameNumber":  args["frameNumber"]});
                if (scope) {
                    delete scope.context_id;
                    scopes.push(scope);
                }
            } while(scope);
            if (scopes.length > 0) {
              return {
                  "context_id": context.Crossfire.crossfire_id,
                  "fromScope": 0,
                  "toScope": scopes.length-1,
                  "totalScopes": scopes.length,
                  "scopes": scopes
              };
            }
            return null;
        },

        /**
         * @name getScope
         * @description Returns a scope for the specified frame.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @type Array
         * @returns the scope information for the specified frame or <code>null</code>
         * @param context the associated context {@link Object}
         * @param args the arguments array that contains:
         * <ul>
         * <li>an {@link Integer} <code>number</code>, which is the number of enclosing scopes to include</li>
         * <li>an {@link Integer} <code>frameNumber</code>, which is the index of the frame to collect the scopes from</li>
         * </ul>
         * @since 0.3a1
         */
        getScope: function(context, args) {
            var scope;
            var scopeNo = args["number"];
            var frameNo = args["frameNumber"];
            if (context.Crossfire.currentFrame) {
                if (scopeNo == 0) {
                    // only return a reference to the global scope
                    scope = this._getRef(context.window.wrappedJSObject);
                } else {
                    var frame = context.Crossfire.currentFrame;
                    if (!frameNo) {
                        frameNo = 0;
                    } else {
                        frame = frame.stack[frameNo-1];
                    }
                    scope = frame.scope;
                    for (var i = 0; i < scopeNo; i++) {
                        scope = scope.parent;
                        if (!scope) break;
                    }
                }
            } else if (scopeNo == 0) {
              scope = context.window.wrappedJSObject;
              frameNo = -1;
            }
            if (scope) {
                return {
                    "context_id": context.Crossfire.crossfire_id,
                    "index": scopeNo,
                    "frameIndex": frameNo,
                    "object": scope
                };
            }
            return null;
        },

        /**
         * @name getScripts
         * @description Retrieve all known scripts and optionally their source.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @type Array
         * @returns the currently known script information from the source map
         * @param context the associated context {@link Object}
         * @param args the arguments array that contains:
         * <ul>
         * <li>a {@link Boolean} <code>includeSource</code>, if the source for all of the scripts should be included in the response</li>
         * </ul>
         * @since 0.3a1
         */
        getScripts: function (context, args) {
            var incSrc = args["includeSource"];
            var srcMap = context.sourceFileMap;
            var scripts = [];
            var script;
            for (var url in srcMap) {
                if(url) {
                    script = this.getScript(context, { "url": url, "includeSource": incSrc });
                    if (script) {
                        delete script.context_id;
                        scripts.push( script );
                    }
                }
            }
            return {"context_id": context.Crossfire.crossfire_id, "scripts": scripts};
        },

        /**
         * @name getScript
         * @description Retrieve a single script and optionally its source.
         * @function
         * @private
         * @memberOf CrossfireModule
         * @type Array
         * @returns the currently known script information from the source map
         * @param context the associated context {@link Object}
         * @param args the arguments array that contains:
         * <ul>
         * <li>a {@link String} <code>url</code>, the URL of the script to get</li>
         * <li>optionally a {@link Boolean} <code>includeSource</code>, if the source for the script should be included in the response</li>
         * </ul>
         * @since 0.3a1
         */
        getScript: function(context, args) {
            var sourceFile, script;
            var incSrc = args["includeSource"];
            var url = args["url"];
            sourceFile = context.sourceFileMap[url];
            var lines = [];
            try {
                lines = sourceFile.loadScriptLines(context);
            } catch (ex) {
                if (FBTrace.DBG_CROSSFIRE) {
                    FBTrace.sysout("CROSSFIRE: failed to get source lines for script: "+url+" - exception: " +ex);
                }
            }
            var srcLen;
            try {
                srcLen = sourceFile.getSourceLength();
            } catch(exc) {
                if (FBTrace.DBG_CROSSFIRE) {
                    FBTrace.sysout("CROSSFIRE: failed to get source length for script : " +exc);
                }
                srcLen = 0;
            }
            script = {
                "id": url,
                "lineOffset": 0,
                "columnOffset": 0,
                "sourceStart": lines[0],
                "sourceLength":srcLen,
                "lineCount": lines.length,
                "compilationType": sourceFile.compilation_unit_type,
            };
            if (incSrc) {
                script["source"] = lines.join(' ');
            }
            return { "context_id": context.Crossfire.crossfire_id, "script": script };
        },

        /**
         * @name setBreakpoint
         * @description Set a breakpoint and return its {@link Integer} id.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @type Array
         * @returns the {@link Array} of breakpoint information if the set
         * @param context the associated context {@link Object}
         * @param args the arguments array that contains:
         * <ul>
         * <li>a {@link String} <code>target</code>, the URL of the target script to set the breakpoint in</li>
         * <li>an {@link Integer} <code>line</code>, the line number to set the breakpoint on</li>
         * <ul>
         * @since 0.3a1
         */
        setBreakpoint: function(context, args) {
            var bp,
            breakpoint,
            sourceFile,
            condition,
            enabled = true,
            url = args["target"],
            line = args["line"],
            breakpoints = this.breakpoints,
            fbs = FBL.fbs;

            if (typeof (args["condition"]) != "undefined") {
                condition = args["condition"];
            }

            if (typeof (args["enabled"]) != "undefined") {
                enabled = !!args["enabled"];
            }

            for (var i = 0; i < breakpoints.length; i++) {
                bp = breakpoints[i];
                if (bp.line == line
                    && bp.url == url) {
                    breakpoint = bp;
                    break;
                }
            }
            if (!breakpoint) {
                breakpoint = {
                    "handle": this.breakpointIds++,
                    "type": "line",
                    "line": line,
                    "target": url,
                    "enabled": enabled,
                };

                if (condition) {
                    breakpoint.condition = condition;
                }
                breakpoints.push(breakpoint);
                sourceFile = context.sourceFileMap[url];
                if (sourceFile) {
                    Firebug.Debugger.setBreakpoint(sourceFile, line);
                }

                if (condition) {
                    fbs.setBreakpointCondition({"href": target}, line, condition, Firebug.Debugger);
                }

                // by default, setting a new breakpoint is enabled, so only check if we want to disable it.
                if (!enabled) {
                    fbs.disableBreakpoint(bp.target, bp.line);
                }
            }
            return {"context_id": context.Crossfire.crossfire_id, "breakpoint": breakpoint};
        },

        /**
         * @name getSource
         * @description Returns the source code for every script in the requested context
         * @function
         * @public
         * @memberOf CrossfireModule
         * @type Array
         * @returns an {@link Array} containing the source for all of the currently known scripts from the Firebug source map
         * @param context the associated context {@link Object}
         * @param args the arguments array. If the {@link Boolean} <code>includeSource</code> argument is not present it is added and set to <code>true</code>
         * @since 0.3a1
         */
        getSource: function(context, args) {
            args = args || {};
            args["includeSource"] = true;
            return this.getScripts(context, args);
        },

        /**
         * @name doSuspend
         * @description Try to suspend any currently running Javascript.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @type Array
         * @returns always returns <code>null</code>
         * @since 0.3a1
         */
        doSuspend: function(context) {
            Firebug.Debugger.suspend(context);
            return {};
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
         * @name _sendEvent
         * @description Sends the given event data over the backing transport
         * @function
         * @private
         * @memberOf CrossfireModule
         * @param event the String name for the event
         * @param data the data Array for the event packet
         * @since 0.3a1
         */
        _sendEvent: function(event, data) {
            if (this.transport && this.status == CROSSFIRE_STATUS.STATUS_CONNECTED_SERVER) {
                if (FBTrace.DBG_CROSSFIRE)
                    FBTrace.sysout("CROSSFIRE: _sendEvent => " + event + " ["+data+"]");
                this.transport.sendEvent(event, data);
            }
        },

        // ----- Crossfire Protocol Extensions (Tools API) -----

        registeredTools: {},

        /**
         *
         */
        registerTool: function( toolName, toolListener) {
            if (FBTrace.DBG_CROSSFIRE_TOOLS)
                FBTrace.sysout("CROSSFIRE: registerTool " + toolName, toolListener);

            try {
                this.registeredTools[toolName] = toolListener;
                if (toolListener.onRegistered) {
                    toolListener.onRegistered();
                }
            } catch(e) {
                if (FBTrace.DBG_CROSSFIRE_TOOLS)
                    FBTrace.sysout("CROSSFIRE: registerTool fails: " + e, e);
            }

        },

        /**
         *
         */
        unregisterTool: function( toolName) {
            if (FBTrace.DBG_CROSSFIRE_TOOLS)
                FBTrace.sysout("CROSSFIRE: unregisterTool " + toolName);
            try {
                var tool = this.registeredTools[toolName];
                delete this.registeredTools[toolName];
                if (tool.onUnregistered)
                tool.onUnregistered();
            } catch (e) {
                if (FBTrace.DBG_CROSSFIRE_TOOLS)
                    FBTrace.sysout("CROSSFIRE: unregisterTool fails: " + e, e);
            }
        },

        activateTool: function( toolName) {
            if (toolName in this.registeredTools) {
                 if (FBTrace.DBG_CROSSFIRE_TOOLS)
                     FBTrace.sysout("Crossfire activating tool: " + toolName);
                 try {
                     this.registeredTools[toolName].onTransportCreated(this.transport);
                 } catch (e) {
                     FBTrace.sysout("exception deactivationg tool: " + e);
                 }
            }
        },

        deactivateTool: function( toolName) {
            if (toolName in this.registeredTools) {
                if (FBTrace.DBG_CROSSFIRE_TOOLS)
                    FBTrace.sysout("Crossfire activating tool: " + toolName);
                try {
                    this.registeredTools[toolName].onTransportDestroyed(this.transport);
                } catch (e) {
                    FBTrace.sysout("exception deactivationg tool: " + e);
                }
            }
        },

        /**
         *
         */
        getTools: function() {
            var tools = [];
            for (var name in this.registeredTools) {
                tools.push(name);
            }
            return tools;
        },

        /**
         *
         */
        getToolDescription: function(moduleName /* , moduleName, moduleName */) {
            var desc, tool, toolInfo = [];
            for (var arg in arguments) {
                tool = this.registeredTools[arg];
                if (tool) {
                    if (typeof(tool.getDescription) == "function") {
                        desc = tool.getDescription();
                    } else {
                        desc = "";
                    }
                    toolInfo[arg] = {
                        "name": tool.toolName,
                        "desc": desc,
                        "commands": tool.commands,
                        "events": tool.events
                    };
                }
            }
            return toolInfo;
        },


        /**
         * A Tool is an extension that registers itself to crossfire
         * for the purpose of sending and receiving commands and events
         * via the crossfire protocol/connection.
         */
        ToolListener: {

            commands: [],
            events: [],

            supportsRequest: function( request) {
                // default is return true if the command name is in our array of commands
                return (request.command && request.command in this.commands);
            },

            handleRequest: function( request) {

            },

            supportsEvent: function( event) {
                // default is return true if the event name is in our array of events
                return (event.name && event.name in this.events);
            },

            handleEvent: function( event) {

            },

            onTransportCreated: function( transport) {
                if (FBTrace.DBG_CROSSFIRE_TOOLS)
                    FBTrace.sysout("onTransportCreated recieved by: " + this.toolName);
                this.transport = transport;
                this.transport.addListener(this);
            },

            onTransportDestroyed: function() {

            },

            onRegistered: function() {

            },

            onUnregistered: function() {

            },

            onConnectionStatusChanged: function( status) {

            },

            getDescription: function() {

            }
        },

        // ----- firebug listeners -----
        /**
         * @name onSourceFileCreated
         * @description Handles a script being loaded - i.e. a script has been compiled in the current context.
         * <br><br>
         * Fires an <code>onScript</code> event.
         * <br><br>
         * The event body contains the following:
         * <ul>
         * <li><code>context_id</code> - the id of the current Crossfire context</li>
         * <li><code>data</code> - the event payload from Firebug</li>
         * </ul>
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param context the context of this event
         * @param sourceFile the source file object
         */
        onSourceFileCreated: function( context, sourceFile) {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE:  onSourceFileCreated => " + sourceFile.href);
            }
            var context_href = "";
            try {
                context_href = context.window.location.href;
            } catch(e) {
            }
            this.sourceFileLoaded(sourceFile);
            var data = { "href": sourceFile.href, "context_href": context_href };
            this._sendEvent("onScript", {"context_id": context.Crossfire.crossfire_id, "data": data});
        },

        // ----- context listeners -----
        /**
         * @name initContext
         * @description Handles a context being created - i.e. a new tab has been opened.
         * <br><br>
         * Fires an <code>onContextCreated</code> event.
         * <br><br>
         * The event body contains the following:
         * <ul>
         * <li><code>context_id</code> - the id of the current Crossfire context</li>
         * <li><code>data</code> - the event payload with the <code>href</code> value set</li>
         * </ul>
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param context the new context
         */
        initContext: function( context) {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE:  initContext");
            }
            context.Crossfire = { "crossfire_id" : this._generateId() };
            this.contexts.push(context);
            var href = "";
            try {
                href = context.window.location.href;
            } catch(e) {
                //do nothing
            }
            this._sendEvent("onContextCreated", { "context_id": context.Crossfire.crossfire_id, "data": {"href": href}});
        },


        /**
         * @name loadedContext
         * @description Handles a context being loaded - i.e. the scripts in a given context have completed being compiled.
         * <br><br>
         * Fires an <code>onContextLoaded</code> event.
         * <br><br>
         * The event body contains the following:
         * <ul>
         * <li><code>context_id</code> - the id of the current Crossfire context</li>
         * <li><code>data</code> - the event payload with the <code>href</code> value set</li>
         * </ul>
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param context the context that completed loading
         */
        loadedContext: function( context) {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE:  loadedContext");
            }
            var href = "";
            try {
                href = context.window.location.href;
            } catch(e) {
                //do nothing
            }
            this._sendEvent("onContextLoaded", {"context_id": context.Crossfire.crossfire_id, "data": {"href": href}});
        },

        /**
         * @name showContext
         * @description Handles a context being shown - i.e. a tab has been switched to.
         * <br><br>
         * Fires an <code>onContextChanged</code> event
         * <br><br>
         * The event body contains the following:
         * <ul>
         * <li><code>context_id</code> - the id of the current Crossfire context</li>
         * <li><code>new_context_id</code> - the id of the Crossfire context switched to</li>
         * <li><code>data</code> - the event payload with the <code>href</code> and <code>new_href</code> values set</li>
         * </ul>
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param browser the browser the context was changed to in
         * @param context the context that was switched to
         */
        showContext: function(browser, context) {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE:  showContext");
            }
            if(context && this.currentContext && this.currentContext.Crossfire) {
                var href =  this.currentContext.window.location.href;
                var newHref =  context.window.location.href;
                if(href != newHref) {
                    this._sendEvent("onContextChanged", {"context_id": this.currentContext.Crossfire.crossfire_id, "new_context_id": context.Crossfire.crossfire_id, "data": {"href": href, "new_href": newHref}});
                }
            }
            this.currentContext = context;
        },

        /**
         * @name destroyContext
         * @description Handles a context being destroyed - i.e. a tab has been closed in the browser.
         * <br><br>
         * Fires an <code>onContextDestroyed</code> event.
         * <br><br>
         * The event body contains the following:
         * <ul>
         * <li><code>context_id</code> - the id of the current Crossfire context</li>
         * </ul>
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param context the context that has been destroyed
         */
        destroyContext: function(context) {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE: destroyContext");
            }
            var contextId = context.Crossfire.crossfire_id;
            for (var i = 0; i < this.contexts.length; i++) {
                if (this.contexts[i].Crossfire.crossfire_id == contextId) {
                    delete this.contexts[i].Crossfire.currentFrame;
                    this._sendEvent("onContextDestroyed", {"context_id": this.contexts[i].Crossfire.crossfire_id});
                    this.contexts.splice(i, 1);
                    break;
                }
            }
        },

        /**
         * @name listContexts
         * @description Called in response to a <code>listcontexts</code> command.
         * This method returns all the context id's that we know about.
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

        // ----- helpers

        /**
         * @name _generateId
         * @description Generates a unique id to map to a Firebug context
         * @function
         * @private
         * @memberOf CrossfireModule
         * @type String
         * @return a new ID to map to a Firebug context
         * @since 0.3a2
         */
        _generateId: function() {
            return "xf"+CROSSFIRE_VERSION + "::" + (++CONTEXT_ID_SEED);
        },

        /**
         * @name _copyFrame
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
        _copyFrame: function(frame, ctx, shouldCopyStack) {
            if (ctx) {
                var context = ctx;
            }
            var frameCopy = {};
            // recursively copy scope chain
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
                frameCopy["scope"] = this._copyScope(frame.scope);
                if (frame.thisValue) {
                    if (FBTrace.DBG_CROSSFIRE_FRAMES)
                        FBTrace.sysout("copying thisValue from frame...");
                    try {
                       var thisVal = frame.thisValue.getWrappedValue();
                       frameCopy["thisValue"] = this._serialize(thisVal);
                    } catch( e) {
                        if (FBTrace.DBG_CROSSFIRE) FBTrace.sysout("Exception copying thisValue => " + e);
                    }
                } else if (FBTrace.DBG_CROSSFIRE_FRAMES) {
                    FBTrace.sysout("no thisValue in frame");
                }
                frameCopy["functionName"] = frame.functionName;
                // copy eval so we can call it from 'evaluate' command
                frameCopy["eval"] = function() { return frame.eval.apply(frame, arguments); };
                if (shouldCopyStack) {
                    if (frame.callingFrame) {
                        var stack = this._copyStack(frame.callingFrame, ctx);
                        frameCopy["stack"] = stack;
                        frameCopy["frameIndex"] = stack.length -1;
                    } else {
                        frameCopy["frameIndex"] = 0;
                    }
                }
            }
            return frameCopy;
        },

        /**
         * @name _copyStack
         * @description recursively copies all of the stack elements from the given frame
         * @function
         * @private
         * @memberOf CrossfireModule
         * @param the current frame
         * @type Array
         * @returns the Array for the copied stack
         * @since 0.3a1
         */
        _copyStack: function(aFrame, aCtx) {
            if (FBTrace.DBG_CROSSFIRE_FRAMES) {}
                FBTrace.sysout("CROSSFIRE copyStack: calling frame is => ", aFrame.callingFrame);
            if (aFrame.callingFrame && aFrame.callingFrame.isValid) {
                var stack = this._copyStack(aFrame.callingFrame);
                stack.splice(0,0,this._copyFrame(aFrame, aCtx, false));
                return stack;
            } else {
                return [ this._copyFrame(aFrame, aCtx, false) ];
            }
        },

        /**
         * @name _copyScope
         * @description recursively copies the given scope and returns a new serialized scope
         * @function
         * @private
         * @memberOf CrossfireModule
         * @param the scope to copy
         * @type String
         * @returns the {@link String} serialized copied scope
         * @since 0.3a1
         */
        _copyScope: function(aScope) {
            if (FBTrace.DBG_CROSSFIRE_FRAMES) {
                FBTrace.sysout("Copying scope => ", aScope);
            }
            var copiedScope = {};
            try {
                var listValue = {value: null}, lengthValue = {value: 0};
                aScope.getProperties(listValue, lengthValue);
                for (var i = 0; i < lengthValue.value; ++i) {
                    var prop = listValue.value[i];
                    var name = prop.name.getWrappedValue();
                       copiedScope[name.toString()] = prop.value.getWrappedValue();
                }
            } catch (ex) {
                if (FBTrace.DBG_CROSSFIRE_FRAMES) FBTrace.sysout("Exception copying scope => " + e);
            }
            return this._serialize(copiedScope);
        },

        // ----- Firebug Debugger listener -----

        /**
         * @name onStartDebugging
         * @description Handles Firebug suspending.
         * <br><br>
         * Fires an <code>onBreak</code> event.
         * <br><br>
         * The event body contains the following:
         * <ul>
         * <li><code>context_id</code> - the id of the current Crossfire context</li>
         * <li><code>data</code> - the event payload from Firebug with the <code>url</code> and <code>line</code> values set</li>
         * </ul>
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param context the current Crossfire context
         */
        onStartDebugging: function(context) {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE:  onStartDebugging");
            }
            var frame = context.stoppedFrame;
            var lineno = 1;
            var sourceFile = Firebug.SourceFile.getSourceFileByScript(context, frame.script)
            if (sourceFile) {
                var analyzer = sourceFile.getScriptAnalyzer(frame.script);
                if (analyzer) {
                    lineno = analyzer.getSourceLineFromFrame(context, frame);
                }
            }
            var href = sourceFile.href.toString();
            var contextId = context.Crossfire.crossfire_id;
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE:  onStartDebugging href => " + href);
            }
            context.Crossfire.frameCount = 0;
            context.Crossfire.currentFrame = this._copyFrame(frame, context, true);
            this._sendEvent("onBreak", {"context_id": contextId, "data": {"url" : href, "line": lineno}});
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
         * <br><br>
         * The event body contains the following:
         * <ul>
         * <li><code>context_id</code> - the id of the current Crossfire context</li>
         * </ul>
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param context the current Crossfire context
         */
        onResume: function( context) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE: onResume");

            context.Crossfire.currentFrame = null;
            this._clearRefs();
            this._sendEvent("onResume", {"context_id": context.Crossfire.crossfire_id});
            this.setRunning(true);
        },

        /**
         * @name onToggleBreakpoint
         * @description Handles a breakpoint being toggled on or off in the Firebug.
         * <br><br>
         * Fires an <code>onToggleBreakpoint</code> event.
         * <br><br>
         * The event body contains the following:
         * <ul>
         * <li><code>context_id</code> - the id of the current Crossfire context</li>
         * <li><code>data</code> - the event payload from Firebug which contains
         * the <code>url</code>, <code>line</code>, <code>set</code> and <code>props</code> entries</li>
         * </ul>
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
            var data = {"url":url,"line":lineNo,"set":isSet,"props":props};
            this._sendEvent("onToggleBreakpoint", {"context_id": context.Crossfire.crossfire_id, "data": data});
        },

        /**
         * @name onToggleErrorBreakpoint
         * @description Handles toggling an error breakpoint on or off in Firebug.
         * <br><br>
         * Fires an <code>onToggleBreakpoint</code> event.
         * <br><br>
         * The event body contains the following:
         * <ul>
         * <li><code>context_id</code> - the id of the current Crossfire context</li>
         * <li><code>data</code> - the event payload from Firebug which contains
         * the <code>url</code>, <code>line</code>, <code>set</code> and <code>props</code> entries</li>
         * </ul>
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
         * @description Handles an HTML element breakpoint being toggled
         * <br><br>
         * Fires an <code>onToggleBreakpoint</code> event for HTML breakpoints.
         * <br><br>
         * The event body contains the following:
         * <ul>
         * <li><code>context_id</code> - the id of the current Crossfire context</li>
         * <li><code>data</code> - the event payload from Firebug which contains
         * the <code>xpath</code> and <code>type</code> entries</li>
         * </ul>
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
             var data = {"xpath":xpath,"type":type};
             this._sendEvent("onToggleBreakpoint", {"context_id": context.Crossfire.crossfire_id, "data": data});
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
            with (FBL) {
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

                        removeClass(FBL.$("menu_disconnectCrossfire"), "hidden");

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
            with (FBL) {
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
            var icon = FBL.$("crossfireIcon");
            if (icon) {
                if (isRunning) {
                     FBL.setClass(icon, "running");
                } else {
                     FBL.removeClass(icon, "running");
                }
            }
            this.running = isRunning;
        },

        /**
         * @name _getRef
         * @description Returns a reference id for the given object handle
         * @function
         * @private
         * @memberOf CrossfireModule
         * @type Array
         * @returns the Array object describing the object handle, contains <code>ref.handle</code>,
         * <code>ref.type</code> and optionally <code>ref.context_id</code>
         * @since 0.3a1
         */
        _getRef: function(obj, context_id) {
            if (obj && obj.type && obj.handle) {
                FBTrace.sysout("CROSSFIRE _getRef tried to get ref for serialized obj");
                return null;
            }
            var ref = { "type":typeof(obj), "handle": -1 };
            if (context_id) {
                ref["context_id"] = context_id;
            }
            for (var i = 0; i < this.refs.length; i++) {
                if (this.refs[i] === obj) {
                    if (FBTrace.DBG_CROSSFIRE) {
                        FBTrace.sysout("CROSSFIRE _getRef ref exists with handle: " + i + " type = "+typeof(obj), obj);
                    }
                    ref["handle"] = i;
                    return ref;
                }
            }
            var handle = ++this.refCount;
            this.refs[handle] = obj;
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE _getRef new ref created with handle: " + handle, obj);
            }
            ref["handle"] = handle;
            return ref;
        },

        /**
         * @name _clearRefs
         * @description clears the reference id cache
         * @function
         * @private
         * @memberOf CrossfireModule
         * @since 0.3a1
         */
        _clearRefs: function() {
            this.refCount = 0;
            this.refs = [];
        },

        /**
         * @name _clearBreakpoints
         * @description clears the breakpoint reference ids and resets the id counter
         * @function
         * @private
         * @memberOf CrossfireModule
         * @since 0.3a1
         */
        _clearBreakpoints: function() {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE _clearBreakpoints");
            this.breakpointIds = 1;
            this.breakpoints = [];
        },

        /**
         * @name _serialize
         * @description prepare a javascript object to be serialized into JSON.
         * @function
         * @private
         * @memberOf CrossfireModule
         * @param obj the JavaScript {@link Object} to serialize
         */
        _serialize: function(obj) {
            try {
                var type = typeof(obj);
                var serialized = {
                        "type": type,
                        "value": ""
                }
                if (type == "object" || type == "function") {
                    if (obj == null) {
                         serialized["value"] = "null";
                    } else if (obj.type && obj.handle) {
                        // already serialized
                        serialized = obj;
                    } else if (obj instanceof Array) {
                        var arr = [];
                        for (var i = 0; i < obj.length; i++) {
                            arr.push(this._serialize(obj[i]));
                        }
                        serialized["value"] = arr;
                    } else {
                        var ref = this._getRef(obj);
                        serialized["value"] = this._serializeProperties(obj, ref);
                    }
                } else {
                    serialized["value"] = obj;
                }
                return serialized;
            } catch (e) {
                if(FBTrace.DBG_CROSSFIRE) {
                    FBTrace.sysout("CROSSFIRE serialize failed: "+e);
                }
                return null;
            }
        },

        /**
         * @name _serializeProperties
         * @description Serializes the properties for the given object
         * @function
         * @private
         * @memberOf CrossfireModule
         * @param obj the {@link Object} to serialize the properties for
         * @param the computed reference id for <code>obj</code>
         * @type Object
         * @returns an object describing the serialized properties of the given object
         * @since 0.3a2
         */
        _serializeProperties: function(obj, ref) {
            var o = {};
            for (var p in obj) {
                try {
                    if (obj.hasOwnProperty(p) /*&& !(p in ignoreVars)*/) {
                        var prop = obj[p];
                        if (typeof(prop) == "object" || typeof(prop) == "function") {
                            if (prop == null) {
                                o[p] = "null";
                            } else if (prop && prop.type && prop.handle) {
                                o[p] = prop;
                            } else  {
                                o[p] = this._getRef(prop);
                            }
                        } else if (p === obj) {
                            o[p] = ref;
                        } else {
                            o[p] = this._serialize(prop);
                        }
                    }
                    else if(FBTrace.DBG_CROSSFIRE){
                        FBTrace.sysout("ignoring property -> "+p+" from -> "+obj.toString()+" during serialization");
                    }
                } catch (x) {
                    o[p] =  null;
                }
            }
            if(obj.constructor && obj.constructor != obj) {
                o["constructor"] = this._getRef(obj.constructor);
            }
            if(obj.prototype && obj.prototype != obj) {
                o["proto"] = this._getRef(obj.prototype);
            }
            return o;
        },

        /**
         * @name sourceFileLoaded
         * @description callback that the given source file has been loaded, which we hook
         * to make sure breakpoints 'set' before the file has bee loaded are set when the file actually loads
         * @function
         * @public
         * @since 0.3a1
         */
        sourceFileLoaded: function(sourceFile) {
            if(FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE sourceFileLoaded: "+sourceFile.href);
            }
            if(this.breakpoints) {
                var line = -1;
                for (var bp in this.breakpoints) {
                    if (bp.target == sourceFile.href) {
                        line = bp.line;
                        Firebug.Debugger.setBreakpoint(sourceFile, line);
                    }
                }
            }
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
        FBL.$("crossfireStatusMenu").openPopup(el, "before_end", 0,0,false,false);
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
        var params = CrossfireModule._getDialogParams(true);
        window.openDialog("chrome://crossfire/content/connect-dialog.xul", "crossfire-connect","chrome,modal,dialog", params);
        if (params.host && params.port) {
            CrossfireModule.startServer(params.host, parseInt(params.port));
        }
    };

    /**
     * @name Crossfire.connect
     * @description Delegate to {@link CrossfireModule#connectClient(host, port)}
     * @function
     * @public
     * @memberOf Crossfire
     */
    Crossfire.connect = function() {
        var params = CrossfireModule._getDialogParams(false);
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

});