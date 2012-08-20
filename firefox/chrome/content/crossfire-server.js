/* See license.txt for terms of usage */

/**
 * @name CONTEXT_ID_SEED
 * @description The seed to use when creating new context ids for Crossfire
 * @public
 * @memberOf Crossfire
 * @type Integer
 */
var CONTEXT_ID_SEED = Math.round(Math.random() * 10000000);

FBL.ns(function() {

	/**
	 * @constructor
	 * @public
	 * @type Crossfire.CrossfireServer
	 */
    Crossfire.CrossfireServer = FBL.extend(Firebug.Module,  {
        contexts: [],
        breakpoints: [], //mapping of breakpoint id (Integer) to breakpoint object
        breakpoint_ids: 1, //default id seed for breakpoint handles
        dispatchName: "CrossfireServer",
        toolName: "all", // receive all packets, regardless of 'tool' header

        /**
         * @name initialize
         * @description Initializes Crossfire
         * @function
         * @private
         * @memberOf Crossfire.CrossfireServer
         * @extends Firebug.Module
         */
        initialize: function() {
            var serverPort;
            var commandLine = Components.classes["@almaden.ibm.com/crossfire/command-line-handler;1"].getService().wrappedJSObject;
            serverPort = commandLine.getServerPort();
            if (serverPort) {
                this.startServer("localhost", serverPort);
            }
        },

        /**
         * @name shutdown
         * @description Call-back from firebug to shut down the module
         * @function
         * @private
         * @memberOf Crossfire.CrossfireServer
         * @extends Firebug.Module
         * @since 0.3a9
         */
        shutdown: function() {
        	this.stopServer();
        },
        
        /**
         * @name onConnectionStatusChanged
         * @description Called when the status of the transport's connection changes.
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @param {String} status the status to report
         */
        onConnectionStatusChanged: function( status) {
            if (FBTrace.DBG_CROSSFIRE_SERVER) {
                FBTrace.sysout("CROSSFIRE-SERVER onConnectionStatusChanged: " + status);
            }
            if (this.status == CROSSFIRE_STATUS.STATUS_DISCONNECTED) {
                this.stopServer();
            }
        },
        
        /**
         * @name startServer
         * @description Listen for incoming connections on a port.
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @param {String} host the host name.
         * @param {Number} port the port number to listen on.
         */
        startServer: function( host, port) {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE startServer: [host: " + host + "][port: " + port+"]");
            }
            this.serverPort = port;
            try {
                this.transport = Crossfire.getTransport();
                this._addListeners();
                this.transport.addListener(this);
                this.transport.open(host, port);
            } catch(e) {
                if (FBTrace.DBG_CROSSFIRE) {
                	FBTrace.sysout("CROSSFIRE failed to start server", e);
                }
                this._removeListeners();
            }
        },


        /**
         * @name _addListeners
         * @description Adds Crossfire as a listener to the core modules
         * @function
         * @private
         * @memberOf Crossfire.CrossfireServer
         */
        _addListeners: function() {
            if (Firebug.connection) {
                // Firebug 1.8 Browser BTI listener
                Firebug.connection.addListener(this);
            } else {
                Firebug.Debugger.addListener(this);
            }
            Firebug.Console.addListener(this);
            Firebug.HTMLModule.addListener(this);
        },

        /**
         * @name _removeListeners
         * @description Removes Crossfire as a listener from the core modules
         * @function
         * @private
         * @memberOf Crossfire.CrossfireServer
         * @since 0.3a1
         */
        _removeListeners: function() {
            if (Firebug.connection) {
                // Firebug 1.8 Browser BTI listener
                Firebug.connection.removeListener(this);
            } else {
            	Firebug.Debugger.removeListener(this);
            }
            Firebug.Console.removeListener(this);
            Firebug.HTMLModule.removeListener(this);
        },

        /**
         * @name _clearBreakpoints
         * @description clears the breakpoint reference ids and resets the id counter
         * @function
         * @private
         * @memberOf Crossfire.CrossfireServer
         * @since 0.3a1
         */
        _clearBreakpoints: function() {
            this.breakpoint_ids = 1;
            this.breakpoints = [];
        },

        /**
         * @name stopServer
         * @description Stops the server and closes the socket
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         */
        stopServer: function() {
            try {
                this.transport.close();
            }
            finally {
                this._removeListeners();
                this.transport = null;
                this._clearBreakpoints();
            }
        },


        /**
         * @name _generateId
         * @description Generates a unique id to map to a Firebug context
         * @function
         * @private
         * @memberOf Crossfire.CrossfireServer
         * @type String
         * @return a new ID to map to a Firebug context
         * @since 0.3a2
         */
        _generateId: function() {
            return "xf"+Crossfire.version + "::" + (++CONTEXT_ID_SEED);
        },

        /**
         * @name findContext
         * @description Returns the Context for the given id, or <code>null</code> if no context matches the given id
         * @function
         * @memberOf Crossfire.CrossfireServer
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

        // ----- Crossfire transport listener -----

        /**
         * @name handleRequest
         * @description Looks up the context by the request object's <code>contextId</code>
         * property and calls the requested command on that context's command adaptor.
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @param request the original request from {@link CrossfireSocketTransport}
         */
        handleRequest: function(request) {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE handleRequest received request: " + request);
            }
            var command = request.command;
            var context, response, contextid;
            var args = (request.arguments ? request.arguments : []);
            // first we handle commands that don't require a context
            if (command == "listContexts") {
                response = this.listContexts();
            } else if (command == "version") {
                response = { "version": CROSSFIRE_VERSION };
            } else if (command == "getTools") {
                response = Crossfire.getTools();
            } else if (command == "enableTools") {
                response = Crossfire.enableTools(args["tools"]);
            } else if (command == "disableTools") {
                response = Crossfire.disableTools(args["tools"]);
            }
            else if (command == "createContext") {
                context = this.findContext(args.contextId);
                if(context) {
                    context.window.location = args.url;
                    response = true;
                } else {
                    try {
                        if (FBTrace.DBG_CROSSFIRE) {
                            FBTrace.sysout("calling FBL.openNewTab with: " + args.url);
                        }
                        FBL.openNewTab(args.url);
                        //set response to true here, technically we are successful since none of the previous calls caused exceptions
                        //or otherwise failed
                        response = true;
                    } catch ( exc) {
                        if (FBTrace.DBG_CROSSFIRE)
                            FBTrace.sysout("createcontext fails: " + exc);
                    }
                }
            }
            else {
                // else we require a context for the commands
                context = this.findContext(request.contextId);
                if(command == "setBreakpoints") {
                    response = this.setBreakpoints(context, args);
                }
                else if(command == "getBreakpoints") {
                    response = this.getSpecificBreakpoints(context, args);
                }
                else if(command == "changeBreakpoint") {
                    response = this.changeBreakpoint(context, args);
                }
                else if(command == "deleteBreakpoints") {
                    response = this.deleteBreakpoints(context, args);
                }
                else if(context) {
                    contextid = context.Crossfire.crossfire_id;
                    if(command == "backtrace") {
                        response = this.getBacktrace(context, args);
                    }
                    else if(command == "continue") {
                        response = this.doContinue(context, args);
                    }
                    else if(command == "evaluate") {
                        response = this.doEvaluate(context, args);
                    }
                    else if(command == "frame") {
                        response = this.getFrame(context, args);
                    }
                    else if(command == "lookup") {
                        response = this.doLookup(context, args);
                    }
                    else if(command == "scopes") {
                        response = this.getScopes(context, args);
                    }
                    else if(command == "scripts") {
                        response = this.getScripts(context, args);
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
                this.transport.sendResponse(command, request.seq, contextid, response, {"running": this.running ? this.running : true, "code": 0});
            } else {
                 if (FBTrace.DBG_CROSSFIRE) {
                     FBTrace.sysout("CROSSFIRE sending failure response => " + response);
                 }
                this.transport.sendResponse(command, request.seq, contextid, {}, {"running": this.running ? this.running : true, "code": 1}); // TODO correct error code
            }
        },

        /**
         * @name listContexts
         * @description Called in response to a <code>listcontexts</code> command.
         * This method returns all the context id's that we know about.
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @type Array
         * @returns an Array of the known list of contexts
         */
        listContexts: function() {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE listing " + this.contexts.length + " contexts...");
            var contexts = [];
            var context, url;
            for (var i = 0; i < this.contexts.length; i++) {
                context = this.contexts[i];
                url = "";
                if (context.window && !context.window.closed) {
                    url = context.window.location.href;
                }
                contexts.push( { "contextId" : context.Crossfire.crossfire_id,
                                 "url"         : url ,
                                 "current"      : this.currentContext == context });
            }
            return {"contexts":contexts};
        },


        /**
         * @name getBacktrace
         * @description Returns a backtrace (stacktrace) of frames.
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @type Array
         * @returns an {@link Array} of the backtrace information or <code>null</code> if the backtrace could not be computed
         * @param context the associated context {@link Object}
         * @param args the argument {@link Array} which contains:
         * <ul>
         * <li>an optional {@link Integer} <code>fromFrame</code>, which denotes the stack frame to start the backtrace from. If not specified zero is assumed</li>
         * <li>an optional {@link Integer} <code>toFrame</code>, which denotes the stack frame to end the backtrace at. If
         * left out all stack frames will be included in the backtrace</li>
         * <li>an optional {@link Boolean} <code>includeScopes</code>, if the listing of applicable scopes should be included in the backtrace response. If not specified
         * <code>true</code> is assumed.</li>
         * </ul>
         * @since 0.3a1
         */
        getBacktrace: function(context, args) {
            if (context && context.Crossfire.currentStack) {
                if(!args) {
                    args = [];
                }
                var from = args["fromFrame"] || 0;
                var to = args["toFrame"];
                var stack = context.Crossfire.currentStack;
                if (stack) {
                    // to set to stack.length if not set, or if set to a number higher than the stack sizes
                    to = (to && to <= stack.length) ? to : stack.length-1;
                } else {
                    // issue 2559: if there is only one frame, stack is undefined,
                    // but we still want to return that frame.
                    from = 0;
                    to = 0;
                }
                var frames = [];
                for (var i = from; i <= to; i++) {
                    var frame = this.getFrame(context, {"index": i, "includeScopes": args["includeScopes"]});
                    if (frame) {
                        frames.push(frame["frame"]);
                    }
                }
                return {
                    "fromFrame": from,
                    "toFrame": to,
                    "frames": frames,
                    "totalFrames": (stack ? stack.length : 1)
                };
            }
            return null;
        },

        /**
         * @name changeBreakpoint
         * @description Changes the specified breakpoint, if if exists, with the given information.
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @type Array
         * @param context the optional associated context {@link Object}
         * @param args the array of arguments which contains:
         * <ul>
         * <li>an {@link Number} <code>handle</code>, which contains the id of the breakpoint to change</li>
         * <li>an {@link Object} <code>attributes</code>, which is the new collection of breakpoint attributes to set</li>
         * </ul>
         * @since 0.3a1
         */
        changeBreakpoint: function(context, args) {
            var handle = args["handle"],
                attributes = args["attributes"];
            if (FBTrace.DBG_CROSSFIRE_BPS) {
                FBTrace.sysout("CROSSFIRE: changeBreakpoint [handle: " + handle +"] [attributes: "+attributes.toSource()+"]", args);
            }
            try {
                if (handle) {
                    var bp = this._findBreakpoint(handle);
                    if(bp) {
                    	if (FBTrace.DBG_CROSSFIRE_BPS) {
                            FBTrace.sysout("CROSSFIRE: changeBreakpoint found bp", bp);
                        }
	                    for(var p in attributes) {
	                        bp.attributes[p] = attributes[p];
	                    }
	                    var loc = bp.location;
	                    if(typeof(attributes.condition) != undefined) { 
	                    	FBL.fbs.setBreakpointCondition({"href":loc.url}, loc.line, attributes.condition, Firebug.Debugger);
	                    }
                        if(attributes.enabled) {
                            FBL.fbs.enableBreakpoint(loc.url, loc.line);
                        } else {
                            FBL.fbs.disableBreakpoint(loc.url, loc.line);
                        }
		                return {"breakpoint":bp};
                    }
	            }
            } catch (e) {
                if (FBTrace.DBG_CROSSFIRE_BPS) {
                    FBTrace.sysout("CROSSFIRE: changeBreakpoint exception: " + e, e);
                }
            }
            return null;
        },

        /**
         * @name deleteBreakpoints
         * @description Remove the breakpoint objects with the specified ids, if they all exist.
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @type Object
         * @param context the optional associated context {@link Object}
         * @param args the array of arguments which contains:
         * <ul>
         * <li>an {@link Array} <code>handles</code>, which contains the ids of the breakpoints to clear</li>
         * </ul>
         * @since 0.3a1
         */
        deleteBreakpoints: function(context, args) {
            var handles = args["handles"];
            if(handles) {
                for (var i = 0; i < handles.length; i++) {
                    if (!this._findBreakpoint(handles[i])) {
	                	return null;
	                }
                }

                // the breakpoint handles all appear to be valid so now make the changes

                for (var i = 0; i < handles.length; i++) {
	                var bp = this._findBreakpoint(handles[i]);
                    var loc = bp.location;
                    if(loc && loc.url && loc.line) {
                        Firebug.Debugger.clearBreakpoint({"href": loc.url}, loc.line);
                        //https://github.com/firebug-crossfire/crossfire/issues/1
                        var idx = this.breakpoints.indexOf(bp);
                        if(idx > -1) {
                        	this.breakpoints.splice(idx, 1);
                        }
                    }
	            }
	            return {};
            }
            return null;
        },

        /**
         * @name doContinue
         * @description Continue execution of JavaScript if suspended, if no <code>stepaction</code> is passed, simply resumes execution.
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @type Array
         * @returns always returns an empty array
         * @param context the associated context {@link Object}
         * @param args the array of arguments which contains:
         * <ul>
         * <li>optionally a {@link String} <code>stepAction</code>, which can be one of 'in', 'next', or 'out' </li>
         * </ul>
         * @since 0.3a1
         */
        doContinue: function(context, args) {
            var stepAction = null;
            if(args) {
                stepAction = args["stepAction"];
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
         * @description Evaluate a JavaScript expression.
         * If a frame argument is passed, evaluates the expression in that frame,
         * otherwise the expression is evaluated in the context's global scope.
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @type Array
         * @returns an {@link Array} of the value returned from the evaluation
         * @param context the associated context {@link Object}
         * @param args the array of arguments which contains:
         * <ul>
         * <li>optionally an {@link Integer} <code>frameIndex</code>, which is the index of the stackframe in the current stack to evaluate in</li>
         * <li>a {@link String} <code>expression</code>, which is what will be evaluated</li>
         * </ul>
         * @since 0.3a1
         */
        doEvaluate: function(context, args) {
            var frameNo = args["frameIndex"];
            if(!frameNo) {
                frameNo = 0;
            }
            var expression = args["expression"];
            var frame;

            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CrossfireServer doEvaluate expression: " + expression + " frame: " + frame);
            }
            if (context.Crossfire.currentStack && frameNo > 0) {
            	frame = context.Crossfire.currentStack[frameNo];
            }
            var result = {};
            var contextId = context.Crossfire.crossfire_id;
            try {
                if (frame) {
                    if (frame.eval(expression, "crossfire_eval_" + contextId, 1, result)) {
                        result = FBL.unwrapIValue(result.value);
                    }
                } else {
                    Firebug.CommandLine.evaluate(expression, context,null,null,function(r){
                        result = r;
                    },function(){
                        throw new Error("Failure to evaluate expression: " + expression);
                    });
                }
            } catch (e) {
                result = e;
            }
            return {"result": Crossfire.serialize(result)};
        },

        /**
         * @name getFrame
         * @description Returns a new stack frame object.
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @type Array
         * @returns an {@link Array} of the new frame information
         * @param context the associated context {@link Object}
         * @param args the array of arguments which contains:
         * <ul>
         * <li>an {@link Integer} <code>index</code>, which is the index of the frame in the current stack</li>
         * <li>a {@link Boolean} <code>includeScopes</code>, which denotes if the associated scopes should be returned as well</li>
         * </ul>
         * @since 0.3a1
         */
        getFrame: function(context, args) {
        	if(FBTrace.DBG_CROSSFIRE_FRAMES) {
        		FBTrace.sysout("CROSSFIRE: getframe", context);
        	}
            var index = args["index"];
            if(!index || index < 0) {
                index = 0;
            }
            var includeScopes = args["includeScopes"];
            if(includeScopes == null || typeof(includeScopes) == undefined) {
                includeScopes = true;
            }
            var stack = context.Crossfire.currentStack;
            if(!stack) {
                return null;
            }
            var frame = stack[index];
            try {
                var locals = {};
                if(frame.scopes) {
                	locals = Crossfire.serialize(frame.scopes[0]);
            	}
                if (frame.thisValue) {
                    locals["this"] = Crossfire.serialize(frame.thisValue);
                }
                if (includeScopes) {
                    var scopes = this.getScopes(context, {"index": 0, "frameIndex": index });
                    return {
                        "frame": {
    	                    "index": frame.index,
    	                    "functionName": frame.functionName,
    	                    "url": frame.script,
    	                    "locals": locals,
    	                    "line": frame.line,
    	                    "scopes": scopes.scopes
    	                }
                    };
                }
                return {
                    "frame": {
	                    "index": frame.index,
	                    "functionName": frame.functionName,
	                    "url": frame.script,
	                    "locals": locals,
	                    "line": frame.line,
	                }
                };
            } catch (e) {
                if (FBTrace.DBG_CROSSFIRE_FRAMES) {
                    FBTrace.sysout("CROSSFIRE exception returning frame: "+e.getMessage());
                }
            }
            return null;
        },

        /**
         * @name getAllBreakpoints
         * @description Returns all the breakpoints. This method requests all breakpoints from Firebug directly
         * for all known source files.
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @type Array
         * @returns an {@link Array} of all breakpoints information or <code>null</code> if there are no breakpoints set.
         * @param context the optional associated context {@link Object}
         * @since 0.3a1
         */
        getAllBreakpoints: function(context) {
            var bp;
            if(context) {
                this._enumBreakpoints(context, this);
            }
            else {
                var self = this;
                Firebug.TabWatcher.iterateContexts(function doit(ctxt) {
                    self._enumBreakpoints(ctxt, self);
                });
            }
            return {"breakpoints": this.breakpoints};
        },

        /**
         * @name getSpecificBreakpoints
         * @description Returns the breakpoints specified in the request, or all breakpoints if no
         * breakpoint handles are specified.
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @type Array
         * @returns an {@link Array} of breakpoints information or <code>null</code> if there are no breakpoints to return.
         * @param context the optional associated context {@link Object}
         * @param args the array of arguments which contains:
         * <ul>
         * <li>an optional {@link Array} <code>handles</code>, which contains the handles of the breakpoints to return</li>
         * </ul>
         * @since 0.3a1
         */
         getSpecificBreakpoints: function(context, args) {
         	if (args && args["handles"]) {
	         	var handles = args["handles"];
	         	var bps = [];
	        	for (var i = 0; i < handles.length; i++) {
	        	    var bp = this._findBreakpoint(handles[i]);
	                if (bp) {
	                	bps.push(bp);
	                }
	        	}
	        	return {"breakpoints": bps};
		    }
	        return this.getAllBreakpoints(context);
         },

        /**
         * @name _enumBreakpoints
         * @description enumerates all of the breakpoints from the given Firebug context
         * @function
         * @private
         * @memberOf Crossfire.CrossfireServer
         * @type Array
         * @returns nothing; all enumerated breakpoints are added to the global <code>breakpoints</code> listing
         * @param context the associated context {@link Object}
         * @param scope the JS scope to call from
         * @since 0.3a6
         */
        _enumBreakpoints: function(context, scope) {
            var self = scope;
            for (var url in context.sourceFileMap) {
                FBL.fbs.enumerateBreakpoints(url, {"call": function(url, line, props, script) {
                    var l = props.lineNo;
                    var u = props.href;
                    var loc = {"line":l, "url":u};
                    bp = self._findBreakpoint(loc);
                    if(!bp) {
                        bp = self._newBreakpoint("line",{"line":l,"url":u},{"enabled":!props.disabled,"condition":null});
                    } else if (bp.enabled == props.disabled){
                        bp.enabled = !props.disabled;
                        self.breakpoints[self.breakpoints.indexOf(bp)] = bp;
                    }
                }});
            }
        },

        /**
         * @name doLookup
         * @description Lookup objects by their handles.
         * @private
         * @memberOf Crossfire.CrossfireServer
         * @type Array
         * @returns an {@link Array} of the serialized objects with the given ids
         * @param context the associated context {@link Object}
         * @param args the arguments array that contains:
         * <ul>
         * <li>an {@link Array} <code>handles</code>, the object ids to look up</li>
         * </ul>
         * @since 0.3a1
         */
        doLookup: function(context, args) {
            var handles = args["handles"];
            var source = args["includeSource"];
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE doLookup: handles => " + handles);
            }
            if (handles) {
                var obj;
                var result = [];
                for (var i in Crossfire.refs) {
               	    for (var j = 0; j < handles.length; j++) {
				        if (handles[j] == i) {
	                        obj = Crossfire.refs[i];
	                        var arr = Crossfire.serialize(obj);
	                        if(source) {
	                            try {
	                                var src = obj.toSource();
	                                if(src) {
	                                    arr["source"] = src;
	                                }
	                            }
	                            catch(e) {
	                                 if (FBTrace.DBG_CROSSFIRE) {
	                                     FBTrace.sysout("CROSSFIRE doLookup: exception => " + e);
	                                 }
	                            }
	                        }
	                        result.push(arr);
	                        break;
	                    }
                    }
                }
                return {"values": result};
            }
            return null;
        },

        /**
         * @name getScopes
         * @description  Returns scopes for a frame.
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @type Array
         * @returns the {@link Array} of scopes for a given frame number or <code>null</code>
         * @param context the associated context {@link Object}
         * @param args the request arguments that contains:
         * <ul>
         * <li>an {@link Array} <code>scopeIndexes</code>, which contains the indexes of the scopes to return</li>
         * <li>an {@link Integer} <code>frameIndex</code>, which is the number of the stack frame to collect scopes from</li>
         * </ul>
         * @since 0.3a1
         */
        getScopes: function(context, args) {
        	try {
	            var scopes = [];
	            var scopeIndexes = args["scopeIndexes"];
	            if (scopeIndexes) {
	            	for (var i = 0; i < scopeIndexes.length; i++) {
	            		var scope = this.getScope(context, {"index": scopeIndexes[i], "frameIndex": args["frameIndex"]});
		                if (scope) {
		                    scopes.push(scope);
		                }
	            	}
	            } else {
	            	var idx = args["index"];
	            	if(typeof(idx) != "number") {
	            		idx = 0;
	            	}
	            	var scope;
		            do {
		                scope = this.getScope(context, {"index": idx, "frameIndex": args["frameIndex"]});
		                if (scope) {
		                    scopes.push(scope);
		                }
		                idx++;
		            } while(scope);
		        }
	            if (scopes.length > 0) {
	              return {
	                  "fromScope": 0,
	                  "toScope": scopes.length-1,
	                  "totalScopes": scopes.length,
	                  "scopes": scopes
	              };
	            }
        	}
        	catch(e) {
        		FBTrace.sysout("CROSSFIRE getScopes exception computing scopes"+e.getMessage(), e);
        	}
            return null;
        },

        /**
         * @name getScope
         * @description Returns a scope for the specified frame.
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @type Array
         * @returns the scope information for the specified frame or <code>null</code>
         * @param context the associated context {@link Object}
         * @param args the arguments array that contains:
         * <ul>
         * <li>an {@link Integer} <code>index</code>, which is the index of enclosing scopes to include</li>
         * <li>an {@link Integer} <code>frameIndex</code>, which is the index of the frame to collect the scopes from</li>
         * </ul>
         * @since 0.3a1
         */
        getScope: function(context, args) {
        	try {
	            var scope;
	            var scopeNo = args["index"];
	            var frameNo = args["frameIndex"];
	            var stack = context.Crossfire.currentStack;
	            if (scopeNo == 0) {
	                // only return a reference to the global scope
	                scope = Crossfire._getRef(context.window.wrappedJSObject);
	            }
	            else if(stack) {
	                if (!frameNo || frameNo < 0) {
	                    frameNo = 0;
	                }
	                else if(frameNo > stack.length) {
	                    frameNo = stack.length-1;
	                }
	                var scopes = stack[frameNo].scopes;
	                scope = scopes[scopeNo];
	            }
	            if (scope) {
	                return {
	                    "index": scopeNo,
	                    "frameIndex": frameNo,
	                    "name":scope.toString(),
	                    "scope": Crossfire._getRef(scope)
	                };
	            }
        	}
            catch(e) {
            	FBTrace.sysout("CROSSFIRE getScope exception computing scope at index: "+index+" for frame: "+frameIndex+" "+e.getMessage(), e);
            }
            return null;
        },

        /**
         * @name getScripts
         * @description Retrieve the scripts specified in the request, or all scripts if no urls are specified, and optionally their source.
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @type Array
         * @returns the currently known script information from the source map
         * @param context the associated context {@link Object}
         * @param args the arguments array that contains:
         * <ul>
         * <li>a {@link Boolean} <code>includeSource</code>, if the source for scripts should be included in the response</li>
         * <li>an optional {@link Array} <code>urls</code>, specifying which scripts to include in the response</li>
         * </ul>
         * @since 0.3a1
         */
        getScripts: function (context, args) {
            var incSrc = args["includeSource"];
            var srcMap = context.sourceFileMap;
            var scripts = [];
            var script;
            var urls = args["urls"];
            if(!urls) {
            	//include all of them
            	for(var url in srcMap) {
            		script = this._getScript(context, url, incSrc);
                    if (script) {
                        delete script.contextId;
                        scripts.push( script );
                    }
            	}
            }
            else {
            	//only include the ones asked for
            	for (var url in srcMap) {
            		for(var i = 0; i < urls.length; i++) {
            			if(urls[i] === url) {
            				script = this._getScript(context, url, incSrc);
    	                    if (script) {
    	                        delete script.contextId;
    	                        scripts.push( script );
    	                    }
            			}
            		}
            	}
            }
            return {"scripts": scripts};
        },

        /**
         * @name _getScript
         * @description Retrieve a single script and optionally its source.
         * @function
         * @private
         * @memberOf Crossfire.CrossfireServer
         * @type Array
         * @returns the currently known script information from the source map
         * @param context the associated context {@link Object}
         * @param url a {@link String} value of the URL to look up
         * @param incsrc a {@link Boolean} denoting if the source for the script should also be included
         * @since 0.3a1
         */
        _getScript: function(context, url, incsrc) {
            var sourceFile = context.sourceFileMap[url];
            if(this._isJS(sourceFile)) {
                return this._newScript(context, sourceFile, incsrc);
            }
            return null;
        },

        /**
         * @name _findBreakpoint
         * @description Retrieve a breakpoint based on its line and URL information
         * @function
         * @private
         * @memberOf Crossfire.CrossfireServer
         * @type Object
         * @returns the breakpoint object that has a location at the given line and URL
         * @param locationOrHandle an {@link Object} containing the location information to compare to find a
         * matching breakpoint, or the Integer handle.
         * @since 0.3a5
         */
        _findBreakpoint: function(locationOrHandle) {
            var handle, location;
            try {
                handle = parseInt(locationOrHandle);
            } catch (parseExc) {
                //do nothing, try to find the breakpoint by location
            }
            if (!handle && typeof(locationOrHandle) == "object") {
                location = locationOrHandle;
            }
            list: for(var bp = 0; bp < this.breakpoints.length; bp++) {
                var bpobj = this.breakpoints[bp];
                if (handle) { // look up by handle
                    if (bpobj.handle == handle)
                        return bpobj;
                }
                else if (location) { // then we want to look up by location
                    loc = bpobj.location;
                    if(loc) {
                        //breakpoints are equal if their locations are equal
                        for(var l in loc) {
                            var val = location[l];
                            if(!val || (val && val != loc[l])) {
                                continue list;
                            }
                        }
                    }
                    return bpobj;
                }
            }

            if (FBTrace.DBG_CROSSFIRE_BPS) {
                FBTrace.sysout("CROSSFIRE: findBreakpoint failed to find breakpoint", locationOrHandle);
            }
            return null;
        },

        /**
         * @name _newBreakpoint
         * @description Create a new Crossfire breakpoint object and add it to the listing
         * @function
         * @private
         * @memberOf Crossfire.CrossfireServer
         * @type Object
         * @returns a new breakpoint object
         * @param type a required (@String} for the name of the type of the breakpoint
         * @param location a required {@link Object} containing the location information to compare to find a
         * matching breakpoint
         * @param attributes an optional {@link Object} of attributes to set on the breakpoint
         * @since 0.3a5
         */
        _newBreakpoint: function(type, location, attributes) {
            if (FBTrace.DBG_CROSSFIRE_BPS)
                FBTrace.sysout("CROSSFIRE: _newBreakpoint: type => " + type + " location => " + location + " attributes => " + attributes);
            var bp = {
                "handle": this.breakpoint_ids++,
                "type": type,
                "location": location,
                "attributes": (attributes != undefined ? attributes : {"enabled":true, "condition":null})
            };
            this.breakpoints.push(bp);
            return bp;
        },

        /**
         * @name setBreakpoints
         * @description Set breakpoints and return their objects
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @type Array
         * @returns the breakpoint object
         * @param context the optional associated context {@link Object}
         * @param args the arguments array that contains:
         * <ul>
         * <li>an {@link Array} <code>breakpoints</code>, the breakpoints to set</li>
         * <ul>
         * @since 0.3a1
         */
        setBreakpoints: function(context, args) {
			var bpObjs = args["breakpoints"];
			if (bpObjs) {        
        		var breakpoints = [];
        		
        		for (var i = 0; i < bpObjs.length; i++) {
        			var bpObj = bpObjs[i];
        			var location = bpObj["location"];
            		var attributes = bpObj["attributes"];
		            if (FBTrace.DBG_CROSSFIRE_BPS) {
		                FBTrace.sysout("CROSSFIRE: setBreakpoints location => "+location.toSource()+" attributes => "+attributes.toSource(), args);
		            }
            		var bp = this._findBreakpoint(location);
		            if (!bp) {
		                if (!location) {
		                    // can't create a new bp without a location
		                    return null;
		                }
		                bp = this._newBreakpoint("line", location, attributes);
		            }
		            breakpoints.push(bp);
		            
		            var url = location.url;
	                var line = location.line;
	                if(url && line) {
	                    if(context) {
	                        var sourceFile = context.sourceFileMap[url];
	                        if (sourceFile) {
	                            Firebug.Debugger.setBreakpoint(sourceFile, line);
	                        }
	                    }
	                    else {
	                        Firebug.TabWatcher.iterateContexts(function doit(context) {
	                            var sourceFile = context.sourceFileMap[url];
	                            if (sourceFile) {
	                                Firebug.Debugger.setBreakpoint(sourceFile, line);
	                            }
	                        });
	                    }
	                    if (bp.attributes.condition != undefined) {
	                        FBL.fbs.setBreakpointCondition({"href": url}, line, bp.attributes.condition, Firebug.Debugger);
	                    }
	                    // by default, setting a new breakpoint is enabled, so only check if we want to disable it.
	                    if (!bp.attributes.enabled) {
	                        FBL.fbs.disableBreakpoint(url, line);
	                    }
	                }
		        }
	            return {"breakpoints": breakpoints};
            }
            return null;
        },

        /**
         * @name doSuspend
         * @description Try to suspend any currently running Javascript.
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @type Array
         * @returns always returns an emtpy array
         * @since 0.3a1
         */
        doSuspend: function(context) {
            Firebug.Debugger.suspend(context);
            return {};
        },

        /**
         * @name _newScript
         * @description Returns a new script object representing the given source file
         * @function
         * @private
         * @memberOf Crossfire.CrossfireServer
         * @type Array
         * @param context the current Firebug context
         * @param soureFile the Firebug sourceFile from the source map or from the <code>onSourceFileCreated</code> callback
         * @param includeSrc a Boolean to determine if the source for the script should be included in the returned object
         * @returns a new script object for the given source file
         * @since 0.3a5
         */
        _newScript: function(context, sourceFile, includeSrc) {
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
                "url": sourceFile.href,
                "lineOffset": 0,
                "columnOffset": 0,
                "sourceLength":srcLen,
                "lineCount": lines.length,
                "type": sourceFile.compilation_unit_type
            };
            if (includeSrc) {
                script["source"] = lines.join(' ');
            }
            return script;
        },

        /**
         * @name _copyFrame
         * @description Make a copy of a frame since the jsdIStackFrame's are ephemeral,
         * but our protocol is asynchronous so the original frame object may
         * be gone by the time the remote host requests it.
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @param frame the stackframe to copy
         * @param ctx the current Crossfire context
         * @type Array
         * @returns a copy of the given stackframe
         */
        _copyFrame: function(frame, ctx) {
        	if (FBTrace.DBG_CROSSFIRE_FRAMES) {
                FBTrace.sysout("CROSSFIRE: _copyFrame", frame);
            }
            if(frame && frame instanceof FBL.StackFrame) {
	            var copy = {
	            		"eval": function() { return frame.eval.apply(frame, arguments); },
	            		"functionName": frame.fn,
	            		"line": frame.line,
	            		"thisValue": frame.getThisValue(),
	            		"scopes": frame.getScopes(false),
	            		"script": frame.href
	            };
	            return copy;
            }
            if (FBTrace.DBG_CROSSFIRE_FRAMES) {
                FBTrace.sysout("CROSSFIRE: _copyFrame - not an instanceof FBL.Stackframe", frame);
            }
            return null;
        },

        /**
         * @name _sendEvent
         * @description Sends the given event data over the backing transport
         * @function
         * @private
         * @memberOf Crossfire.CrossfireServer
         * @param event the String name for the event
         * @param data the data Array for the event packet
         * @since 0.3a1
         */
        _sendEvent: function(event, data) {
            if (this.transport && Crossfire.status == CROSSFIRE_STATUS.STATUS_CONNECTED_SERVER) {
                if (FBTrace.DBG_CROSSFIRE) {
                    FBTrace.sysout("CROSSFIRE: _sendEvent => " + event + " ["+data+"]");
                }
                this.transport.sendEvent(event, data);
            }
        },
        
//FIREBUG.TABCONTEXT FUNCTIONS ################################################################################################################
        
        /**
         * @name initContext
         * @description Handles a context being created - i.e. a new tab has been opened.
         * <br><br>
         * Fires an <code>onContextCreated</code> event.
         * @see https://github.com/firebug-crossfire/crossfire/wiki/Crossfire%20Protocol%20Reference 
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @param context the new context
         * @extends TabWatchListener
         * @see https://github.com/firebug/firebug/blob/master/extension/content/firebug/bti/inProcess/browser.js
         */
        initContext: function(context) {
            context.Crossfire = { "crossfire_id" : this._generateId() };
            this.contexts.push(context);
            var url = "";
            try {
                url = context.window.location.href;
            } catch(e) {
                //do nothing
            }
            this._sendEvent("onContextCreated", {"body": {"url": url, "contextId": context.Crossfire.crossfire_id}});
            Crossfire._updatePanel();
        },

        /**
         * @name loadedContext
         * @description Handles a context being loaded - i.e. the scripts in a given context have completed being compiled.
         * <br><br>
         * Fires an <code>onContextLoaded</code> event.
         * @see https://github.com/firebug-crossfire/crossfire/wiki/Crossfire%20Protocol%20Reference 
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @param context the context that completed loading
         * @extends TabWatchListener
         * @see https://github.com/firebug/firebug/blob/master/extension/content/firebug/bti/inProcess/browser.js
         */
        loadedContext: function( context) {
            var url = "";
            try {
                url = context.window.location.href;
            } catch(e) {
                //do nothing
            }

            // load/sync breakpoints
            this.getAllBreakpoints(context);

            this._sendEvent("onContextLoaded", {"body": {"url": url, "contextId": context.Crossfire.crossfire_id}});
        },

        /**
         * @name showContext
         * @description Handles a context being shown - i.e. a tab has been switched to.
         * <br><br>
         * Fires an <code>onContextSelected</code> event
         * @see https://github.com/firebug-crossfire/crossfire/wiki/Crossfire%20Protocol%20Reference 
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @param browser the browser the context was changed to in
         * @param context the context that was switched to
         * @extends TabWatchListener
         * @see https://github.com/firebug/firebug/blob/master/extension/content/firebug/bti/inProcess/browser.js
         */
        showContext: function(browser, context) {
            if(context && this.currentContext && this.currentContext.Crossfire) {
                var url =  this.currentContext.window.location.href;
                var newUrl =  context.window.location.href;
                if(url != newUrl) {
                    this._sendEvent("onContextSelected", {"body": {"oldContextId": this.currentContext.Crossfire.crossfire_id, "oldUrl": url,
                        "contextId": context.Crossfire.crossfire_id, "url": newUrl}});
                }
            }
            this.currentContext = context;
        },

        /**
         * @name destroyContext
         * @description Handles a context being destroyed - i.e. a tab has been closed in the browser.
         * <br><br>
         * Fires an <code>onContextDestroyed</code> event.
         * @see https://github.com/firebug-crossfire/crossfire/wiki/Crossfire%20Protocol%20Reference 
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @param context the context that has been destroyed
         * @extends TabWatchListener
         * @see https://github.com/firebug/firebug/blob/master/extension/content/firebug/bti/inProcess/browser.js
         */
        destroyContext: function(context) {
            var contextId;
            if (context && context.Crossfire) {
                contextId = context.Crossfire.crossfire_id;
                for (var i = 0; i < this.contexts.length; i++) {
                    if (this.contexts[i].Crossfire.crossfire_id == contextId) {
                        delete this.contexts[i].Crossfire.currentStack;
                        this._sendEvent("onContextDestroyed", {"body":{"contextId": this.contexts[i].Crossfire.crossfire_id}});
                        this.contexts.splice(i, 1);
                        break;
                    }
                }
            }
        },
        
        /**
         * @name onCompilationUnit
         * @description handles the callback for when a new source file is created or compiled in Firebug
         * <br><br>
         * Fires an <code>onScript</code> event.
         * @see https://github.com/firebug-crossfire/crossfire/wiki/Crossfire%20Protocol%20Reference 
         * @function
         * @private
         * @memberOf Crossfire.CrossfireServer
         * @param context the current Firebug context
         * @param url the compilation unit url
         * @param kind a {@link String} value describing the kind of compilation unit it is. Compilation unit kinds are described in
         * /firebug1.9/content/firebug/bti/inProcess/compilationunit.js
         * @extends Firebug.TabContext
         * @see https://github.com/firebug/firebug/blob/master/extension/content/firebug/chrome/tabContext.js
         * @since 0.3a8
         */
        onCompilationUnit: function(context, url, kind) {
        	if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE:  onCompilationUnit => " + url);
            }
        	var sourceFile = context.sourceFileMap[url];
        	if(sourceFile) {
        		this._handleSource(context, sourceFile, false);
        	}
        },
        
        /**
         * @name _handleSource
         * @description handles the callback for when a new source file is created or compiled in Firebug
         * @function
         * @private
         * @memberOf Crossfire.CrossfireServer
         * @param context the current Firebug context
         * @param sourceFile the compilation unit object
         * @param incsrc a {@link Boolean} flag indicating if the source for the script should be computed
         * @since 0.3a8
         */
        _handleSource: function(context, sourceFile, incsrc) {
        	if(!this._isJS(sourceFile)) {
        		return;
        	}
         	for (var bp in this.breakpoints) {
                if(bp.location) {
                    if (bp.location.url === sourceFile.href) {
                        Firebug.Debugger.setBreakpoint(sourceFile, bp.location.line);
                    }
                }
            }
        	var script = this._newScript(context, sourceFile, incsrc);
            var data = {"script":script};
            this._sendEvent("onScript", {"contextId": context.Crossfire.crossfire_id, "body": data});
        },
        
        /**
         * @name _isJS
         * @description returns <code>true</code> is the given sourceFile object represents a JavaScript
         * source or something that could be remotely debugged
         * @function
         * @private
         * @memberOf Crossfire.CrossfireServer
         * @param sourceFile the compilation unit object
         * @since 0.3a9
         */
        _isJS: function(sourceFile) {
        	var type = sourceFile.compilation_unit_type;
        	return sourceFile && ("js" ==  type || "scriptTagAppend" == type || "scriptTag" == type || "top-level" == type || "event" == type);
        },
        
        /**
         * @name onSourceFileCreated
         * @description Handles a script being loaded - i.e. a script has been compiled in the current context.
         * <br><br>
         * Fires an <code>onScript</code> event.
         * @see https://github.com/firebug-crossfire/crossfire/wiki/Crossfire%20Protocol%20Reference 
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @param context the context of this event
         * @param sourceFile the source file object
         * @extends TabWatchListener
         * @see https://github.com/firebug/firebug/blob/master/extension/content/firebug/bti/inProcess/browser.js
         */
        onSourceFileCreated: function(context, sourceFile) {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE:  onSourceFileCreated => " + sourceFile.href);
            }
            this._handleSource(context, sourceFile, false);
        },
        
//FIREBUG.DEBUGGER FUNCTIONS ############################################################################################################
        
        /**
         * @name onStartDebugging
         * @description Handles Firebug suspending.
         * <br><br>
         * Fires an <code>onBreak</code> event.
         * @see https://github.com/firebug-crossfire/crossfire/wiki/Crossfire%20Protocol%20Reference 
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @param context the current Crossfire context
         * @extends Firebug.Debugger
         * @see https://github.com/firebug/firebug/blob/master/extension/content/firebug/js/debugger.js
         */
        onStartDebugging: function(context) {
        	if (FBTrace.DBG_CROSSFIRE_FRAMES) {
                FBTrace.sysout("CROSSFIRE: onStartDebugging", context);
            }
            var frame = FBL.getStackFrame(context.stoppedFrame, context);
            var lineno = frame.getLineNumber();
            var url = frame.getURL();
            var contextId = context.Crossfire.crossfire_id;
            var stack = [];
            var parent = frame;
            var copy;
            var index = 0;
            while(parent) {
            	copy = this._copyFrame(parent, context);
            	copy.index = index++;
            	stack.push(copy);
            	parent = parent.getCallingFrame();
            }
            context.Crossfire.currentStack = stack;
            if (FBTrace.DBG_CROSSFIRE_FRAMES) {
                FBTrace.sysout("CROSSFIRE: onStartDebugging - setting stack", stack);
            }
            var bcause = context.breakingCause;
            var cause =  bcause ? {"title":bcause.title, "message":bcause.message} : {};
            var location = {"url" : url, "line": lineno};
            this._sendEvent("onBreak", {"contextId": contextId, "body": {"location":location, "cause":cause}});
            this.running = false;
        },

        /**
         * @name onToggleErrorBreakpoint
         * @description Handles toggling an error breakpoint on or off in Firebug.
         * <br><br>
         * Fires an <code>onToggleBreakpoint</code> event.
         * @see https://github.com/firebug-crossfire/crossfire/wiki/Crossfire%20Protocol%20Reference 
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @param context the current Crossfire context
         * @param url the URL that the breakpoint was toggled within
         * @param lineNo the number of the line the breakpoint was toggled on
         * @param isSet the toggled state of the breakpoint.
         * <code>true</code> if the breakpoint was toggled on (created), <code>false</code> otherwise
         * @param props a collection of additional properties from Firebug
         * @extends Firebug.Debugger
         * @see https://github.com/firebug/firebug/blob/master/extension/content/firebug/js/debugger.js
         */
        onToggleErrorBreakpoint: function(context, url, lineNo, isSet, props) {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE: onToggleErrorBreakpoint");
            }
            props.bp_type = "error";
            this.onToggleBreakpoint(context, url, lineNo, isSet, props);
        },
        
        /**
         * @name onToggleBreakpoint
         * @description Handles a breakpoint being toggled on or off in the Firebug.
         * <br><br>
         * Fires an <code>onToggleBreakpoint</code> event.
         * @see https://github.com/firebug-crossfire/crossfire/wiki/Crossfire%20Protocol%20Reference 
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @param context the current Crossfire context
         * @param url the URL that the breakpoint was toggled within
         * @param lineNo the number of the line the breakpoint was toggled on
         * @param isSet the toggled state of the breakpoint.
         * <code>true</code> if the breakpoint was toggled on (created), <code>false</code> otherwise
         * @param props a collection of additional properties from Firebug
         * @extends Firebug.Debugger
         * @see https://github.com/firebug/firebug/blob/master/extension/content/firebug/js/debugger.js
         */
        onToggleBreakpoint: function(context, url, lineNo, isSet) {
            if (FBTrace.DBG_CROSSFIRE_BPS) {
                FBTrace.sysout("CROSSFIRE: onToggleBreakpoint", context);
            }
            var loc = {"url":url,"line":lineNo};
            var bp = this._findBreakpoint(loc);
            if(isSet) {
            	var fbsbp = FBL.fbs.findBreakpoint(loc.url, loc.line);
	            if(!fbsbp) {
	            	return null;
	            }
	            if(bp) {
	            	bp.attributes.enabled = fbsbp.disabled == 0;
	            	bp.attributes.condition = fbsbp.condition;
	            }
	            else {
	                var type = "line";
	                var attributes = {"enabled":fbsbp.disabled == 0, "condition": fbsbp.condition};
	                bp = this._newBreakpoint(type, loc, attributes);
	            } 
            }
            else {
            	//removed
            	 this.breakpoints.splice(this.breakpoints.indexOf(bp), 1);
            }
            var data = {"breakpoint":bp,"set":isSet};
            this._sendEvent("onToggleBreakpoint", {"contextId":context.Crossfire.crossfire_id,"body": data});
        },

