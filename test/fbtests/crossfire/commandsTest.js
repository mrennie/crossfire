/* Test Crossfire commands
 * This test case just sends all the commands from the client to the server,
 * and checks to see if the server gets a request. The contents or correctness
 * of the responses are not tested here.
 */
function runTest() {
    FBTest.sysout("commandsTest.started");

    Components.utils.import("resource://crossfire/SocketTransport.js");

    var CrossfireModule = FW.top.Crossfire;
    var CrossfireClient = CrossfireModule.CrossfireClient;

    var contextId, testIndex = -1;

    var commands = [
                    "listcontexts",
                    "version",
                    "gettools",
                    "getbreakpoint",
                    "backtrace",
                    "changebreakpoint",
                    "continue",
                    "evaluate",
                    "frame",
                    "getbreakpoints",
                    "lookup",
                    "scopes",
                    "scope",
                    "script",
                    "scripts",
                    "setbreakpoint",
                    "source",
                    "suspend"
               ];

    function sendNextCommand() {
        var nextCommand = commands[++testIndex];
        if (!nextCommand) {
            CrossfireModule.getClientTransport().removeListener(testListener);
            FBTestFirebug.testDone("commandsTest.finished no more commands");
        } else {
            FBTest.sysout("sending command: " + nextCommand);
            FW.setTimeout(function() { CrossfireClient._sendCommand(nextCommand, {"contextId": contextId }); }, 10);
        }
    }

    var testListener =  {
        toolName: "all",

        handleResponse: function(response) {
            FBTest.sysout("commandsTest.handleResponse: " + response);
            FBTest.ok(response.command == commands[testIndex], "expected response.command to be: " + commands[testIndex] + ", was " +  response.command);
            if (response.command == "listcontexts") {
                // just grab the first contextId
                contextId = response.body.contexts[0].contextId;
                FBTest.progress("got context id => " + contextId);
            }
            sendNextCommand();
        },

        fireEvent: function(evt) {
            FBTest.sysout("spurious event: " + event);
        }

    };

    window.allOpenAllCloseURL = FBTest.getHTTPURLBase()+"fbtest/crossfire/OpenFirebugOnThisPage.html";

    FBTestFirebug.openNewTab(allOpenAllCloseURL, function openFirebug(win)
    {
        FBTest.progress("opened tab for "+win.location);

        FBTest.progress("All Open");
        FW.Firebug.Activation.toggleAll("on");

        FBTest.ok( FW.Firebug.chrome.isOpen(), "Firebug is open");

        CrossfireModule.getClientTransport().addListener(testListener);

        // kick it off
        sendNextCommand();
    });
}
