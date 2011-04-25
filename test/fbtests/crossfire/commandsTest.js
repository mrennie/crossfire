/* Test Crossfire commands
 * This test case just sends all the commands from the client to the server,
 * and checks to see if the server gets a request. The contents or correctness
 * of the responses are not tested here.
 */
function runTest() {
    FBTest.sysout("commandsTest.started");

    Components.utils.import("resource://crossfire/SocketTransport.js");

    var CrossfireModule = FW.CrossfireModule;
    var CrossfireClient = FW.CrossfireClient;

    var testIndex = -1;

    var commands = [
                    "listcontexts",
                    "version",
                    "gettools",
                    "getbreakpoint",
                    "updatecontext",
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
            FBTestFirebug.testDone("commandsTest.finished no more commands");
        } else {
            FBTest.sysout("sending command: " + nextCommand);
            FW.setTimeout(function() { CrossfireClient._sendCommand(nextCommand); }, 50);
        }
    }

    CrossfireModule.getClientTransport().addListener({
        toolName: "all",
        handleResponse: function(response) {
            FBTest.sysout("commandsTest.handleResponse: " + response);
            FBTest.ok(response.command == commands[testIndex], "expected response.command to be: " + commands[testIndex] + ", was " +  response.command);
            sendNextCommand();
        },

        fireEvent: function(evt) {
            FBTest.sysout("spurious event: " + event);
        }

    });

    sendNextCommand();
}
