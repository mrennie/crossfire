/* See license.txt for terms of usage */
/**
 * Packet module
 *
 */

/** @ignore for Firefox module usage: */
var EXPORTED_SYMBOLS = ["EventPacket", "RequestPacket", "ResponsePacket"];

    /**
     * @description The prototype object for all other packet types.
     * Handles parsing packet strings and JSON, and generating sequence numbers.
     */
    var Packet = {
        seq: 0,
        length: 0,
        data: null,

        toJSON: function( obj) {
            //FIXME: only works for FF3.5 native JSON
            return JSON.stringify(obj);
        },

        parseJSON: function( str) {
            if (str) {
                //return eval('(' + str + ')'); //FIXME: dangerous
                return JSON.parse(str);
            }
        },

        toPacketString: function( str) {
            return "Content-Length:" + str.length + "\r\n" + str; // HTTP-ish style
            //return (str.length.toString(16)) + "\r\n" + str + "\r\n0\r\n"; // chunked-encoding style
        }
    };

    // ----- EventPacket -----
    /**
     * @description Creates a new Event Packet object.
     * @param event name of the event.
     * @param data JSON object containing additional arguments for the event.
     */
    function EventPacket( event, data) {
        if (data) {
            var sequence = Packet.seq++;
            var packet = {
                    "seq": sequence,
                    "type":	"event",
                    "event": event
            };
            for (var prop in data) {
                packet[prop] = data[prop];
            }
            var json = this.toJSON(packet);
            this.data = this.toPacketString(json);
            this.length = this.data.length;
        } else {
            //FIXME: incoming event hack
            var json = this.parseJSON(event);
            for (var prop in json) {
                this[prop] = json[prop];
            }
            if (json && json.seq)
                Packet.seq = json.seq+1;
        }
    };

    EventPacket.prototype = Packet;

    // ----- RequestPacket -----
    /**
     * @description Creates a Request Packet object.
     * @param packetString The unprocessed UTF-8 packet string.
     */
    function RequestPacket( packetString) {
        var json = this.parseJSON(packetString);
        for (var prop in json) {
            this[prop] = json[prop];
        }
        if (json && json.seq)
            Packet.seq = json.seq+1;
    };

    RequestPacket.prototype = Packet;

    // ----- ResponsePacket -----
    /**
     * @description Creates a new Response Packet object.
     *
     * @param command The name of the command that requested the response.
     * @param requestSeq The sequence number of the request that initiated this response.
     * @param body The JSON body of the response.
     * @param running boolean indicating whether the context is still running after the command.
     * @param success boolean indicating whether the command was successful.
     */
    function ResponsePacket( command, requestSeq, body, running, success) {
        var sequence = Packet.seq++;
        var packet = {
                "seq": sequence,
                "type":	"response",
                "command": command,
                "request_seq": requestSeq,
                "body": body,
                "running": running,
                "success": success
        };
        if (body.context_id) packet.context_id = body.context_id;
        var json = this.toJSON(packet);
        this.data = this.toPacketString(json);
        this.length = this.data.length;
    };

    ResponsePacket.prototype = Packet;
