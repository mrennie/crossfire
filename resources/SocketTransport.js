/* See license.txt for terms of usage */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

const CROSSFIRE_HANDSHAKE        = "CrossfireHandshake\r\n";
const HANDSHAKE_RETRY = 1007;

var EXPORTED_SYMBOLS = [ "CrossfireSocketTransport", "getCrossfireServer", "CROSSFIRE_STATUS" ];

Cu.import("resource://crossfire/Packet.js");

try {
    Cu.import("resource://firebug/firebug-trace-service.js");
    FBTrace = traceConsoleService.getTracer("extensions.firebug");
} catch(ex) {
    FBTrace = {};
}

var CROSSFIRE_STATUS = {

        STATUS_DISCONNECTED: "disconnected",
        STATUS_WAIT_SERVER: "wait_server",
        STATUS_CONNECTING: "connecting",
        STATUS_CONNECTED_SERVER: "connected_server",
        STATUS_CONNECTED_CLIENT: "connected_client"

};


var _instance;

/**
 * @name getTransport
 * @function
 * @description returns the Singleton instance of Crossfire's SocketTransport object
 */
function getCrossfireServer() {
    if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
        FBTrace.sysout("getCrossfireServer");

    if (!_instance) {
        _instance = new CrossfireSocketTransport(true);
    }
    return _instance;
}

/**
 * @name CrossfireSocketTransport
 * @constructor CrossfireSocketTransport
 * @param isServer boolean specifying whether to start the transport as client or server
 * @description Firefox Socket Transport for remote debug protocol.
 * Opens a socket connection to a remote host and handles handshaking and
 * sending/receiving packets.
 */
function CrossfireSocketTransport( isServer) {

    this.listeners = [];
    this.connected = false;

    this.isServer = isServer;

    if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
        FBTrace.sysout("Creating new CrossfireSocketTransport");

    // quit-application observer
    var transport = this;
    Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService).addObserver({
        observe: function(subject, topic, data)
        {
            if (FBTrace.DBG_CROSSFIRE_TRANSPORT) FBTrace.sysout("quit application observed");
            transport.close();
        }
    }, "quit-application", false);

    return this;

}

