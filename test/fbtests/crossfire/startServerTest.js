/* Test if Crossfire server can start */
function runTest() {
    FBTest.sysout("startServerTest.started");

    Components.utils.import("resource://crossfire/SocketTransport.js");

    var CrossfireModule = FW.top.Crossfire;
    var CrossfireServer = CrossfireModule.CrossfireServer;

    var status = CrossfireModule.status;
    var port = 5678;
    FBTest.sysout("Starting crossfire server on port " + port + ".  Status is : " + status);
    CrossfireServer.startServer("localhost", port);

    setTimeout(function() {
        FBTest.ok(!(CrossfireModule.status == status), "CrossfireModule status changed");
        FBTest.sysout("Status is: " + CrossfireModule.status);

        FBTest.ok(CrossfireModule.status == CROSSFIRE_STATUS.STATUS_WAIT_SERVER);

        FBTestFirebug.testDone("startServerTest.finished");
    }, 3000);


}