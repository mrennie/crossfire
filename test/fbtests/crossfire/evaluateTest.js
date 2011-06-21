/* Test evaluate and serializing special number values, like NaN, Infinity, -Infinity */
function runTest() {
    FBTest.sysout("evaluateTest.started");

    var CrossfireModule = FW.top.Crossfire;
    var CrossfireClient = CrossfireModule.CrossfireClient;

    var expressions = [
        "Math.PI * 2", // two-pie
        "5 * 'foo'", // NaN
        "17 * Infinity", // +Infinity
        "-Infinity + 100000", // -Infinity
        "-Infinity + Infinity" // NaN
    ];

    var contextId, nextResult, testIndex = -1;

    function evaluateNext() {
         var nextExpression = expressions[++testIndex];
         if (!nextExpression) {
             CrossfireModule.getClientTransport().removeListener(testListener);
             FBTestFirebug.testDone("evaluateTest.finished no more expressions.");
         } else {
             nextResult = (eval(nextExpression)).toString();
             FBTest.progress("sending expression: " + nextExpression);
             FW.setTimeout(function() { CrossfireClient._sendCommand('evaluate',  { "contextId": contextId, "expression": nextExpression }); }, 10);
         }
    }

    var testListener = {
            toolName: "all",
            handleResponse: function(response) {
                FBTest.sysout("evaluateTest.handleResponse: " + response);
                if (response.command == "listcontexts") {
                    // just grab the first contextId
                    contextId = response.body.contexts[0].contextId;
                    FBTest.progress("got context id => " + contextId);
                    evaluateNext();
                } else if (response.command == 'evaluate') {
                    FBTest.progress("got evaluate response");
                    FBTest.ok(response.success, 'response was successful');
                    FBTest.ok(response.body && response.body.result, 'response has a body with a result.');
                    FBTest.ok(response.body.result.value == nextResult, 'response result equals local result');
                    evaluateNext();
                }

            },

            fireEvent: function(evt) {
                FBTest.sysout("spurious event: " + event);
            }
    };

    // open Firebug
    window.allOpenAllCloseURL = FBTest.getHTTPURLBase()+"fbtest/crossfire/OpenFirebugOnThisPage.html";

    FBTestFirebug.openNewTab(allOpenAllCloseURL, function openFirebug(win)
    {
        FBTest.progress("opened tab for "+win.location);

        FBTest.progress("All Open");
        FW.Firebug.Activation.toggleAll("on");

        FBTest.ok( FW.Firebug.chrome.isOpen(), "Firebug is open");

        CrossfireModule.getClientTransport().addListener(testListener);

        // kick it off
        CrossfireClient._sendCommand('listcontexts');

    });

}