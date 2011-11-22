/* See license.txt for terms of usage */

var Crossfire = Crossfire || {};

FBL.ns(function() {
    /**
     * A Tool is an extension that registers itself to Crossfire
     * for the purpose of sending and receiving commands and events
     * via the crossfire protocol/connection.
     */
    Crossfire.Tool = {
        commands: [],
        events: [],

        /**
         * @name supportsRequest
         * @description
         * @function
         * @public
         * @memberOf Tool
         * @param request
         * @since 0.3a7
         */
        supportsRequest: function(request) {
        	if (FBTrace.DBG_CROSSFIRE_TOOL) {
                FBTrace.sysout("supportsRequest recieved by: " + this.toolName);
            }
            // default is return true if the command name is in our array of commands
            return (request.command && request.command in this.commands);
        },

        /**
         * @name handleRequest
         * @description 
         * @function
         * @public
         * @memberOf Tool
         * @param request
         * @since 0.3a7
         */
        handleRequest: function(request) {
        	if (FBTrace.DBG_CROSSFIRE_TOOL) {
                FBTrace.sysout("handleRequest recieved by: " + this.toolName);
            }
        },

        /**
         * @name supportsEvent
         * @description 
         * @function
         * @public
         * @memberOf Tool
         * @param event
         * @since 0.3a7
         */
        supportsEvent: function(event) {
        	if (FBTrace.DBG_CROSSFIRE_TOOL) {
                FBTrace.sysout("supportsEvent recieved by: " + this.toolName);
            }
            // default is return true if the event name is in our array of events
            return (event.name && event.name in this.events);
        },

        /**
         * @name handleEvent
         * @description 
         * @function
         * @public
         * @memberOf Tool
         * @param event
         * @since 0.3a7
         */
        handleEvent: function(event) {
        	if (FBTrace.DBG_CROSSFIRE_TOOL) {
                FBTrace.sysout("handleEvent recieved by: " + this.toolName);
            }
        },

        /**
         * @name supportsResponse
         * @description 
         * @function
         * @public
         * @memberOf Tool
         * @param response
         * @since 0.3a7
         */
        supportsResponse: function(response) {
        	if (FBTrace.DBG_CROSSFIRE_TOOL) {
                FBTrace.sysout("supportsResponse recieved by: " + this.toolName);
            }
        },

        /**
         * @name handleResponse
         * @description 
         * @function
         * @public
         * @memberOf Tool
         * @param response
         * @since 0.3a7
         */
        handleResponse: function(response) {
        	if (FBTrace.DBG_CROSSFIRE_TOOL) {
                FBTrace.sysout("handleResponse recieved by: " + this.toolName);
            }
        },

        /**
         * @name onTransportDestroyed
         * @description Call-back from CrossfireModule to inform the tool that the underlying transport from Crossfire has been created
         * @function
         * @public
         * @memberOf Tool
         * @param transport
         * @since 0.3a7
         */
        onTransportCreated: function(transport) {
            if (FBTrace.DBG_CROSSFIRE_TOOL) {
                FBTrace.sysout("onTransportCreated recieved by: " + this.toolName);
            }
            this.transport = transport;
            this.transport.addListener(this);
        },

        /**
         * @name onTransportDestroyed
         * @description Call-back from CrossfireModule to inform the tool that the underlying transport from Crossfire has been destroyed
         * @function
         * @public
         * @memberOf Tool
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
         * @memberOf Tool
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
         * @memberOf Tool
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
         * @memberOf Tool
         * @param status the String status of the connection
         * @see SocketTransport#CROSSFIRE_STATUS for the list of possbile statuses
         * @since 0.3a7
         */
        onConnectionStatusChanged: function(status) {
        	if (FBTrace.DBG_CROSSFIRE_TOOL) {
                FBTrace.sysout("onConnectionStatusChanged recieved by: " + this.toolName);
            }
            this.status = status;
        },

        /**
         * @name getDescription
         * @description Returns the human-readable description for the tool.
         * @function
         * @public
         * @memberOf Tool
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
         * @memberOf Tool
         * @return a String name for the tool
         * @since 0.3a9
         */
        getToolName: function() {
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
         * @memberOf Tool
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