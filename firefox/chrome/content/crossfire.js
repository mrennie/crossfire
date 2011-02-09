/* See license.txt for terms of usage */

/**
 * @name Crossfire
 * @description Firebug extension to add support for remote debug protocol.
 * @public
 */

define(["crossfireModules/crossfire-status"], function(CrossfireStatus) {

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
     * @name CrossfireModule
     * @module Firebug Module for Crossfire. This module acts as a controller
     * between Firebug and the remote debug connection.  It is responsible for
     * opening a connection to the remote debug host.
     */
    var CrossfireModule = FBL.extend(Firebug.Module,  {
        contexts: [],
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
            if (this.status == CrossfireStatus.STATUS_CONNECTED_SERVER
                    || this.status == CrossfireStatus.STATUS_WAIT_SERVER) {
                this.serverTransport.close();
            } else if (this.status == CrossfireStatus.STATUS_CONNECTED_CLIENT) {
                this.clientTransport.close();
            }
            this._clearRefs();
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
            Firebug.Crossfire.updateStatus(status);

            // xxxMcollins: standalone client hack
            if (this.status == CrossfireStatus.STATUS_CONNECTED_CLIENT
                    && this.registeredTools["RemoteClient"]) {
                this.activateTool("RemoteClient");
            } else if (this.status == CrossfireStatus.STATUS_DISCONNECTED) {
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

            //CrossfireModule.getServerTransport().sendResponse(command, request.seq, response, this.running, response);


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

        // called by transport listener after receiving tool string in handshake
        activateTool: function( toolName) {
            if (toolName in this.registeredTools) {
                 if (FBTrace.DBG_CROSSFIRE_TOOLS)
                     FBTrace.sysout("Crossfire activating tool: " + toolName);
                 try {
                     //FIXME: a way to tell tools whether they are connected to client vs. server?
                     if (this.status == CrossfireStatus.STATUS_CONNECTED_CLIENT) {
                         this.registeredTools[toolName].onTransportCreated(this.clientTransport);
                     } else if ( this.status == this.status == CrossfireStatus.STATUS_CONNECTED_SERVER) {
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
        }
    });

    // register module
    Firebug.registerModule(CrossfireModule);

    return exports = Firebug.CrossfireModule = CrossfireModule;
//enifed
});