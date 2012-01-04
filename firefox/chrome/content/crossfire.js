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

Components.utils.import("resource://crossfire/SocketTransport.js");

FBL.ns(function() {

    /**
     * @name Crossfire
     * @module Firebug Module for Crossfire. This module acts as a controller
     * between Firebug and the remote debug connection.  It is responsible for
     * opening a connection to the remote debug host.
     */
    Crossfire = FBL.extend(Firebug.Module,  {
        contexts: [],
        refs: [],
        registeredTools: [],
        dispatchName: "Crossfire",
        toolName: "all", // receive all packets, regardless of 'tool' header
        version: CROSSFIRE_VERSION,
        status: CROSSFIRE_STATUS.STATUS_DISCONNECTED,

        /**
         * @name initialize
         * @description Initializes Crossfire
         * @function
         * @private
         * @memberOf Crossfire
         * @extends Firebug.Module
         */
        initialize: function() {
	        if (FBTrace.DBG_CROSSFIRE) {
	            FBTrace.sysout("CROSSFIRE initialize");
	        }
	        // -- register tools --
	        this.registeredTools = [];
            this._registerTool(new Crossfire.ConsoleTool());
            this._registerTool(new Crossfire.InspectorTool());
            this._registerTool(new Crossfire.NetTool());
            this._registerTool(new Crossfire.DomTool());

            // initialize refs
            this._clearRefs();
            this.status = CROSSFIRE_STATUS.STATUS_DISCONNECTED;
        },

        /**
         * @name getTransport
         * @description Returns the currently used CrossfireSocketTransport. If the transport has not been created
         * yet, a new one is created and returned
         * @function
         * @public
         * @memberOf Crossfire
         * @returns a new CrossfireSocketTransport
         */
        getTransport: function() {
        	if (FBTrace.DBG_CROSSFIRE) {
	            FBTrace.sysout("CROSSFIRE getTransport");
	        }
            this._ensureTransport();
            return this.serverTransport;
        },

        /**
         * @name getServerPort
         * @description Returns the integer port number specified on the command line
         * @function
         * @public
         * @memberOf Crossfire
         * @returns the integer port number
         */
        getServerPort: function() {
            var commandLine = Components.classes["@almaden.ibm.com/crossfire/command-line-handler;1"].getService().wrappedJSObject;
            var port = commandLine.getServerPort();
            return port;
        },
        
        /**
         * @name _ensureTransport
         * @description tries to load the transport module if it has not already been loaded
         * @function
         * @private
         */
        _ensureTransport: function() {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("Crossfire _ensureTransport");
            }
            if (! this.serverTransport) {
                this.serverTransport = getCrossfireServer();
                this.serverTransport.addListener(this);
            }
        },

        /**
         * @name disconnect
         * @description Disconnects the current connection and closes the socket.
         * @function
         * @public
         * @memberOf Crossfire
         */
        disconnect: function() {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE disconnect");
            }
            if (this.status == CROSSFIRE_STATUS.STATUS_CONNECTED_SERVER
                    || this.status == CROSSFIRE_STATUS.STATUS_WAIT_SERVER) {
                this.serverTransport.close();
            }
            this._clearRefs();
            this._unregisterTool("console");
            this._unregisterTool("inspector");
            this._unregisterTool("net");
            this._unregisterTool("dom");
            this.registeredTools = [];
            this._updatePanel();
        },

        /**
         * @name _getDialogParams
         * @description Fetches the entered parameters from the server-start dialog
         * @function
         * @private
         * @memberOf Crossfire
         * @type Array
         * @returns an Array of dialog parameters
         */
        _getDialogParams: function() {
        	if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE _getDialogParams");
            }
            var commandLine = Components.classes["@almaden.ibm.com/crossfire/command-line-handler;1"].getService().wrappedJSObject;
            var host = commandLine.getHost();
            var port = commandLine.getPort();
            var title = "Crossfire - Start Server";
            return { "host": null, "port": null, "title": title, "cli_host": host, "cli_port": port };
        },


        /**
         * @name onConnectionStatusChanged
         * @description Called when the status of the transport's connection changes.
         * @function
         * @public
         * @memberOf Crossfire
         * @param {String} status the status to report
         */
        onConnectionStatusChanged: function( status) {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE onConnectionStatusChanged: " + status);
            }
            this.status = status;
            this.updateStatusText(status);
            this.updateStatusIcon(status);
            this._updatePanel();
            if (this.status == CROSSFIRE_STATUS.STATUS_DISCONNECTED) {
                this.serverTransport = null;
            }
        },

        /**
         * @name _updatePanel
         * @description call-back to update the UI of the Remote panel
         * @function
         * @private
         * @memberOf Crossfire
         * @since 0.3a8
         */
        _updatePanel: function() {
        	if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE _updatePanel");
            }
            if (this.panel) {
                try {
                    this.panel.refresh(status);
                } catch (ex) {
                    if (FBTrace.DBG_CROSSFIRE)
                        FBTrace.sysout("Crossfire failed to update panel status.");
                }
            }
        },

        /**
         * @name _registerTool
         * @description caches the given tool by its name and calls back to <code>#onRegistered()</code>
         * @function
         * @private
         * @memberOf Crossfire
         * @param tool {@link Object} the tool itself
         * @since 0.3a7
         */
        _registerTool: function(tool) {
        	var name = tool.getToolName();
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE: _registerTool " + name, tool);
            }
            try {
                this.registeredTools[name] = tool;
                if (tool.onRegistered) {
                    tool.onRegistered();
                }
                if (this.status == "connected_server") {
                    tool.onTransportCreated(this.serverTransport);
                }
            } catch(e) {
                if (FBTrace.DBG_CROSSFIRE) {
                    FBTrace.sysout("CROSSFIRE: _registerTool fails: " + e, e);
                }
            }
        },

        /**
         * @name _unregisterTool
         * @description removes the tool with the given name and calls-back to the function <code>#onUnregistered()</code>
         * @function
         * @private
         * @memberOf Crossfire
         * @param name the {@link String} name of the tool
         * @since 0.3a7
         */
        _unregisterTool: function(name) {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE: _unregisterTool " + name);
            }
            try {
                var tool = this.registeredTools[name];
                delete this.registeredTools[name];
                if (tool.onUnregistered) {
                	tool.onUnregistered();
                }
            } catch (e) {
                if (FBTrace.DBG_CROSSFIRE) {
                    FBTrace.sysout("CROSSFIRE: _unregisterTool fails: " + e, e);
                }
            }
        },

        /**
         * @name enableTools
         * @description enables all of the tools with the given names 
         * @function
         * @public
         * @memberOf Crossfire
         * @param tools the {@link Array} of tool names of type {@link String}
         * @returns the Array of tools that were enabled
         * @since 0.3a7
         */
        enableTools: function(tools) {
        	var enabletools = [];
            if (typeof tools == "array" ) {
                for (var t in tools) {
                     try {
                    	var enabledtool = this.activateTool(tools[t]);
                    	if(enabledtool) {
                    		enabledtools.push(enabledtool);
                    	}
                    } catch (e) {
                        if (FBTrace.DBG_CROSSFIRE) {
                            FBTrace.sysout("CROSSFIRE: enableTools fails for tool: " + t, e);
                        }
                    }
                }
            }
            return enabledtools;
        },

        /**
         * @name disableTools
         * @description disables all of the tools with the given names 
         * @function
         * @public
         * @memberOf Crossfire
         * @param tools the {@link Array} of tool names of type {@link String}
         * @returns the array of tools that were disabled
         * @since 0.3a7
         */
        disableTools: function(tools) {
        	var distools = [];
            if (typeof tools == "array" ) {
                for (var t in tools) {
                     try {
                        var distool = this.deactivateTool(tools[t]);
                        if(distool) {
                        	distools.push(distool);
                        }
                    } catch (e) {
                        if (FBTrace.DBG_CROSSFIRE) {
                            FBTrace.sysout("CROSSFIRE: disableTool fails for " + t + " , " +e);
                        }
                    }
                }
            }
            return distools;
        },

        /**
         * @name activateTool
         * @description Attempts to activate the registered tool with the given name 
         * @function
         * @public
         * @memberOf Crossfire
         * @param name the {@link String} name of the tool to try and activate
         * @returns the tool {@link Object} that was activated or <code>null</code> if the tool could not be activated
         * @since 0.3a7
         */
        activateTool: function(name) {
            if (name in this.registeredTools) {
                 if (FBTrace.DBG_CROSSFIRE) {
                     FBTrace.sysout("CROSSFIRE: activateTool " + name);
                 }
                 var tool = this.registeredTools[name];
                 try {
                     if (this.status == CROSSFIRE_STATUS.STATUS_CONNECTING || this.status == CROSSFIRE_STATUS.STATUS_CONNECTED_SERVER) {
                         tool.onTransportCreated(this.serverTransport);
                     }
                     tool.activated = true;
                     return tool;
                 } catch (e) {
                     FBTrace.sysout("exception activationg tool: "+name, e);
                 }
            }
            return null;
        },

        /**
         * @name deactivateTool
         * @description Attempts to deactivate the registered tool with the given name 
         * @function
         * @public
         * @memberOf Crossfire
         * @param name the {@link String} name of the tool to try and activate
         * @returns the tool {@link Object} that was deactivated or <code>null</code> if the tool could not be deactivated
         * @since 0.3a7
         */
        deactivateTool: function(name) {
            if (name in this.registeredTools) {
                if (FBTrace.DBG_CROSSFIRE) {
                    FBTrace.sysout("CROSSFIRE: deactivateTool" + name);
                }
                var tool = this.registeredTools[name];
                try {
                    tool.onTransportDestroyed(this.transport);
                    tool.activated = false;
                    return tool;
                } catch (e) {
                    FBTrace.sysout("exception deactivationg tool: "+name, e);
                }
            }
            return null;
        },

        /**
         * @name getTools
         * @description Returns the complete list of registered tools 
         * @function
         * @public
         * @memberOf Crossfire
         * @returns the complete list of registered tools
         * @since 0.3a7
         */
        getTools: function() {
        	if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE: getTools");
            }
            var tools = [];
            for (var name in this.registeredTools) {
                tools.push(this.registeredTools[name].asObject());
            }
            return { "tools": tools };
        },

        /**
         * @name _getRef
         * @description Returns a reference id for the given object handle
         * @function
         * @private
         * @memberOf Crossfire
         * @type Array
         * @returns the Array object describing the object handle, contains <code>ref.handle</code>,
         * <code>ref.type</code> and optionally <code>ref.contextId</code>
         * @since 0.3a1
         */
        _getRef: function(obj, contextId) {
            try {
                if (obj && obj.type && obj.handle) {
                    FBTrace.sysout("CROSSFIRE _getRef tried to get ref for serialized obj");
                    return null;
                }
                var ref = { "type":typeof(obj), "handle": -1 };
                if (contextId) {
                    ref["contextId"] = contextId;
                }
                for (var i = 0; i < this.refs.length; i++) {
                    if (this.refs[i] === obj) {
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
            }
            catch(ex) {
                if(FBTrace.DBG_CROSSFIRE) {
                    FBTrace.sysout("CROSSFIRE _getRef failed: "+ex.message, obj);
                }
                return null;
            }
        },

        /**
         * @name _clearRefs
         * @description clears the reference id cache
         * @function
         * @private
         * @memberOf Crossfire
         * @since 0.3a1
         */
        _clearRefs: function() {
            this.refCount = 0;
            this.refs = [];
        },

        /**
         * @name serialize
         * @description prepare a JavaScript object to be serialized into JSON.
         * @function
         * @private
         * @memberOf Crossfire
         * @param obj the JavaScript {@link Object} to serialize
         */
        serialize: function(obj) {
            try {
                var type = typeof(obj);
                var serialized = {
                        "type": type,
                        "value": ""
                };
                if (type == "object" || type == "function") {
                    if (obj == null) {
                         serialized["value"] = "null";
                    } else if (obj.type && obj.handle) {
                        // already serialized
                        serialized = obj;
                    } else if (obj instanceof Array) {
                        var arr = [];
                        for (var i = 0; i < obj.length; i++) {
                            arr.push(this.serialize(obj[i]));
                        }
                        serialized["value"] = arr;
                    } else {
                        var ref = this._getRef(obj);
                        serialized["value"] = this._serializeProperties(obj, ref);
                    }
                } else if (type == "number" && (
                    isNaN(obj)
                    || obj == Infinity
                    || obj == -Infinity)) {
                        serialized["value"] = obj.toString();
                } else {
                    serialized["value"] = obj;
                }
                return serialized;
            } catch (e) {
                if (FBTrace.DBG_CROSSFIRE_SERIALIZE) {
                    FBTrace.sysout("CROSSFIRE serialize failed: " + e.message, obj);
                }
                return null;
            }
        },

        /**
         * @name _serializeProperties
         * @description Serializes the properties for the given object
         * @function
         * @private
         * @memberOf Crossfire
         * @param obj the {@link Object} to serialize the properties for
         * @param the computed reference id for <code>obj</code>
         * @type Object
         * @returns an object describing the serialized properties of the given object
         * @since 0.3a2
         */
        _serializeProperties: function(obj, ref) {
            var properties;
            if (FBTrace.DBG_CROSSFIRE_SERIALIZE) {
                FBTrace.sysout("CROSSFIRE: _serializeProperties", obj);
            }
            if ((typeof(obj)).indexOf("XrayWrapper" != -1)) {
                if (FBTrace.DBG_CROSSFIRE_SERIALIZE) {
                    FBTrace.sysout("CROSSFIRE: _serializeProperties unwrapping XrayWrapper", obj);
                }
                try {
                    //obj = FBL.unwrapIValue(obj);
                     obj = XPCNativeWrapper.unwrap(obj);
                     properties = [];
                     for (var p in obj) {
                    	 properties.push(p);
                     }
                } catch (ex) {
                    if (FBTrace.DBG_CROSSFIRE_SERIALIZE) {
                      FBTrace.sysout("CROSSFIRE: _serializeProperties can't unwrap XrayWrapper: " + ex.message, obj);
                    }
                }
            }
            else if (obj instanceof Object && Object.keys) {
                if (FBTrace.DBG_CROSSFIRE_SERIALIZE) {
                    FBTrace.sysout("CROSSFIRE: _serializeProperties getting Object.keys()");
                }
                properties = Object.keys(obj);
            }
            else {
                properties = [];
                for (var p in obj) {
                    try {
                        if (Object.prototype.hasOwnProperty.call(obj,p)) {
                            properties.push(p);
                        }
                    } catch (exc) {
                        if (FBTrace.DBG_CROSSFIRE_SERIALIZE) {
                            FBTrace.sysout("CROSSFIRE: _serializeProperties exception: " + exc.message, exc);
                        }
                    }
                }
            }
            var o = {};
            for (var index = 0; index < properties.length; index++) {
                try {
                	var pName = properties[index];
                	var prop = obj[pName];
                    if (typeof(prop) == "object" || typeof(prop) == "function") {
                        if (prop == null) {
                            o[pName] = this.serialize(prop);//"null";
                        } else if (prop && prop.type && prop.handle) {
                            o[pName] = prop;
                        } else  {
                            o[pName] = this._getRef(prop);
                        }
                    }
                    else if (pName === obj) {
                        o[pName] = ref;
                    }
                    else {
                        o[pName] = this.serialize(prop);
                    }
                } catch (x) {
                	o[pName] = this.serialize(x.message);
                    if(FBTrace.DBG_CROSSFIRE_SERIALIZE) {
                        FBTrace.sysout("CROSSFIRE _serializeProperties failed for: "+pName, prop);
                    }
                }
            }
            if(!o.constructor && obj.constructor && obj.constructor != obj) {
                o["constructor"] = this._getRef(obj.constructor);
            }
            if(!o.proto && obj.prototype && obj.prototype != obj) {
                o["proto"] = this._getRef(obj.prototype);
            }
            if (FBTrace.DBG_CROSSFIRE_SERIALIZE) {
                FBTrace.sysout("CROSSFIRE: _serializeProperties finished", o);
            }
            return o;
        },

        /**
         * @name updateStatusIcon
         * @description Update the Crossfire connection status icon.
         * @function
         * @public
         * @memberOf Crossfire
         * @param status the status to update the icon to
         */
        updateStatusIcon: function( status) {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE updateStatusIcon");
            }
            with (FBL) {
                var icon = $("crossfireIcon");
                if (icon) {
                    if (status == CROSSFIRE_STATUS.STATUS_CONNECTED_SERVER) {
                        setClass($("menu_connectCrossfireClient"), "hidden");
                        setClass($("menu_startCrossfireServer"), "hidden");

                        removeClass($("menu_disconnectCrossfire"), "hidden");

                        removeClass(icon, CROSSFIRE_STATUS.STATUS_DISCONNECTED);
                        removeClass(icon, "waiting");
                        setClass(icon, "connected");

                    } else if (status == CROSSFIRE_STATUS.STATUS_WAIT_SERVER
                            /* TODO: create a separate icon state for 'connecting' */
                            || status == CROSSFIRE_STATUS.STATUS_CONNECTING) {
                        setClass($("menu_connectCrossfireClient"), "hidden");
                        setClass($("menu_startCrossfireServer"), "hidden");

                        removeClass($("menu_disconnectCrossfire"), "hidden");

                        removeClass(icon, CROSSFIRE_STATUS.STATUS_DISCONNECTED);
                        removeClass(icon, "connected");
                        setClass(icon, "waiting");

                    } else { //we are disconnected if (status == CROSSFIRE_STATUS.STATUS_DISCONNECTED) {
                        setClass($("menu_disconnectCrossfire"), "hidden");
                        removeClass($("menu_connectCrossfireClient"), "hidden");
                        removeClass($("menu_startCrossfireServer"), "hidden");

                        removeClass(icon, "connected");
                        removeClass(icon, "waiting");
                        setClass(icon, CROSSFIRE_STATUS.STATUS_DISCONNECTED);
                    }
                }
            }
        },

        /**
         * @name updateStatusText
         * @description Updates the Crossfire status text
         * @function
         * @public
         * @memberOf Crossfire
         * @param status the status to update the text to
         */
        updateStatusText: function( status) {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE updateStatusText: " + status);
            }
            with (FBL) {
                var icon = $("crossfireIcon");
                if (status == CROSSFIRE_STATUS.STATUS_DISCONNECTED) {
                    $("crossfireIcon").setAttribute("tooltiptext", "Crossfire: disconnected.");
                } else if (status == CROSSFIRE_STATUS.STATUS_WAIT_SERVER) {
                    $("crossfireIcon").setAttribute("tooltiptext", "Crossfire: accepting connections on port " + this.serverTransport.port);
                } else if (status == CROSSFIRE_STATUS.STATUS_CONNECTING) {
                    $("crossfireIcon").setAttribute("tooltiptext", "Crossfire: connecting...");
                } else if (status == CROSSFIRE_STATUS.STATUS_CONNECTED_SERVER) {
                    $("crossfireIcon").setAttribute("tooltiptext", "Crossfire: connected to client on port " + this.serverTransport.port);
                }
            }
        },

        // FBTest listener
        onGetTestList: function(testLists)
        {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE onGetTestList");

            testLists.push({
                extension: "Crossfire",
                testListURL: "chrome://crossfire/content/fbtest/testList.html"
            });
        }

    });

    // register module
    Firebug.registerModule(Crossfire);

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
        //Crossfire.onStatusMenuShowing(menu);
    };


    /**
     * @name Crossfire.startServer
     * @description Delegate to {@link Crossfire#startServer(host, port)}
     * @function
     * @public
     * @memberOf Crossfire
     */
    Crossfire.startServer = function() {
        var params = Crossfire._getDialogParams();
        window.openDialog("chrome://crossfire/content/connect-dialog.xul", "crossfire-connect","chrome,modal,dialog", params);
        if (params.host && params.port) {
            Crossfire.CrossfireServer.startServer(params.host, parseInt(params.port));
        }
    };
});