FBL.ns(function() {

    FBL.removeClass(document.getElementById("menu_loopbackCrossfire"), "hidden");

Crossfire.Loopback = FBL.extend(CrossfireModule.ToolListener, {
    toolName: "Loopback",
    commands: [],
    events: [ ],

    handleRequest: function( request) {

    },

    onTransportCreated: function( transport) {
        //if (FBTrace.DBG_CROSSFIRE_TOOLS)
            FBTrace.sysout(this.toolName + " onTransportCreated recieved");
        this.transport = transport;

        this.transport.addListener(this.bti);
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
        this.bti = Crossfire.Loopback.createClientBrowserTools();  // events come in here.

        if (Firebug.Debugger.isAlwaysEnabled())
        {
            setTimeout(function waitForUI()
            {
                 var commandLine = Components.classes["@almaden.ibm.com/crossfire/command-line-handler;1"].getService().wrappedJSObject;
                 var host = "localhost";
                 var port = commandLine.getServerPort();
                 CrossfireModule.connectClient(host, port);
                 FBTrace.sysout("openFirebugClient connect called for "+host+" port "+port);
            });
        }

        // TODO make sure Firebug is off
        Firebug.Debugger = Firebug.JavaScriptModule; // command go out here
        FBTrace.sysout("openFirebugClient overwrite Firebug.Debugger ", Firebug.Debugger);
        Firebug.detachBar();
    },

    createClientBrowserTools: function()
    {

    },
});

CrossfireModule.registerTool(Crossfire.Loopback.toolName, Crossfire.Loopback);

// --------------------------------------------------------------------------------------
// Prototype for front end module providing BTI via crossfire
Firebug.JavaScriptModule = FBL.extend(Firebug.ActivableModule,
{
    dispatchName: "debugger",
});

});