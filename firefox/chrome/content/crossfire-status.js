/* See license.txt for terms of usage */


define("CrossfireStatus", [], function() {
    var CrossfireStatus = {
            STATUS_DISCONNECTED: "disconnected",
            STATUS_WAIT_SERVER: "wait_server",
            STATUS_CONNECTING: "connecting",
            STATUS_CONNECTED_SERVER: "connected_server",
            STATUS_CONNECTED_CLIENT: "connected_client"

    };

    return exports = CrossfireStatus;
});