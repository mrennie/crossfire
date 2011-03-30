/* See license.txt for terms of usage */

/**
 * @ignore
 */
var EXPORTED_SYMBOLS = ["EventPacket", "RequestPacket", "ResponsePacket"];

/**
 * @name Packet
 * @description The prototype object for all other packet types.
 * Handles parsing packet strings and JSON, and generating sequence numbers.
 * @public
 * @type Packet
 */
var Packet = {
    seq: 0,
    length: 0,
    data: null,

    /**
     * @name toJSON
     * @description Converts the given object to a JSON {@link String}.
     * @function
     * @public
     * @memberOf Packet
     * @param obj the object to convert to a JSON {@link String}
     * @type String
     * @returns the given object as a JSON {@link String}
     */
    toJSON: function( obj) {
        //FIXME: only works for FF3.5 native JSON
        return JSON.stringify(obj);
    },

    /**
     * @name parseJSON
     * @description Parses the {@link Object} from the given JSON {@link String}.
     * @function
     * @public
     * @memberOf Packet
     * @param str the JSON {@link String} to parse
     * @type Object
     * @returns the {@link Object} value from the JSON {@link String}
     */
    parseJSON: function( str) {
        if (str) {
            //return eval('(' + str + ')'); //FIXME: dangerous
            return JSON.parse(str);
        }
        return null;
    },

    /**
     * @name toPacketString
     * @description Converts the given string to over-the-wire form, with the <code>Content-Length</code> header and lines feed added.
     * @function
     * @public
     * @memberOf Packet
     * @param str the {@link String} to add to the {@link Packet} {@link String}
     * @type String
     * @returns the given {@link String} with the <code>Content-Length</code> header and lines feed added
     */
    toPacketString: function( body, headers) {
        if (!headers) {
            headers = [];
        }
        // insert content-length header at beginning of headers
        headers.splice(0,0,"Content-Length:" + body.length);
        headers = headers.join("\r\n"); // only adds \r\n if more than one header
        return headers + "\r\n\r\n" + body; // HTTP-ish style
    }
};

/**
 * @name EventPacket
 * @description Creates a new {@link EventPacket} object.
 * @constructor
 * @public
 * @param event name of the event.
 * @param data JSON object containing additional arguments for the event.
 * @type EventPacket
 * @returns a new {@link EventPacket}
 */
function EventPacket( event, data, headers) {
    if (data) {
        var sequence = Packet.seq++;
        var packet = {
                "seq": sequence,
                "type": "event",
                "event": event
        };
        for (var prop in data) {
            packet[prop] = data[prop];
        }
        var json = this.toJSON(packet);
        this.data = this.toPacketString(json, headers);
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
}

EventPacket.prototype = Packet;

/**
 * @name RequestPacket
 * @description Creates a {@link RequestPacket} object.
 * @constructor
 * @public
 * @param packetString The unprocessed UTF-8 packet string.
 * @type RequestPacket
 * @returns a new {@link RequestPacket}
 */
function RequestPacket( packetString) {
    var json,command,args,headers,packet;
    if (arguments.length == 1) {
        json = this.parseJSON(packetString);
        for (var prop in json) {
            this[prop] = json[prop];
        }
        if (json && json.seq)
            Packet.seq = json.seq+1;
    } else if (arguments.length > 2){
        command = arguments[0];
        args = arguments[1];
        headers = arguments[2];
        packet = {
            "seq": Packet.seq++,
            "type": "command",
            "command": command,
        };
        json = this.toJSON(packet);
        this.data = this.toPacketString(json, headers);
        this.length = this.data.length;
    }
}

RequestPacket.prototype = Packet;

/**
 * @name ResponsePacket
 * @description Creates a new {@link ResponsePacket} object.
 * @constructor
 * @public
 * @param command The name of the command that requested the response.
 * @param requestSeq The sequence number of the request that initiated this response.
 * @param contextid the Crossfire id for the context from the request. Can be <code>null</code>
 * @param body The JSON body of the response.
 * @param running boolean indicating whether the context is still running after the command.
 * @param success boolean indicating whether the command was successful.
 * @type ResponsePacket
 * @returns a new {@link ResponsePacket}
 */
function ResponsePacket( command, requestSeq, contextid, body, running, success, headers) {
    var sequence = Packet.seq++;
    var packet = {
            "type": "response",
            "command": command,
            "seq": sequence,
            "request_seq": requestSeq,
            "body": body,
            "running": running,
            "success": success
    };
    if(contextid) {
    	packet["context_id"] = contextid;
    }
    var json = this.toJSON(packet);
    this.data = this.toPacketString(json, headers);
    this.length = this.data.length;
}

ResponsePacket.prototype = Packet;
