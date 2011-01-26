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

        var FirebugCopy = FBL.extend({}, Firebug);

        FirebugCopy.Debugger = Firebug.JavaScriptModule; // commands go out here
        FBTrace.sysout("openFirebugClient overwrite FirebugCopy.Debugger ", FirebugCopy.Debugger);

        // In detachBar, |this| will be a one-level deep copy of the Firebug in this window, but with a different Debugger.
        FirebugCopy.detachBar();
    },

    createClientBrowserTools: function()
    {

    },
});

CrossfireModule.registerTool(Crossfire.Loopback.toolName, Crossfire.Loopback);

// --------------------------------------------------------------------------------------
// Prototype for front end module providing BTI via crossfire

// Begin transitional code
Cu.import("resource://firebug/modules/bti/browser.js");
// End transitional code

Browser.prototype.getTools = function()
{
	// Some crossfire thing
    return [];
};

Firebug.JavaScriptModule = FBL.extend(Firebug.ActivableModule,
{
    dispatchName: "debugger",    // extends Module

    initialize: function()
    {
        $("cmd_breakOnErrors").setAttribute("checked", Firebug.breakOnErrors);
        $("cmd_decompileEvals").setAttribute("checked", Firebug.decompileEvals);

        this.onFunctionCall = bind(this.onFunctionCall, this);
        this.browserTools = new Browser();

        Firebug.ActivableModule.initialize.apply(this, arguments);
    },

    initializeUI: function()
    {
        Firebug.ActivableModule.initializeUI.apply(this, arguments);
        this.filterButton = $("fbScriptFilterMenu");
        this.filterMenuUpdate();
        var tools = this.browserTools.getTools();
        Firebug.setIsJSDActive(fbs.isJSDActive()); // jsd may be active before this XUL window was opened
    },


});

});