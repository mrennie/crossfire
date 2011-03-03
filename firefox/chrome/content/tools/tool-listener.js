/* See license.txt for terms of usage */

var Crossfire = Crossfire || {};

FBL.ns(function() {
    /**
     * A Tool is an extension that registers itself to crossfire
     * for the purpose of sending and receiving commands and events
     * via the crossfire protocol/connection.
     */
    Crossfire.ToolListener = {

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

        supportsResponse: function( response) {

        },

        handleResponse: function( response) {

        },

        onTransportCreated: function( transport) {
            if (FBTrace.DBG_CROSSFIRE_TOOLS)
                FBTrace.sysout("onTransportCreated recieved by: " + this.toolName);
            this.transport = transport;
            this.transport.addListener(this);
        },

        onTransportDestroyed: function() {
            delete this.transport;
        },

        onRegistered: function() {

        },

        onUnregistered: function() {

        },

        onConnectionStatusChanged: function( status) {
            this.status = status;
        },

        getDescription: function() {

        }
    };
});