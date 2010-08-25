/* Test if Crossfire server can start */
function runTest() {
    FBTest.sysout("startServerTest.started");

    Components.utils.import("resource://crossfire/SocketTransport.js");

    var CrossfireModule = FW.CrossfireModule;

    var status = CrossfireModule.status;
    FBTest.sysout("Starting crossfire server on port 5000.  Status is : " + status);
    CrossfireModule.startServer("localhost", 5000);

    setTimeout(function() {
        FBTest.ok(!(CrossfireModule.status == status), "CrossfireModule status changed");
        FBTest.sysout("Status is: " + CrossfireModule.status);

        FBTest.ok(CrossfireModule.status == CROSSFIRE_STATUS.STATUS_WAIT_SERVER);

        FBTestFirebug.testDone("startServerTest.finished");
    }, 3000);


}