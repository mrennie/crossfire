/* See license.txt for terms of usage */

var Crossfire = Crossfire || {};


// FirebugCommandAdaptor
FBL.ns(function() { with(FBL) {

    /**
     * @name FirebugCommandAdaptor
     * @constructor FirebugCommandAdaptor An object which accepts protocol
     * commands and performs the appropriate Firebug actions, and serializes
     * runtime objects from Firebug into expected formats.
     *
     * Each context in Firebug is associated with a new command adaptor
     * object in order to maintain state independently of other contexts.
     *
     * Arguments to commands are passed as a single JSON object in order to
     * allow named parameters. Supported arguments are listed for each command.
     */
    function FirebugCommandAdaptor( context) {
        this.context = context;
        this.contextId = context.Crossfire.crossfire_id;
        if (FBTrace.DBG_CROSSFIRE)
            FBTrace.sysout("CROSSFIRE Creating new FirebugCommandAdaptor for context: " + this.contextId);
        this.breakpoints = [];
        this.breakpointIds = 1;
        this.clearRefs();
    }

    FirebugCommandAdaptor.prototype =
        /**
         *  @lends FirebugCommandAdaptor
         */
        {

        /**
         * @name FirebugCommandAdaptor.continue
         * @function
         * @description Continue execution of javascript if suspended,
         * if no <code>stepaction</code> is passed, simply resumes execution.
         * @param {Object} args Arguments object.
         * @param args.stepaction <code>stepaction</code>: 'in', 'next', or 'out'.
         * @param args.stepcount <code>stepcount</code>: currently ignored.
         */
        "continue": function( args) {
             if (FBTrace.DBG_CROSSFIRE)
                 FBTrace.sysout("CROSSFIRE CommandAdaptor continue");

            var stepAction = args["stepaction"];
            if (stepAction == "in") {
                Firebug.Debugger.stepInto(this.context);
            } else if (stepAction == "next") {
                Firebug.Debugger.stepOver(this.context);
            } else if (stepAction == "out") {
                Firebug.Debugger.stepOut(this.context);
            } else {
                Firebug.Debugger.resume(this.context);
            }
            return {};
        },

        /**
         * @name FirebugCommandAdaptor.suspend
         * @function
         * @description Try to suspend any currently running Javascript.
         */
        "suspend": function() {
             if (FBTrace.DBG_CROSSFIRE)
                 FBTrace.sysout("CROSSFIRE CommandAdaptor suspend");
            Firebug.Debugger.suspend(this.context);
            return {};
        },

        /**
         * @name FirebugCommandAdaptor.evaluate
         * @function
         * @description evaluate a Javascript expression.
         * If a frame argument is passed, evaluates the expression in that frame,
         * otherwise the expression is evaluated in the context's global scope.
         * @param {Object} args Arguments object.
         * @param {String} args.expression A string of Javascript to be evaluated.
         * @param {Number} args.frame Optional frame to evaluate in.
         */
        "evaluate": function( args) {
             if (FBTrace.DBG_CROSSFIRE)
                 FBTrace.sysout("CROSSFIRE CommandAdaptor evaluate");

            var frameNo = args["frame"];
            var expression = args["expression"];

            var frame;

            if (this.context.Crossfire.currentFrame) {
                if (frameNo == 0) {
                    frame = this.context.Crossfire.currentFrame;
                } else if (frameNo > 0) {
                    frame = this.context.Crossfire.currentFrame.stack[frameNo];
                }
            }

            var result = {};

            if (frame) {
                if (FBTrace.DBG_CROSSFIRE)
                    FBTrace.sysout("CROSSFIRE CommandAdaptor evaluating '" + expression + "' in frame ", frame);

                if (frame.eval(expression, "crossfire_eval_" + this.contextId, 1, result)) {
                    result = unwrapIValue(result.value);
                }
            } else {
                if (FBTrace.DBG_CROSSFIRE)
                    FBTrace.sysout("CROSSFIRE CommandAdaptor evaluating '" + expression + "' in sandbox.");
               result = Firebug.CommandLine.evaluateInSandbox(expression, this.context);
            }

            return { "context_id": this.contextId, "result": result };
        },

        /**
         * @name FirebugCommandAdaptor.getbreakpoints
         * @function
         * @description Return all the breakpoints in this context.
         */
        "getbreakpoints": function() {
            var found, newBp;
            var bps = [];
            var self = this;

            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE CommandAdaptor getbreakpoints");

            // js breakpoints
            for (var url in this.context.sourceFileMap) {
                fbs.enumerateBreakpoints(url, { "call": function(url, line, props, script) {
                    found = false;
                    for (var bp in self.breakpoints) {
                        if ( (bp.url == url)
                                && (bp.line == line)) {
                            found = true;
                            bps.push(bp);
                            break;
                        }
                    }
                    if (!found) {
                        var bp = {
                                "handle": self.breakpointIds++,
                                "type": "line",
                                "line": line,
                                "target": url
                            };
                        bps.push(bp);
                    }
                }});
            }
            this.breakpoints = bps;
            return {"context_id": this.contextId, "breakpoints": bps};
        },

        /**
         * @name FirebugCommandAdaptor.getbreakpoint
         * @function
         * @description Return the breakpoint object with the specified id.
         * @param {Object} args Arguments object.
         * @param args.breakpoint <code>breakpoint</code>: the handle of the breakpoint you want to get.
         */
        "getbreakpoint": function( args) {
            var bp;
            var bpId = args["breakpoint"];
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE CommandAdaptor getbreakpoint id: " + bpId);

            for (var i in this.breakpoints) {
                bp = this.breakpoints[i];
                if (bp && bp.handle == bpId) {
                    return bp;
                }
            }
            return false;
        },

        /**
         * @name FirebugCommandAdaptor.setbreakpoint
         * @function
         * @description Set a breakpoint and return its id.
         * @param {Object} args Arguments object
         * @param args.target <code>target</code>: the url of the file to set the breakpoint in.
         * @param args.line <code>line</code>: line number to set the breakpoint at.
         */
        "setbreakpoint": function( args) {
            var url = args["target"];
            var line = args["line"];
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE CommandAdaptor setbreakpoint: url => " + url + " line => " + line);

            var bp, breakpoint;
            var breakpoints = this.breakpoints;
            for (var i = 0; i < breakpoints.length; i++) {
                bp = breakpoints[i];
                if (bp.line == line
                    && bp.url == url) {
                    breakpoint = bp;
                    break;
                }
            }
            if (!breakpoint) {
                var breakpoint = {
                        "handle": this.breakpointIds++,
                        "type": "line",
                        "line": line,
                        "target": url
                    };

                breakpoints.push(breakpoint);

                var sourceFile = this.context.sourceFileMap[url];
                if (sourceFile) {
                    Firebug.Debugger.setBreakpoint(sourceFile, line);
                }

                if (FBTrace.DBG_CROSSFIRE)
                    FBTrace.sysout("CROSSFIRE CommandAdaptor breakpoint set.");

            }
            return {"context_id": this.contextId, "breakpoint": breakpoint  };

        },

        /**
         * @name FirebugCommandAdaptor.changebreakpoint
         * @function
         * @description Return the breakpoint object with the specified id.
         * @param {Object} args Arguments object
         * @param args.breakpoint <code>breakpoint</code>: the id of the breakpoint you want to change.
         */
        "changebreakpoint": function( args) {
            var bp;
            var bpId = args["breakpoint"];
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE CommandAdaptor changebreakpoint id: " + bpId);
            //TODO:
            return false;
        },

        /**
         * @name FirebugCommandAdaptor.clearbreakpoint
         * @function
         * @description Remove the breakpoint object with the specified id.
         * @param {Object} args Arguments object
         * @param args.breakpoint <code>breakpoint</code>: the id of the breakpoint you want to remove.
         */
        "clearbreakpoint": function( args) {
            var breakpoint;
            var bpId = args["handle"];
            var target = args["target"];
            var line = args["line"];
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE CommandAdaptor clearbreakpoint id: " + bpId);
            if (bpId || (target && line)) {
                for (var i = 0; i < this.breakpoints.length; i++) {
                    if ( (bpId && this.breakpoints[i].handle == bpId)
                        || (target && line && this.breakpoints[i].target == target && this.breakpoints[i].line == line) )
                    {
                        breakpoint = this.breakpoints[i];
                        Firebug.Debugger.clearBreakpoint({ "href": breakpoint.target }, breakpoint.line);
                        this.breakpoints.splice(i, 1);
                        return { "context_id": this.contextId, "breakpoint": breakpoint.handle };
                    }
                }

                // if we get here crossfire didn't know about the breakpoint,
                // but if we have target and line arguments, try to clear it anyway.
                if (target && line) {
                    Firebug.Debugger.clearBreakpoint({ "href": target }, line);
                    return { "context_id": this.contextId };
                }
            }
            return false;
        },

        /**
         * @name FirebugCommandAdaptor.frame
         * @function
         * @description Returns a frame.
         * @param {Object} args Arguments object.
         * @param {Number} args.number <code>number</code>: the number (index) of the requested frame.
         * @param {Boolean} args.includeScopes <code>includeScopes</code> defaults to true.
         */
        "frame": function( args) {
            var number = args["number"];

            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE CommandAdaptor frame: number => ", number);

            var includeScopes = (typeof(args["includeScopes"]) != "undefined")  ? args["includeScopes"] : true;

            var frame;
            if (this.context.Crossfire.currentFrame) {
                if (!number) {
                    number = 0;
                    frame = this.context.Crossfire.currentFrame;
                } else if (this.context.Crossfire.currentFrame.stack) {
                    frame = this.context.Crossfire.currentFrame.stack[number-1];
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
                        var scopes = (this.scopes({ "frameNumber": number })).scopes;
                    }

                    return { "context_id": this.contextId,
                        "index": frame.frameIndex,
                        "func": frame.functionName,
                        "script": frame.script,
                        "locals": locals,
                        "line": frame.line,
                        "scopes": scopes };
                } catch (exc) {
                    if (FBTrace.DBG_CROSSFIRE)
                        FBTrace.sysout("CROSSFIRE exception returning frame ", exc);
                }
            }
            return false;
        },

        /**
         * @name FirebugCommandAdaptor.backtrace
         * @function
         * @description Returns a backtrace (stacktrace) of frames.
         * @param {Object} args Arguments object
         * @param {Number} args.fromFrame <code>fromFrame</code>: the frame to start the trace from.
         * @param {Number} args.toFrame <code>toFrame</code>: the frame to to stop the trace at.
         * @param {Boolean} args.includeScopes <code>includeScopes</code> defaults to false.
         */
        "backtrace": function( args) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE CommandAdaptor backtrace");

            args = args || {};

            if (this.context.Crossfire.currentFrame) {
                var fromFrame, toFrame;
                var stack = this.context.Crossfire.currentFrame.stack;

                if (FBTrace.DBG_CROSSFIRE)
                    FBTrace.sysout("CROSSFIRE CommandAdaptor backtrace currentFrame.stack => " + stack);

                var includeScopes = (typeof(args["includeScopes"]) != "undefined")  ? args["includeScopes"] : true;

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
                    frame = this.frame({ "number": i, "includeScopes": includeScopes });
                    if (frame) {
                        delete frame.context_id;
                        frames.push(frame);
                    }
                }

                return {
                    "context_id": this.contextId,
                    "fromFrame": 0,
                    "toFrame": frames.length-1,
                    "totalFrames": frames.length,
                    "frames": frames
                };
            }
            return false;
        },

        /**
         * @name FirebugCommandAdaptor.scope
         * @function
         * @description Returns a particular scope for the specified frame.
         * @param {Object} args Arguments object.
         * @param args.number <code>number</code>: scope index
         * @param args.frameNumber <code>frameNumber</code>: optional frame index. defaults to 0
         */
        "scope": function( args) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE CommandAdaptor scope");

            var scope;
            var scopeNo = args["number"];
            var frameNo = args["frameNumber"];
            if (this.context.Crossfire.currentFrame) {
                if (scopeNo == 0) {
                    // only return a reference to the global scope
                    scope = this.getRef(this.context.window.wrappedJSObject);
                } else {
                    var frame;
                    if (!frameNo) {
                        frameNo = 0;
                        frame = this.context.Crossfire.currentFrame;
                    } else {
                        frame = this.context.Crossfire.currentFrame.stack[frameNo-1];
                    }
                    scope = frame.scope;
                    for (var i = 0; i < scopeNo; i++) {
                        scope = scope.parent;
                        if (!scope) break;
                    }
                }
            } else if (scopeNo == 0) {
              scope = this.context.window.wrappedJSObject;
              frameNo = -1;
            }

            if (scope) {
                return {
                    "context_id": this.contextId,
                    "index": scopeNo,
                    "frameIndex": frameNo,
                    "object": scope
                };
            }

            return false;
        },

        /**
         * @name FirebugCommandAdaptor.scopes
         * @function
         * @description  Returns all the scopes for a frame.
         *
         * @param {Object} args Arguments object.
         * @param args.frameNumber <code>frameNumber</code>: optional frame index. defaults to 0
         */
        "scopes": function( args) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE CommandAdaptor scopes");
            var scopes = [];

            var scope;
            do {
                scope = this.scope({"number": scopes.length, "frameNumber":  args["frameNumber"]});
                if (scope) {
                    delete scope.context_id;
                    scopes.push(scope);
                }
            } while(scope);

            if (scopes.length > 0) {
              return {
                  "context_id": this.contextId,
                  "fromScope": 0,
                  "toScope": scopes.length-1,
                  "totalScopes": scopes.length,
                  "scopes": scopes
              };
            }

            return false;
        },

        /**
         * @name FirebugCommandAdaptor.scripts
         * @function
         * @description Retrieve a single script
         * @param {Object} args Arguments object.
         * @param {Boolean} args.includeSource <code>includeSource</code>
         * @param {String} args.url url of the script to return.
         */
        "script": function( args) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE CommandAdaptor scripts");

            var lines, sourceFile, script;
            var incSrc = args["includeSource"];
            var url = args["url"];

            var srcMap = this.context.sourceFileMap;

            sourceFile = srcMap[url];
            try {
                lines = sourceFile.loadScriptLines(this.context);
            } catch (ex) {
                lines = [];
                if (FBTrace.DBG_CROSSFIRE)
                    FBTrace.sysout("CROSSFIRE: failed to get source lines for script : " +ex);
            }
            var srcLen;
            try {
                srcLen = sourceFile.getSourceLength();
            } catch(exc) {
                if (FBTrace.DBG_CROSSFIRE)
                    FBTrace.sysout("CROSSFIRE: failed to get source length for script : " +exc);
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
                script["source"] = lines.join('\n');
            }

            return { "context_id": this.contextId, "script": script };

        },

        /**
         * @name FirebugCommandAdaptor.scripts
         * @function
         * @description Retrieve all known scripts.
         * @param {Object} args Arguments object.
         * @param args.includeSource <code>includeSource</code>: boolean
         */
        "scripts": function ( args) {
            var incSrc = args["includeSource"];
            var srcMap = this.context.sourceFileMap;
            var scripts = [];
            var script;
            for (var url in srcMap) {
                script = this.script({ "url": url, "includeSource": incSrc });
                if (script) {
                    delete script.context_id;
                    scripts.push( script );
                }
            }

            return { "context_id": this.contextId, "scripts": scripts };
        },

        /**
         * @name FirebugCommandAdaptor.source
         * @function
         * @description source command. Return the source code for every script in this context.
         */
        "source": function ( args) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE CommandAdaptor source");
            args = args || {};
            args["includeSource"] = true;
            return this.scripts(args);
        },

        /**
         * @name FirebugCommandAdaptor.inspect
         * @function
         * @description Tells Firebug to enter 'inspect' mode.
         * @param {Object} args Arguments object
         * @param args.xpath <code>xpath</code>: optional xpath for the node to inspect.
         * @param args.selector <code>selector</code>: optional css selector for a specific node to inspect
         */
        "inspect": function( args) {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE CommandAdaptor inspect: args => ", args);

            var selector = args["selector"];
            var xpath = args["xpath"];
            var doc = this.context.window.document;
            var node;

            if (xpath) {
                node = FBL.getElementsByXPath(doc, xpath)[0];
            } else if (selector) {
                node = FBL.getElementsBySelector(doc, selector)[0];
            }

            Firebug.toggleBar(true);
            Firebug.Inspector.startInspecting(this.context);
            if (node) {
                if (node.wrappedJSObject)
                    node = node.wrappedJSObject;

                if (FBTrace.DBG_CROSSFIRE)
                    FBTrace.sysout("CROSSFIRE CommandAdaptor inspect found node: " + node);
                setTimeout(function() {
                    Firebug.Inspector.inspectNode(node);
                    FirebugChrome.select(node, 'html');
                });
            }
        },

        /**
         * @name FirebugCommandAdaptor.lookup
         * @function
         * @description Lookup an object by it's handle.
         * @param {Object} args Arguments object
         * @param args.handle the handle id to look up.
         */
        "lookup": function( args) {
            var handle = args["handle"];
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE CommandAdaptor lookup: handle => " + handle);
            var obj;
            if (handle) {
                for (var i in this.refs) {
                    if (i == handle) {
                        obj = this.refs[i];
                        if (FBTrace.DBG_CROSSFIRE)
                            FBTrace.sysout("CROSSFIRE CommandAdaptor lookup found object for handle: " + handle, obj);
                        break;
                    }
                }
            }
            return { "context_id": this.contextId, "type": typeof(obj), "value": this.serialize(obj) };
        },

        /**
         * @function serialize
         * @description prepare a javascript object to be serialized into JSON.
         * @param {Object} obj the javascript thing to serialize
         * @param {Boolean} incContext boolean indicates whether the context id field should be included.
         */
        serialize: function( obj, incContext) {
            try {
                //if (FBTrace.DBG_CROSSFIRE)
                  //  FBTrace.sysout("CROSSFIRE CommandAdaptor serialize => ", obj);

                var type = typeof(obj);

                var serialized = {
                        "type": type,
                        "value": ""
                }

                if (incContext) {
                    serialized["context_id"] = this.contextId;
                }

                if (type == "object") {
                    if (obj == null) {
                         serialized["value"] = "null";
                    } else if (obj.type && obj.type == "ref" && obj.handle) {
                        // already serialized
                        serialized = obj;
                    } else if (obj instanceof Array) {
                        var arr = "[";
                        for (var i = 0; i < obj.length; i++) {
                            arr += JSON.stringify(this.serialize(obj[i]));
                            if (i < obj.length-1) {
                                arr += ',';
                            }
                        }
                        serialized["value"] = arr + "]";
                    } else {
                        var ref = this.getRef(obj);
                        var o = {};
                        for (var p in obj) {
                            try {
                                if (obj.hasOwnProperty(p) && !(p in ignoreVars)) {
                                    var prop = obj[p];
                                    if (typeof(prop) == "object") {
                                        if (prop == null) {
                                            o[p] = "null";
                                        } else if (prop && prop.type && prop.type == "ref" && prop.handle) {
                                            o[p] = prop;
                                        } else  {
                                            o[p] = this.getRef(prop);
                                        }
                                    } else if (p === obj) {
                                        o[p] = ref;
                                    } else {
                                        o[p] = this.serialize(prop);
                                    }
                                }
                            } catch (x) {
                                o[p] =  { "type": "string", "value": "crossfire serialization exception: " + x };
                            }
                        }
                        serialized["value"] = o;
                    }
                } else if (type == "function") {
                    serialized["value"] =  obj.name ? obj.name + "()" : "function()";
                } else {
                    serialized["value"] = obj;
                }

                return serialized;

            } catch (e) {
                return { "type": "string", "value": "crossfire serialization exception: " + e }
            }
        },

        /*
         * @ignore
         */
        getRef: function( obj, incContext) {
            //if (FBTrace.DBG_CROSSFIRE)
              //  FBTrace.sysout("CROSSFIRE CommandAdaptor getRef", obj);
            if (obj && obj.type && obj.type == "ref" && obj.handle) {
                FBTrace.sysout("CROSSFIRE CommandAdaptor getRef tried to get ref for serialized obj");
                return;
            }

            var ref = { "type":"ref", "handle": -1 };
            if (incContext) {
                ref["context_id"] = this.contextId;
            }
            for (var i in this.refs) {
                if (this.refs[i] === obj) {
                    //if (FBTrace.DBG_CROSSFIRE)
                      //  FBTrace.sysout("CROSSFIRE CommandAdaptor getRef ref exists with handle: " + i, obj);
                    ref["handle"] = i;
                    return ref;
                }
            }
            var handle = ++this.refCount;
            this.refs[handle] = obj;
            //if (FBTrace.DBG_CROSSFIRE)
                //FBTrace.sysout("CROSSFIRE CommandAdaptor getRef new ref created with handle: " + handle, obj);
            ref["handle"] = handle;
            return ref;
        },

        /*
         * @ignore
         */
        clearRefs: function() {
            this.refCount = 0;
            this.refs = [];
        },

        /*
         * @ignore
         * add breakpoints that were set before the sourceFile was loaded.
         */
        sourceFileLoaded: function( sourceFile) {
            for (var bp in this.breakpoints) {
                if (bp.target == sourceFile.href) {
                    line = bp.line;
                    Firebug.Debugger.setBreakpoint(sourceFile, line);
                }
            }
        }
    };

 // ripped-off from Firebug dom.js
    const ignoreVars =
    {
        "__firebug__": 1,
        "eval": 1,

        // We are forced to ignore Java-related variables, because
        // trying to access them causes browser freeze
        "java": 1,
        "sun": 1,
        "Packages": 1,
        "JavaArray": 1,
        "JavaMember": 1,
        "JavaObject": 1,
        "JavaClass": 1,
        "JavaPackage": 1,
        "_firebug": 1,
        "_FirebugConsole": 1,
        "_FirebugCommandLine": 1,
    };

    // export constructor
    Crossfire.FirebugCommandAdaptor = FirebugCommandAdaptor;

//end FBL.ns()
}});
