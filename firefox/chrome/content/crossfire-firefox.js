FBL.ns(function() {

Crossfire.ClientBrowserToolHack = FBL.extend(CrossfireModule.ToolListener, {
    toolName: "ClientBrowserToolHack",
    commands: [],
    events: [ ],

    handleRequest: function( request) {

    },

    onTransportCreated: function( transport) {
        //if (FBTrace.DBG_CROSSFIRE_TOOLS)
            FBTrace.sysout(this.toolName + " onTransportCreated recieved");
        this.transport = transport;
        this.transport.addListener(this);
    },

    onConnectionStatusChanged: function( status) {
        this.status = status;
        FBTrace.sysout(this.toolName +" status changed "+status);
    },

    onRegistered: function() {
        FBTrace.sysout(this.toolName +" onRegistered ");
    },

    onUnregistered: function() {
        FBTrace.sysout(this.toolName +" onRegistered ");
    },

    openFirebugClient: function()
    {

        var bti = Crossfire.Firefox.createClientBrowserTools();

        CrossFire.addListener(bti);
        // TODO make sure Firebug is off
        Firebug.detachBar();
    },

    createClientBrowserTools: function()
    {
        // Grab Firebug.Debugger from Firebug
        //
    },
});

CrossfireModule.registerTool(Crossfire.ClientBrowserToolHack.toolName, Crossfire.ClientBrowserToolHack);

});