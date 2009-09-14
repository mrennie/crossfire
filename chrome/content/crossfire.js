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
			
			this.transport = SocketTransport.createInstance().wrappedJSObject;
			this.transport.open(host, port);
			
			this.transport.addListener(this);
			
			Firebug.Debugger.addListener(this);
		    Firebug.Console.addListener(this);
		    Firebug.Inspector.addListener(this);

			this.running = true;
		},
		
		// ----- Crossfire transport listener -----
		
		/**
		 * @description 
		 * Listener function called by the transport when a request is
		 * received.
		 * 
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
				var args = request.arguments;
				response = commandAdaptor[command].apply(commandAdaptor, [ args ]);
			}
			
			if (response) {
				if (FBTrace.DBG_CROSSFIRE)
					FBTrace.sysout("CROSSFIRE sending response => " + response.toSource());
				this.transport.sendResponse(command, request.seq, response, this.running, true);
			} else {
				this.transport.sendResponse(command, request.seq, {}, this.running, false);
			}
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
			this.transport.sendEvent("navigated", { "data":  contextId });			
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
				if (this.contexts[i].window.location.href == contextId) {
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
		 * and send "onBreak" event.
		 */
		onStartDebugging: function( context) {
			if (FBTrace.DBG_CROSSFIRE)
				FBTrace.sysout("CROSSFIRE:  onStartDebugging");
							
			var frame = context.currentFrame;
			var lineno = 1;
			var sourceFile = getSourceFileByScript(context, frame.script)
			if (sourceFile) {
				var analyzer = sourceFile.getScriptAnalyzer(frame.script);
				if (analyzer)
					lineno = analyzer.getSourceLineFromFrame(context, frame);					
			}
			var href = sourceFile.href.toString();
			var contextId = context.window.location.href;
			var args = { "url" : href, "line": lineno, "context_id": contextId };

			var copiedFrame = this.copyFrame(frame);
			
			context.Crossfire.commandAdaptor.currentFrame = copiedFrame;
			this.transport.sendEvent("onBreak", args);
			this.running = false;
		},
		
		onStop: function(context, frame, type, rv) {
			if (FBTrace.DBG_CROSSFIRE)
				FBTrace.sysout("CROSSFIRE:  onStop");

		},
		
		/**
		 * Send "onResume" event.
		 */
		onResume: function( context) {
			if (FBTrace.DBG_CROSSFIRE)
				FBTrace.sysout("CROSSFIRE: onResume");
			var contextId = context.window.location.href;
			context.Crossfire.commandAdaptor.currentFrame = null;
			this.transport.sendEvent("onResume", { "context_id": contextId });
			this.running = true;
		},
		
		/**
		 * Send "onToggleBreakpoint" event.
		 */
		onToggleBreakpoint: function(context, url, lineNo, isSet, props) {
			if (FBTrace.DBG_CROSSFIRE)
				FBTrace.sysout("CROSSFIRE: onToggleBreakpoint");
			var contextId = context.window.location.href;
			this.transport.sendEvent("onToggleBreakpoint", { "context_id": contextId });
		},
		
		/**
		 * Send "onToggleBreakpoint" event.
		 */
		onToggleErrorBreakpoint: function(context, url, lineNo, isSet, props) {
			if (FBTrace.DBG_CROSSFIRE)
				FBTrace.sysout("CROSSFIRE: onToggleErrorBreakpoint");
			var contextId = context.window.location.href;
			this.transport.sendEvent("onToggleBreakpoint", { "context_id": contextId });
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
		 * The object or message logged is contained in the packet's "data" property.
		 * The generated event names are:
		 * 		onConsoleLog
		 * 		onConsoleDebug
		 * 		onConsoleInfo
		 * 		onConsoleWarn
		 * 		onConsoleError
		 */
	    logFormatted: function(context, objects, className, sourceLink) {
	    	if (FBTrace.DBG_CROSSFIRE)
	    		FBTrace.sysout("CROSSFIRE logFormatted");
	    	
	    	var win = context.window;	    	
	    	var contextId = win.location.href;
	    	var eventName = "onConsole" + className.substring(0,1).toUpperCase() + className.substring(1);	    	
	    	var data = (win.wrappedJSObject?win.wrappedJSObject:win)._firebug.userObjects;
	    	
	    	if (FBTrace.DBG_CROSSFIRE) {
	    		FBTrace.sysout("CROSSFIRE logFormatted eventName => " + eventName);
	    		FBTrace.sysout("CROSSFIRE logFormatted data => " + data);
	    	}
	    	
	    	this.transport.sendEvent(eventName, { "context_id": contextId, "data": data });
	    },
		
		// ----- Firebug.Inspector Listener -----
	    onInspectNode: function(context, node) {
	    	if (FBTrace.DBG_CROSSFIRE)
	    		FBTrace.sysout("CROSSFIRE onInspectNode: node => " + node);
	    	//try {
	    		//node = node.getWrappedValue();
	    	//} catch (exc) {
	    	//	FBTrace.sysout("CROSSFIRE onInspectNode exception: " + exc);
	    		node = node.toString();
	    	//}
	    		
	    	var contextId = context.window.location.href;
	    	this.transport.sendEvent("onInspectNode", { "context_id": contextId, "data": { "node": node } });
	    },
	    
	    onStopInspecting: function(context, node) {
	    	if (FBTrace.DBG_CROSSFIRE)
	    		FBTrace.sysout("CROSSFIRE onStopInspecting");
	    	
	    	var contextId = context.window.location.href;
	    	this.transport.sendEvent("onStopInspecting", { "context_id": contextId });
	    }
	});
	
	// register module
	Firebug.registerModule(CrossfireModule);
	
//end FBL.ns()	
}});