/* Test Crossfire Client */
function runTest() {
    FBTest.sysout("clientTest.started");

    Components.utils.import("resource://crossfire/SocketTransport.js");

    var CrossfireModule = FBTest.FirebugWindow.top.Crossfire;
    var CrossfireClient = CrossfireModule.CrossfireClient;

    var status = CrossfireClient.status;
    var port = 5678;
    FBTest.sysout("Connecting crossfire client on port " + port + ".  Status is : " + status);
    FBTest.FirebugWindow.setTimeout(function() {
        CrossfireClient.connectClient("localhost", port);
    });

    setTimeout(function checkStatus() {
        var newStatus = CrossfireClient.status;
        FBTest.ok((newStatus == CROSSFIRE_STATUS.STATUS_CONNECTING || newStatus == CROSSFIRE_STATUS.STATUS_CONNECTED_CLIENT), "CrossfireModule status changed from: " + status + " to: " +newStatus);
        status = newStatus;
        FBTest.sysout("Status is: " + status);

        if (newStatus == CROSSFIRE_STATUS.STATUS_CONNECTING || newStatus == CROSSFIRE_STATUS.STATUS_CONNECTED_CLIENT) {
        //    FBTest.sysout("Waiting for connection... ");
        //    setTimeout(checkStatus, 1000);
        //} else {
        //    FBTest.ok(newStatus == CROSSFIRE_STATUS.STATUS_CONNECTED_CLIENT);
           FBTestFirebug.testDone("clientTest.finished");
       }

    }, 2000);


}