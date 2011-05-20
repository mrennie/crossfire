/* Test evaluate and serializing special number values, like NaN, Infinity, -Infinity */
function runTest() {
    FBTest.sysout("evaluateTest.started");

    Components.utils.import("resource://crossfire/SocketTransport.js");

    var CrossfireModule = FW.CrossfireModule;
    var CrossfireClient = FW.CrossfireClient;

    var expressions = [
        "Math.PI * 2", // two-pie
        "5 * 'foo'", // NaN
        "17 * Infinity", // +Infinity
        "-Infinity + 100000", // -Infinity
        "-Infinity + Infinity" // NaN
    ];

    var nextResult;

    function evaluateNext() {
         var nextExpression = commands[++testIndex];
         if (!nextExpression) {
             FBTestFirebug.testDone("commandsTest.finished no more commands");
         } else {
             nextResult = eval(nextExpression);
             FBTest.sysout("sending expression: " + nextExpression);
             FW.setTimeout(function() { CrossfireClient._sendCommand('evaluate',  { "expression": nextExpression }; }, 50);
         }
    }

    CrossfireModule.getClientTransport().addListener({
        toolName: "all",
        handleResponse: function(response) {
            FBTest.sysout("evaluateTest.handleResponse: " + response);
            if (response.command == 'evaluate') {
                FBTest.ok(response.success, 'response was successful');
                FBTest.ok(response.value == nextResult, 'response result equals local result');
                sendNextExpression();
            }

        },

        fireEvent: function(evt) {
            FBTest.sysout("spurious event: " + event);
        }

    });

    // kick it off
    sendNextExpression();
}