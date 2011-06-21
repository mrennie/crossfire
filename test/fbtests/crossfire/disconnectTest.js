/* Test Crossfire client and server correctly disconnecting. */
function runTest() {
    FBTest.sysout("disconnectTest.started");

    Components.utils.import("resource://crossfire/SocketTransport.js");
    var CrossfireModule = FW.top.Crossfire;

    var status = CrossfireModule.status;
    FBTest.sysout("disconnecting Crossfire");
    CrossfireModule.disconnect();

    setTimeout(function() {
        FBTest.ok(!(CrossfireModule.status == status), "CrossfireModule status changed from: " + status + " to: " +CrossfireModule.status);

        // this fails because the status goes to WAIT_SERVER,
        // since we also have the server running in the same proc.
        //FBTest.ok(CrossfireModule.status == CROSSFIRE_STATUS.STATUS_DISCONNECTED);

        FBTestFirebug.testDone("disconnectTest.finished");

    }, 1000);
}