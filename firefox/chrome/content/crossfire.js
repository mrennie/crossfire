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
        refs: [],
        dispatchName: "Crossfire",
        toolName: "all", // receive all packets, regardless of 'tool' header
        version: CROSSFIRE_VERSION,

        /**
         * @name initialize
         * @description Initializes Crossfire
         * @function
         * @private
         * @memberOf CrossfireModule
         * @extends Firebug.Module
         */
        initialize: function() {
        if (FBTrace.DBG_CROSSFIRE)
            FBTrace.sysout("CROSSFIRE initialize");
            // -- add tools --
            //TODO: load tools conditionally upon enablement
            //Components.utils.import("resource://crossfire/tools/console-tool.js");
            var consoleTool = new Crossfire.ConsoleTool();
            if (FBTrace.DBG_CROSSFIRE_TOOLS)
                FBTrace.sysout("CROSSFIRE created ConsoleTool: " + consoleTool);
            this.registerTool("console", consoleTool);

            //Components.utils.import("resource://crossfire/tools/inspector-tool.js");
            var inspectorTool = new Crossfire.InspectorTool();
            if (FBTrace.DBG_CROSSFIRE_TOOLS)
                FBTrace.sysout("CROSSFIRE created InspectorTool: " + inspectorTool);
            this.registerTool("inspector", inspectorTool);

            //Components.utils.import("resource://crossfire/tools/net-tool.js");
            var netTool = new Crossfire.NetTool();
            if (FBTrace.DBG_CROSSFIRE_TOOLS)
                FBTrace.sysout("CROSSFIRE created NetTool: " + netTool);
            this.registerTool("net", netTool);

            //Components.utils.import("resource://crossfire/tools/dom-tool.js");
            var domTool = new Crossfire.DomTool();
            if (FBTrace.DBG_CROSSFIRE_TOOLS)
                FBTrace.sysout("CROSSFIRE created DomTool: " + domTool);
            this.registerTool("dom", domTool);

            // initialize refs
            this._clearRefs();
        },

        getServerTransport: function() {
            this._ensureTransport();
            return this.serverTransport;
        },

        getClientTransport: function() {
            this._ensureTransport();
            return this.clientTransport;
        },

        /*
         * integer server port number or null if this is not a server
         */
        getServerPort: function()
        {
            var commandLine = Components.classes["@almaden.ibm.com/crossfire/command-line-handler;1"].getService().wrappedJSObject;
            var port = commandLine.getServerPort();
            // FIXME: allow UI to change the value
            return port;
        },
        /**
         * @name _ensureTransport
         * @description tries to load the transport module if it has not already been loaded
         * @function
         * @private
         */
        _ensureTransport: function() {
            if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("Crossfire _ensureTransport");

            if (typeof CrossfireSocketTransport == "undefined") {
                try {
                    Components.utils.import("resource://crossfire/SocketTransport.js");
                } catch (e) {
                    FBTrace.sysout("exception loading transport module: " + e);
                }
            }
            if (! this.serverTransport) {
                this.serverTransport = getCrossfireServer();
                this.serverTransport.addListener(this);
            }

            if (! this.clientTransport) {
                this.clientTransport = new CrossfireSocketTransport();
                this.clientTransport.addListener(this);
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
            if (this.status == CROSSFIRE_STATUS.STATUS_CONNECTED_SERVER
                    || this.status == CROSSFIRE_STATUS.STATUS_WAIT_SERVER) {
                this.serverTransport.close();
            } else if (this.status == CROSSFIRE_STATUS.STATUS_CONNECTED_CLIENT) {
                this.clientTransport.close();
            }
            this._clearRefs();

            this.unregisterTool("console");
            this.unregisterTool("inspector");
            this.unregisterTool("net");
            this.unregisterTool("dom");

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

            // xxxMcollins: standalone client hack
            if (this.status == CROSSFIRE_STATUS.STATUS_CONNECTED_CLIENT
                    && this.registeredTools["RemoteClient"]) {
                this.activateTool("RemoteClient");
            } else if (this.status == CROSSFIRE_STATUS.STATUS_DISCONNECTED) {
                this.clientTransport = null;
                this.serverTransport = null;
            }

        },

        handleRequest: function(request) {
            if (FBTrace.DBG_CROSSFIRE) {
                FBTrace.sysout("CROSSFIRE received request " + request.toSource());
            }
            var response, toolName, command = request.command;

            if (command == "enableTool") {
                toolName = request.toolName;
                if (toolName in this.registeredTools) {
                    response = this.activateTool(toolName);
                }
            } else if (command == "disableTool") {
                if (toolName in this.registeredTools) {
                    response = this.deactivateTool(toolName);
                }
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
                if (this.status == "connected_server") {
                    this.registeredTools[toolName].onTransportCreated(this.serverTransport);
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

        // called by transport listener after receiving tool string in handshake
        activateTool: function( toolName) {
            if (toolName in this.registeredTools) {
                 if (FBTrace.DBG_CROSSFIRE_TOOLS)
                     FBTrace.sysout("Crossfire activating tool: " + toolName);
                 try {
                     //FIXME: a way to tell tools whether they are connected to client vs. server?
                     if (this.status == CROSSFIRE_STATUS.STATUS_CONNECTED_CLIENT) {
                         this.registeredTools[toolName].onTransportCreated(this.clientTransport);
                     } else if ( this.status == this.status == CROSSFIRE_STATUS.STATUS_CONNECTED_SERVER) {
                         this.registeredTools[toolName].onTransportCreated(this.serverTransport);
                     }
                     return true;
                 } catch (e) {
                     FBTrace.sysout("exception deactivationg tool: " + e);
                     return false;
                 }
            }
        },

        deactivateTool: function( toolName) {
            if (toolName in this.registeredTools) {
                if (FBTrace.DBG_CROSSFIRE_TOOLS)
                    FBTrace.sysout("Crossfire activating tool: " + toolName);
                try {
                    this.registeredTools[toolName].onTransportDestroyed(this.transport);
                    return true;
                } catch (e) {
                    FBTrace.sysout("exception deactivationg tool: " + e);
                    return false;
                }
            }
        },

        /**
         * @name getTools
         * @description return a list of tools registered with crossfire.
         * @function
         *
         */
        getTools: function() {
            var tools = [];
            for (var name in this.registeredTools) {
                tools.push({"toolName": name });
            }
            return { "tools": tools };
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

        // ----- helpers

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
         * @name serialize
         * @description prepare a javascript object to be serialized into JSON.
         * @function
         * @private
         * @memberOf CrossfireModule
         * @param obj the JavaScript {@link Object} to serialize
         */
        serialize: function(obj) {
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
                            arr.push(this.serialize(obj[i]));
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
                            o[p] = this.serialize(prop);
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


        // -----Crossfire UI functions -----

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
                    $("crossfireIcon").setAttribute("tooltiptext", "Crossfire: accepting connections on port " + this.serverTransport.port);
                } else if (status == CROSSFIRE_STATUS.STATUS_CONNECTING) {
                    $("crossfireIcon").setAttribute("tooltiptext", "Crossfire: connecting...");
                } else if (status == CROSSFIRE_STATUS.STATUS_CONNECTED_SERVER) {
                    $("crossfireIcon").setAttribute("tooltiptext", "Crossfire: connected to client on port " + this.serverTransport.port);
                } else if (status == CROSSFIRE_STATUS.STATUS_CONNECTED_CLIENT) {
                    $("crossfireIcon").setAttribute("tooltiptext", "Crossfire: connected to " + this.clientTransport.host + ":" + this.clientTransport.port);
                }
            }
        },

        /*
         * @name setRunning
         * @description Update the Crossfire running status.
         * @function
         * @public
         * @memberOf CrossfireModule
         * @param isRunning the desired running state for Crossfire
         *
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
        }
         */
         
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
            CrossfireServer.startServer(params.host, parseInt(params.port));
        }
    };

    /**
     * @name Crossfire.connect
     * @description Delegate to {@link CrossfireClient#connectClient(host, port)}
     * @function
     * @public
     * @memberOf Crossfire
     */
    Crossfire.connect = function() {
        var params = CrossfireModule._getDialogParams(false);
        window.openDialog("chrome://crossfire/content/connect-dialog.xul", "crossfire-connect","chrome,modal,dialog", params);
        if (params.host && params.port) {
            CrossfireClient.connectClient(params.host, parseInt(params.port));
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