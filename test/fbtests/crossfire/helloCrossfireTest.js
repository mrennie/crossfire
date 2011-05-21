/* Test if Crossfire object exists and make sure Firebug still opens. */
function runTest() {
    FBTest.sysout("helloCrossfireTest.started");

    FBTest.ok(FBTest.FirebugWindow.Crossfire, "Crossfire object exists in FBTest.FirebugWindow");
    FBTest.ok(FW.Crossfire, "Crossfire object exists in FW Firebug Window");

    window.allOpenAllCloseURL = FBTest.getHTTPURLBase()+"fbtest/crossfire/OpenFirebugOnThisPage.html";

    FBTestFirebug.openNewTab(allOpenAllCloseURL, function openFirebug(win)
    {
        FBTest.progress("opened tab for "+win.location);

        FBTest.progress("All Open");
        FW.Firebug.Activation.toggleAll("on");

        FBTest.ok( FW.Firebug.chrome.isOpen(), "Firebug is open");

    });

    FBTestFirebug.testDone("helloCrossfireTest.finished");
}