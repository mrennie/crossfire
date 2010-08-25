/* Test Crossfire Client */
function runTest() {
    FBTest.sysout("clientTest.started");

    Components.utils.import("resource://crossfire/SocketTransport.js");

    var CrossfireModule = FBTest.FirebugWindow.CrossfireModule;

    var status = CrossfireModule.status;
    FBTest.sysout("Connecting crossfire client on port 5000.  Status is : " + status);
    CrossfireModule.connectClient("localhost", 5000);

    setTimeout(function() {
        FBTest.ok(!(CrossfireModule.status == status), "CrossfireModule status changed");
        FBTest.sysout("Status is: " + CrossfireModule.status);

        FBTest.ok(CrossfireModule.status == CROSSFIRE_STATUS.STATUS_CONNECTED_CLIENT);

        FBTestFirebug.testDone("clientTest.finished");
    }, 3000);


}