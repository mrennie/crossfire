/* Test Crossfire Client */
function runTest() {
    FBTest.sysout("clientTest.started");

    Components.utils.import("resource://crossfire/SocketTransport.js");

    var CrossfireModule = FBTest.FirebugWindow.CrossfireModule;
    var CrossfireClient = FBTest.FirebugWindow.CrossfireClient;
    
    var status = CrossfireModule.status;
    FBTest.sysout("Connecting crossfire client on port 5000.  Status is : " + status);
    CrossfireClient.connectClient("localhost", 5000);

    setTimeout(function() {
    	var newStatus = CrossfireModule.status;
        FBTest.ok(!(newStatus == status), "CrossfireModule status changed from: " + status + " to: " +newStatus);
        FBTest.sysout("Status is: " + newStatus);
        
        if (newStatus == CROSSFIRE_STATUS.STATUS_CONNECTING) {
        	setTimeout(function() {
        		FBTest.sysout("Waiting for connection... ");
        		FBTest.ok(CrossfireModule.getClientTransport().status == CROSSFIRE_STATUS.STATUS_CONNECTED_CLIENT);
        		 FBTestFirebug.testDone("clientTest.finished");
        	}, 1000);
        	
        } else {
        	FBTest.ok(newStatus == CROSSFIRE_STATUS.STATUS_CONNECTED_CLIENT);
        	FBTestFirebug.testDone("clientTest.finished");
        }
       
    }, 2000);


}