//HTML MODULE MUTATION BREAKPOINTS LISTENER FUNCTIONS ################################################################################### 
        
        /**
         * @name onModifyBreakpoint
         * @description Handles an HTML element breakpoint being toggled
         * <br><br>
         * Fires an <code>onToggleBreakpoint</code> event for HTML breakpoints.
         * @see https://github.com/firebug-crossfire/crossfire/wiki/Crossfire%20Protocol%20Reference 
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @param context the current Crossfire context
         * @param xpath the xpath the breakpoint was modified for
         * @param type the type of the breakpoint. Breakpoint type are defined in: http://code.google.com/p/fbug/source/browse/branches/firebug1.7/content/firebug/html.js
         * @extends Firebug.HTMLModule.MutationBreakpoints
         * @see https://github.com/firebug/firebug/blob/master/extension/content/firebug/html/htmlPanel.js
         */
        onModifyBreakpoint: function(context, xpath, type) {
             var data, cid = context.Crossfire.crossfire_id,
                 loc = {"xpath":xpath};
                 bp = this._findBreakpoint(loc);
                 newtype = this._getHTMLBreakpointType(type);
             if(!bp) {
                 bp = this._newBreakpoint(newtype,loc,{"enabled":true,"condition":null});
             }
             data = {"breakpoint":bp,"set":bp.attributes.enabled};
             //the breakpoint is considered set if it is enabled
             this._sendEvent("onToggleBreakpoint", {"contextId": cid, "body": data});
        },
        
        /**
         * @name _getHTMLBreakpointType
         * @description translates the integer type of an HTML breakpoint to a human readable type
         * @function
         * @private
         * @memberOf Crossfire.CrossfireServer
         * @param type the integer type of the HTML breakpoint
         * @since 0.3a7
         */
        _getHTMLBreakpointType: function(type) {
            if(typeof(type) == "number") {
                switch(type) {
                    case 1: return "html_attribute_change";
                    case 2: return "html_child_change";
                    case 3: return "html_remove";
                    case 4: return "html_text";
                }
            }
            return "html_unknown_type";
        },
        
