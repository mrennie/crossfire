/* Test if Crossfire object exists */
function runTest() {
    FBTest.sysout("helloCrossfireTest.started");

    FBTest.ok(FBTest.FirebugWindow.Crossfire, "Crossfire object exists in FBTest.FirebugWindow");
    FBTest.ok(FW.Crossfire, "Crossfire object exists in FW Firebug Window");

    FBTestFirebug.testDone("helloCrossfireTest.finished");
}