CrossfireSocketTransport.prototype =
/** @lends CrossfireSocketTransport */
{

    // ----- external API ----

    /**
     * @name CrossfireSocketTransport.addListener
     * @function
     * @description Adds listener to be called when the transport receives requests.
     * The transport will pass a RequestPacket @see Packet.js
     * as an argument to the listener's "handleRequest" method.
     *
     * @param listener An object which contains a method named "handleRequest".
     */
    addListener: function( listener) {
        this.listeners.push(listener);
    },

    /**
     * @name CrossfireSocketTransport.sendResponse
     * @function
     * @description Builds and sends a response packet. @see also Packet.js
     * @param command The name of the command for the response.
     * @param requestSeq Sequence number of the request that initiated the response.
     * @param body JSON body of the response
     * @param running boolean indicates if execution is continuing.
     * @param success boolean indicates whether the command was successful.
     */
    sendResponse: function(command, requestSeq, body, running, success) {
        if (running == null || running == undefined) running = true; // assume we are running unless explicitly told otherwise
        success = !!(success); // convert to boolean
        this._defer(function() { this._sendPacket(new ResponsePacket(command, requestSeq, body, running, success)); });
    },

    /**
     * @name CrossfireSocketTransport.sendEvent
     * @function
     * @description Send an event packet. @see also Packet.js
     * @param event Event name
     * @param data optional JSON object containing additional data about the event.
     */
    sendEvent: function( event, data) {
        if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
            FBTrace.sysout("sendEvent " + event + " :: " + data);
        this._defer(function() { this._sendPacket(new EventPacket(event, data)); });
    },

    /**
     * @name CrossfireSocketTransport.open
     * @function
     * @param {String} host the hostname.
     * @param {Number} port the port.
     * @description Open a connection to the specified host/port.
     */
    open: function( host, port) {
        this._destroyTransport();
        this.host = host;
        this.port = port;
        this._createTransport(host, port, this.isServer);
    },

    /**
     * @name CrossfireSocketTransport.close
     * @function
     * @description close a previously opened connection.
     */
    close: function() {
        this.sendEvent("closed");

        this._defer(function() {
            this._notifyConnection(CROSSFIRE_STATUS.STATUS_DISCONNECTED);
            this.connected = false;

            if (this._inputStream) {
                this._inputStream.close(null);
            }

            if (this._outputStream) {
                this._outputStream.close();
            }

            if (this._transport) {
                this._transport.close(null);
            }

            this._destroyTransport();
            this._buffer='';
        });
    },

    // ----- internal methods -----
    /** @ignore */
    _createTransport: function (host, port) {

        if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
            FBTrace.sysout("_createTransport");

        if (this.isServer) {

            var serverSocket = Cc["@mozilla.org/network/server-socket;1"]
                                  .createInstance(Ci.nsIServerSocket);

            serverSocket.init(port, true, -1);

            var self = this;

            serverSocket.asyncListen({
                QueryInterface: function(iid) {
                    if(!iid.equals(Ci.nsISupports) && !iid.equals(Ci.nsIServerSocketListener))
                        throw NS_ERROR_NO_INTERFACE;
                    return this;
                },

                onSocketAccepted: function( socket, transport) {
                    self._transport = transport;

                    self._createInputStream();

                    self._createOutputStream();

                    self._notifyConnection(CROSSFIRE_STATUS.STATUS_CONNECTING);
                    self._waitHandshake();
                }
            });

            this._notifyConnection(CROSSFIRE_STATUS.STATUS_WAIT_SERVER);
        } else {
            var transportService = Cc["@mozilla.org/network/socket-transport-service;1"]
                                      .getService(Ci.nsISocketTransportService);

            this._transport = transportService.createTransport(null,0, host, port, null);

            this._createInputStream();

            this._createOutputStream();

            this._sendHandshake();
        }
    },

    _createInputStream: function() {
        if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
            FBTrace.sysout("_createInputStream");

        this._inputStream = this._transport.openInputStream(Ci.nsITransport.OPEN_BLOCKING | Ci.nsITransport.OPEN_UNBUFFERED, 0, 0);

        this._scriptableInputStream = Cc["@mozilla.org/scriptableinputstream;1"]
                            .createInstance(Ci.nsIScriptableInputStream);

        this._scriptableInputStream.init(this._inputStream);
    },

    _createOutputStream: function() {
        if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
            FBTrace.sysout("_createOutputStream");

        this._outputStream = this._transport.openOutputStream(Ci.nsITransport.OPEN_BLOCKING | Ci.nsITransport.OPEN_UNBUFFERED, 0, 0);

        this._outputStreamCallback = {
                _packets: [],

                addPacket: function( packet) {
                    this._packets.push(packet);
                },

                QueryInterface: function(iid) {
                    if(!iid.equals(Ci.nsISupports) && !iid.equals(Ci.nsIOutputStreamCallback))
                        throw NS_ERROR_NO_INTERFACE;
                    return this;
                },

                onOutputStreamReady: function( outputStream) {
                    try {
                        var packet = this._packets.pop();
                        if (packet) {
                            //while ((packet = this._packets.pop())) {

                            if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
                                FBTrace.sysout("onOutputStreamReady sending packet: " + packet);
                            outputStream.write(packet.data, packet.length);
                            outputStream.flush();
                        }
                    } catch( ex) {
                        if (FBTrace.DBG_CROSSFIRE_TRANSPORT) FBTrace.sysout("onOutputStreamReady" + ex);
                    }
                }
            };
    },

    _destroyTransport: function() {
        if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
            FBTrace.sysout("_destroyTransport");

        delete this._outputStreamCallback;
        delete this._outputStream;

        delete this._scriptableInputStream;
        delete this._inputStream;

        delete this._transport;
    },

    /** @ignore */
    _defer: function( callback, delay) {
        if (!delay) delay = 1;
        var self = this;
        var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
        timer.initWithCallback( {
            QueryInterface: function( iid) {
                if(!iid.equals(Ci.nsISupports) && !iid.equals(Ci.nsITimerCallback))
                    throw NS_ERROR_NO_INTERFACE;
                return this;
            },
            notify: function( aTimer) {
                callback.apply(self);
            }
        }, delay, timer.TYPE_ONE_SHOT);
    },

    /** @ignore */
    _sendHandshake: function() {
        if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
            FBTrace.sysout("_sendHandshake");

        var self = this;
        this._outputStream.asyncWait( {
            QueryInterface: function( iid) {
                if(!iid.equals(Ci.nsISupports) && !iid.equals(Ci.nsIOutputStreamCallback))
                    throw NS_ERROR_NO_INTERFACE;
                return this;
            },
            onOutputStreamReady: function( outputStream) {
                outputStream.flush();
                outputStream.write(CROSSFIRE_HANDSHAKE, CROSSFIRE_HANDSHAKE.length);
                outputStream.flush();

                if (self.isServer) {
                    self.connected = true;
                    self._notifyConnection(CROSSFIRE_STATUS.STATUS_CONNECTED_SERVER);
                    self._waitOnPacket();
                } else {
                    self._notifyConnection(CROSSFIRE_STATUS.STATUS_CONNECTING);
                    self._waitHandshake();
                }

            }
        }, 0, 0, null);
    },

    /** @ignore */
    _waitHandshake: function( timeout) {
        if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
            FBTrace.sysout("_waitHandshake");

        this._defer(function() {
            try {
                if (this._inputStream.available() == CROSSFIRE_HANDSHAKE.length) {
                    if (this._scriptableInputStream.read(CROSSFIRE_HANDSHAKE.length) == CROSSFIRE_HANDSHAKE) {
                        this._outputStream.asyncWait(this._outputStreamCallback,0,0,null);
                        if (this.isServer) {
                            this._sendHandshake();
                        } else {
                            this._waitOnPacket();
                            this._notifyConnection(CROSSFIRE_STATUS.STATUS_CONNECTED_CLIENT);
                            this.connected = true;
                        }
                        return;
                    }
                }
                this._waitHandshake(HANDSHAKE_RETRY);
            } catch (e) {
                //this.close();
                if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
                    FBTrace.sysout("_waitHandshake: " + e);

                if (this.isServer) {
                    this._waitHandshake(HANDSHAKE_RETRY);
                }
            }
        }, timeout);
    },

    /** @ignore */
    _sendPacket: function( packet) {
        if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
            FBTrace.sysout("_sendPacket " + packet);
        if (this._outputStreamCallback) {
			this._outputStreamCallback.addPacket(packet);
		}
        if (this.connected && this._outputStream) {
            this._outputStream.asyncWait(this._outputStreamCallback,0,0,null);
        }
    },

    /** @ignore */
    _buffer: '',

    /** @ignore */
    _waitOnPacket: function() {
        var avail, response;
		if (!this.connected || !this._inputStream)
			return;
        try {
            avail = this._inputStream.available();
        } catch (e) {
            if (FBTrace.DBG_CROSSFIRE_TRANSPORT) FBTrace.sysout("_waitOnPacket " + e);
            this.close();
            if (this.isServer) {
                this.open(this.host, this.port);
            }
        }
        if (avail) {
            response = this._scriptableInputStream.read(avail);

            if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
                FBTrace.sysout("_waitOnPacket got response => " + response);

            if (response) {
                this._buffer += response;
                
                while(this._parseBuffer()){
                    // until nothing more is recognized
                };
            }
        }
        if (this.connected) {
            this._defer(function() { this._waitOnPacket();});
        }
    },

    /** @ignore */
     _parseBuffer: function(){
        /*
         * Buffer always starts with:
         *   "Content-Length:" + str.length + "\r\n"
         */
        var block, packet,
            lengthIndexBegin = this._buffer.indexOf("Content-Length:"),
            lengthIndexEnd   = this._buffer.indexOf("\r\n"),
            length = Number(this._buffer.substring(lengthIndexBegin + "Content-Length:".length, lengthIndexEnd));
        if (lengthIndexBegin===0 && FBTrace.DBG_CROSSFIRE_TRANSPORT)
            FBTrace.sysout("_parseBuffer had extra stuff in the buffer, being ignored: " + this._buffer.substring(0,lengthIndexBegin)); // have yet to see this happen
            
        if (lengthIndexBegin != -1 && lengthIndexEnd != -1 && this._buffer.length >= lengthIndexEnd + 2 + length) {
            block = this._buffer.substr(lengthIndexEnd+2, length);
            this._buffer = this._buffer.slice(lengthIndexEnd + 2 + length);
            if (!this.isServer) {
                //FIXME: mcollins handle events/requests based on packet type, not server/client mode
                packet = new EventPacket(block);
            } else {
                packet = new RequestPacket(block);
            }
            this._notifyListeners(packet);
            return true;
        }
        return false;
    },

    /** @ignore */
    _notifyConnection: function( status) {
        for (var i = 0; i < this.listeners.length; ++i) {
            var listener = this.listeners[i];
            try {
                 var handler = listener["onConnectionStatusChanged"];
                 if (handler)
                     handler.apply(listener, [status]);
            } catch (e) {
                if (FBTrace.DBG_CROSSFIRE_TRANSPORT) FBTrace.sysout("_notifyConnection " + e);
            }
        }
    },


    /** @ignore */
    _notifyListeners: function( packet) {
        var listener, handler;
        for (var i = 0; i < this.listeners.length; ++i) {
            listener = this.listeners[i];
            try {

                if (!this.isServer) {
                    //FIXME: mcollins handle events/requests based on packet type, not server/client mode
                    handler = listener["fireEvent"];
                } else {
                    handler = listener["handleRequest"];
                }

                if (handler)
                    handler.apply(listener, [packet]);

            } catch (e) {
                if (FBTrace.DBG_CROSSFIRE_TRANSPORT) FBTrace.sysout("_notifyListeners " + e);
            }
        }
    }
};