//FIREBUG.DEBUGLISTENER FUNCTIONS ##################################################################################################

        /**
         * @name onResume
         * @description Handles Firebug resuming and sets the running state to <code>true</code>.
         * <br><br>
         * Fires an <code>onResume</code> event.
         * @see https://github.com/firebug-crossfire/crossfire/wiki/Crossfire%20Protocol%20Reference 
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @param context the current Crossfire context
         * @extends Firebug.DebugListener
         * @see https://github.com/firebug/firebug/blob/master/extension/content/firebug/js/debugger.js
         */
        onResume: function( context) {
            context.Crossfire.currentStack = null;
            this._sendEvent("onResume", {"contextId": context.Crossfire.crossfire_id});
            this.running = true;
        },
        
        /**
         * @name onError
         * @description call-back from Firebug when an error is encountered
         * <br><br>
         * The object or message logged is contained in the packet's <code>data</code> property.
         * @see https://github.com/firebug-crossfire/crossfire/wiki/Crossfire%20Protocol%20Reference 
         * @function
         * @public
         * @memberOf Crossfire.CrossfireServer
         * @param context the FB context
         * @param frame the current stackframe context
         * @param error the current error
         * @extends Firebug.DebugListener
         * @see https://github.com/firebug/firebug/blob/master/extension/content/firebug/js/debugger.js
         * @since 0.3a8
         */
        onError: function(context, frame, error) {
        	if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE onError", error);
            }
            if(context && context.Crossfire) {
                var cid = context.Crossfire.crossfire_id;
                this._sendEvent("onError", {"contextId": cid, "body": {"frame":Crossfire.serialize(frame), "error": error}});
            }
        }
    });

    Firebug.registerModule(Crossfire.CrossfireServer);
});