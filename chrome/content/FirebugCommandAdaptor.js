/* See license.txt for terms of usage */
/**
 * FirebugCommandAdaptor
 * 
 */

if (!Crossfire) var Crossfire = {};

// FirebugCommandAdaptor
FBL.ns(function() { with(FBL) {
	
	/**
	 * FirebugCommandAdaptor is an object which accepts protocol
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
		this.contextId = context.window.location.href;
		if (FBTrace.DBG_CROSSFIRE)
			FBTrace.sysout("CROSSFIRE Creating new FirebugCommandAdaptor for context: " + this.contextId);
		this.breakpointIds = 0;
		this.breakpoints = [];
	}

	FirebugCommandAdaptor.prototype = {
		
		/**
		 * continue command. Continue execution of javascript if suspended.
		 * if no <code>stepaction</code> is passed, simply resumes execution.
		 * @param args Arguments object.
		 * Supported arguments:
         * 	 "stepaction": 'in', 'next', or 'out'.
         *   "stepcount": currently ignored.
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
		 * suspend command. Try to suspend any currently running Javascript.
		 */
		"suspend": function() {
			 if (FBTrace.DBG_CROSSFIRE)
				 FBTrace.sysout("CROSSFIRE CommandAdaptor suspend");
			Firebug.Debugger.suspend(this.context);
		},
		
		/**
		 * evaluate command. TODO
		 */
		"evaluate": function( args) {
			 if (FBTrace.DBG_CROSSFIRE)
				 FBTrace.sysout("CROSSFIRE CommandAdaptor evaluate");
		
			var frameNo = args["frame"];
			var expression = args["expression"];
			
		},
		
		/**
		 * getbreakpoints command. Return all the breakpoints in this context.
		 */
		"getbreakpoints": function() {
			var bps = [];
			var self = this;			
			
			if (FBTrace.DBG_CROSSFIRE)
				FBTrace.sysout("CROSSFIRE CommandAdaptor getbreakpoints");
			
	        for (var url in this.context.sourceFileMap) {
	            fbs.enumerateBreakpoints(url, { "call": function(url, line, props, script) {
	            	var found = false;
	            	for (var bp in self.breakpoints) {
	            		if ( (bp.url == url) 
	            				&& (bp.line == line)) {

	            			found = true;
	            			bps.push(bp);
	            			break;
	            		}
	            	}
	            	if (!found) {
	            		var bpId = self.breakpointIds++;

	            		bps.push({
	    					"handle": bpId,
	    					"type": "line",
	    					"line": line,
	    					"target": url
	            		});	            		
	            	}
	            }});
	        }
	        this.breakpoints = bps;
			return {"context_id": this.contextId, "breakpoints": bps};
		},
		
		/**
		 * getbreakpoint command. Return the breakpoint object with the specified id.
		 * @param args Arguments object.
		 * Supported arguments:
		 *   "breakpoint": the id of the breakpoint you want to get.
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
		},
		
		/**
		 * setbreakpoint command. Set a breakpoint and return its id.
		 * @param args Arguments object.
		 * Supported arguments:
		 *   "target": the url of the file to set the breakpoint in.
		 *   "line": line number to set the breakpoint at.
		 */
		"setbreakpoint": function( args) {
			var url = args["target"];
			var line = args["line"];
			if (FBTrace.DBG_CROSSFIRE)
				FBTrace.sysout("CROSSFIRE CommandAdaptor setbreakpoint: url => " + url + " line => " + line);
			
			var bp;
			var breakpoints = this.breakpoints;
			for (var i = 0; i < breakpoints.length; i++) {
				bp = breakpoints[i];
				if (bp.line == line
					&& bp.url == url) {
					return bp.id;
				}
			}
			
			var sourceFile = this.context.sourceFileMap[url];
			if (sourceFile) {
				Firebug.Debugger.setBreakpoint(sourceFile, line);

				if (FBTrace.DBG_CROSSFIRE)
					FBTrace.sysout("CROSSFIRE CommandAdaptor breakpoint set.");
			
				var breakpoint = {
						"handle": bpId,
						"type": "line",
						"line": line,
						"target": url
					};
				var bpId = this.breakpointIds++;
				breakpoints.push(breakpoint);
				
				return {"context_id": this.contextId, "ref": bpId };
			}
		},
		
		/**
		 * changebreakpoint command. Return the breakpoint object with the specified id.
		 * @param args Arguments object.
		 * Supported arguments:
		 *   "breakpoint": the id of the breakpoint you want to change.
		 */
		"changebreakpoint": function( args) {
			var bp;
			var bpId = args["breakpoint"];
			if (FBTrace.DBG_CROSSFIRE)
				FBTrace.sysout("CROSSFIRE CommandAdaptor changebreakpoint id: " + bpId);
			//TODO:
		},
		
		/**
		 * clearbreakpoint command. Remove the breakpoint object with the specified id.
		 * @param args Arguments object.
		 * Supported arguments:
		 *   "breakpoint": the id of the breakpoint you want to remove.
		 */
		"clearbreakpoint": function( args) {
			var breakpoint;
			var bpId = args["breakpoint"];
			if (FBTrace.DBG_CROSSFIRE)
				FBTrace.sysout("CROSSFIRE CommandAdaptor clearbreakpoint id: " + bpId);
			if (bpId) {
				for (var i = 0; i < this.breakpoints.length; i++) {
					if (this.breakpoints[i].handle == bpId) {
						breakpoint = this.breakpoints[i];
						Firebug.Debugger.clearBreakpoint({ "href": breakpoint.target }, breakpoint.line);
						this.breakpoints.splice(i, 1);
						return { "context_id": this.contextId, "breakpoint": breakpoint.handle };
					}
				}
			}
			return false;
		},
		
		/**
		 * frame commmand.  Returns a frame.
		 * @param args Arguments object.
		 * Supported arguments:
		 *   "number": the number (index) of the requested frame. 
		 */
		"frame": function( args) {
			if (FBTrace.DBG_CROSSFIRE)
				FBTrace.sysout("CROSSFIRE CommandAdaptor frame");
			
			var number = args["number"];

			var frame;
			if (this.currentFrame) {
				if (!number) {
					number = 0;
					frame = this.currentFrame;
				} else {
					frame = this.currentFrame.stack[number];
				}
				
				var locals = []; 
				for (var l in frame.scope) {
					if (l != "parent") { // ignore parent
						locals.push({ "name": l, "value" : frame.scope[l] });
					}
				}
				if (frame.thisValue) {
					locals.push({"name": "this", "value": frame.thisValue});				
				}
					
				var scopes = (this.scopes({ "frameNumber": number })).scopes;
				
				return { "context_id": this.contextId,
					"index": frame.frameIndex,		
					"func": frame.functionName,
					"locals": locals,
					"line": frame.line,					
					"scopes": scopes };
			}
			return false;
		},
		
		/**
		 * backtrace command. Returns a backtrace (stacktrace) of frames.
		 * @param args Arguments object.
		 *   Supported arguments:
		 *   	"fromFrame": the frame to start the trace from.
		 *      "toFrame": the frame to to stop the trace at.
		 */
		"backtrace": function( args) {
			if (FBTrace.DBG_CROSSFIRE) 
				FBTrace.sysout("CROSSFIRE CommandAdaptor backtrace");
				
			//var fromFrame = args["fromFrame"];
			//var toFrame = args["toFrame"];
			//TODO: respect args
				
			if (this.currentFrame && this.currentFrame.stack) {
				if (FBTrace.DBG_CROSSFIRE)
					FBTrace.sysout("CROSSFIRE CommandAdaptor backtrace currentFrame.stack => " + this.currentFrame.stack);

				var stack = this.currentFrame.stack;
				var frames = [];
				for (var i = 0; i < stack.length; i++) {
					frames.push(this.frame({ "number": i }));
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
		 * scope command.  Returns a particular scope for the specified frame.
		 */
		"scope": function( args) {
			if (FBTrace.DBG_CROSSFIRE)
				FBTrace.sysout("CROSSFIRE CommandAdaptor scope");

			var scopeNo = args["number"];
			var frameNo = args["frameNumber"];
			if (this.currentFrame) {
				var frame;
				if (!frameNo) {
					frameNo = 0;
					frame = this.currentFrame;
				} else {
					frame = this.currentFrame.stack[frameNo];
				}
				var scope = frame.scope;
				for (var i = 0; i < scopeNo; i++) {
					scope = scope.parent;
					if (!scope) break;
				}
				if (scope) {
					delete scope.parent;
					return {
						"context_id": this.contextId,
						"index": scopeNo,
						"frameIndex": frameNo,
						"object": scope
					};
				}
			}
			return false;
		},
		
		/**
		 * scopes command.  Returns all the scopes for a frame.  
		 */
		"scopes": function( args) {
			if (FBTrace.DBG_CROSSFIRE)
				FBTrace.sysout("CROSSFIRE CommandAdaptor scopes");			
			var scopes = [];
			if (this.currentFrame) {
				var scope;			
				do {
					scope = this.scope({"number": scopes.length, "frameNumber":  args["frameNumber"]});
					if (scope) scopes.push(scope);
				} while(scope);

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
		 * scripts command. TODO
		 */
		"scripts": function( args) {
			if (FBTrace.DBG_CROSSFIRE)
				FBTrace.sysout("CROSSFIRE CommandAdaptor scripts");
		},
		
		/**
		 * source command. TODO
		 */
		"source": function (args) {
			if (FBTrace.DBG_CROSSFIRE)
				FBTrace.sysout("CROSSFIRE CommandAdaptor source");
		}
	};
	
	// export constructor
	Crossfire.FirebugCommandAdaptor = FirebugCommandAdaptor;
	
//end FBL.ns()	
}});