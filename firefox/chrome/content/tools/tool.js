/* See license.txt for terms of usage */

var Crossfire = Crossfire || {};

FBL.ns(function() {
    /**
     * A Tool is an extension that registers itself to Crossfire
     * for the purpose of sending and receiving commands and events
     * via the crossfire protocol/connection.
     * @constructor
     * @public
     * @type Tool
     */
    Crossfire.Tool = {
        commands: [],
        events: [],

        /**
         * @name supportsRequest
         * @description Returns if this tool supports the given request or not
         * @function
         * @public
         * @memberOf Crossfire.Tool
         * @param request the request from the client
         * @return true if this tool supports the given request object, false otherwise
         * @since 0.3a7
         */
        supportsRequest: function(request) {
        	if (FBTrace.DBG_CROSSFIRE_TOOL) {
                FBTrace.sysout("supportsRequest recieved by: " + this.toolName, request);
            }
            // default is return true if the command name is in our array of commands
            return (request.command && request.command in this.commands);
        },

        /**
         * @name handleRequest
         * @description Handles the request from the client iff the event applies to this tool. See {@link supportsRequest} for more 
         * information
         * @function
         * @public
         * @memberOf Crossfire.Tool
         * @param request the request from the client
         * @since 0.3a7
         */
        handleRequest: function(request) {
        	if (FBTrace.DBG_CROSSFIRE_TOOL) {
                FBTrace.sysout("handleRequest recieved by: " + this.toolName, request);
            }
        },

        /**
         * @name supportsEvent
         * @description Returns if this tool supports the given event or not
         * @function
         * @public
         * @memberOf Crossfire.Tool
         * @param event the Firebug / Crossfire  event object
         * @return true if this tool supports the given event object, false otherwise
         * @since 0.3a7
         */
        supportsEvent: function(event) {
        	if (FBTrace.DBG_CROSSFIRE_TOOL) {
                FBTrace.sysout("supportsEvent recieved by: " + this.toolName, event);
            }
            // default is return true if the event name is in our array of events
            return (event.name && event.name in this.events);
        },

        /**
         * @name handleEvent
         * @description Handles the event from Firebug iff the event applies to this tool. See {@link supportsEvent} for more 
         * information
         * @function
         * @public
         * @memberOf Crossfire.Tool
         * @param event the Firebug / Crossfire event object
         * @since 0.3a7
         */
        handleEvent: function(event) {
        	if (FBTrace.DBG_CROSSFIRE_TOOL) {
                FBTrace.sysout("handleEvent recieved by: " + this.toolName, event);
            }
        },

        /**
         * @name supportsResponse
         * @description Returns if this tool supports the given response or not
         * @function
         * @public
         * @memberOf Crossfire.Tool
         * @param response the response from the client
         * @return true if this tool supports the given response object, false otherwise
         * @since 0.3a7
         */
        supportsResponse: function(response) {
        	if (FBTrace.DBG_CROSSFIRE_TOOL) {
                FBTrace.sysout("supportsResponse recieved by: " + this.toolName, response);
            }
        },

        /**
         * @name handleResponse
         * @description Handles a response sent to a connected client iff the response applies to this tool. See {@link supportsResponse}
         * for more information.
         * @function
         * @public
         * @memberOf Crossfire.Tool
         * @param response the response object sent to the client
         * @since 0.3a7
         */
        handleResponse: function(response) {
        	if (FBTrace.DBG_CROSSFIRE_TOOL) {
                FBTrace.sysout("handleResponse recieved by: " + this.toolName, response);
            }
        },

        /**
         * @name onTransportCreated
         * @description Call-back from CrossfireModule to inform the tool that the underlying transport from Crossfire has been created
         * @function
         * @public
         * @memberOf Crossfire.Tool
         * @param transport
         * @since 0.3a7
         */
        onTransportCreated: function(transport) {
            if (FBTrace.DBG_CROSSFIRE_TOOL) {
                FBTrace.sysout("onTransportCreated recieved by: " + this.toolName, transport);
            }
            this.transport = transport;
            this.transport.addListener(this);
        },

        /**
         * @name onTransportDestroyed
         * @description Call-back from CrossfireModule to inform the tool that the underlying transport from Crossfire has been destroyed
         * @function
         * @public
         * @memberOf Crossfire.Tool
         * @since 0.3a7
         */
        onTransportDestroyed: function() {
        	if (FBTrace.DBG_CROSSFIRE_TOOL) {
                FBTrace.sysout("onTransportDestroyed recieved by: " + this.toolName);
            }
            delete this.transport;
        },

        /**
         * @name onRegistered
         * @description Call-back from CrossfireModule to inform the tool that it has been registered in Crossfire
         * @function
         * @public
         * @memberOf Crossfire.Tool
         * @since 0.3a7
         */
        onRegistered: function() {
        	if (FBTrace.DBG_CROSSFIRE_TOOL) {
                FBTrace.sysout("onRegistered recieved by: " + this.toolName);
            }
        },

        /**
         * @name onUnregistered
         * @description Call-back from CrossfireModule to inform the tool that it has been unregistered from Crossfire
         * @function
         * @public
         * @memberOf Crossfire.Tool
         * @since 0.3a7
         */
        onUnregistered: function() {
        	if (FBTrace.DBG_CROSSFIRE_TOOL) {
                FBTrace.sysout("onUnregistered recieved by: " + this.toolName);
            }
        },

        /**
         * @name onConnectionStatusChanged
         * @description Call-back from CrossfireModule to inform the tool the connection of the server has changed
         * to the new status
         * @function
         * @public
         * @memberOf Crossfire.Tool
         * @param status the String status of the connection
         * @see SocketTransport#CROSSFIRE_STATUS for the list of possbile statuses
         * @since 0.3a7
         */
        onConnectionStatusChanged: function(status) {
        	if (FBTrace.DBG_CROSSFIRE_TOOL) {
                FBTrace.sysout("onConnectionStatusChanged recieved by: " + this.toolName, status);
            }
            this.status = status;
        },

        /**
         * @name getDescription
         * @description Returns the human-readable description for the tool.
         * @function
         * @public
         * @memberOf Crossfire.Tool
         * @return a String description for the tool
         * @since 0.3a7
         */
        getDescription: function() {
        	if (FBTrace.DBG_CROSSFIRE_TOOL) {
                FBTrace.sysout("getDescription recieved by: " + this.toolName);
            }
            return this.toolName + " is a tool with an unimplemented getDescription() method.";
        },
        
        /**
         * @name getName
         * @description Returns the human-readable name for the tool. This name is also reference from the Crossfire handshake
         * @function
         * @public
         * @memberOf Crossfire.Tool
         * @return a String name for the tool
         * @since 0.3a9
         */
        getName: function() {
        	if (FBTrace.DBG_CROSSFIRE_TOOL) {
                FBTrace.sysout("getName recieved by: " + this.toolName);
            }
        	return this.toolName;
        },
        
        /**
         * @name asJSON
         * @description Returns the JSON representation of this tool object
         * @function
         * @public
         * @memberOf Crossfire.Tool
         * @return a JSON Object representing this tool
         * @since 0.3a9
         */
        asObject: function() {
        	return { 
        		"name": this.toolName,
                "enabled": (this.activated ? this.activated : false),
                "commands": this.commands,
                "events": this.events,
                "desc": this.getDescription()

        	}
        }
    };
});