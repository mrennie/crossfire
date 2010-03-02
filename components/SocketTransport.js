/* See license.txt for terms of usage */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

const CROSSFIRE_HANDSHAKE        = "CrossfireHandshake\r\n";
const HANDSHAKE_RETRY = 1007;

const Packets = {};


Cu.import("resource://gre/modules/XPCOMUtils.jsm");

/**
 * @name SocketTransport
 * @constructor SocketTransport
 * @description Firefox Socket Transport for remote debug protocol.
 * Opens a socket connection to a remote host and handles handshaking and
 * sending/receiving packets.
 */
function SocketTransport() {
    Cu.import("resource://crossfire/Packet.js", Packets);
    this.wrappedJSObject = this;
    this.listeners = [];
    this.connected = false;

    //if (DEBUG) {
        var appShellService = Cc["@mozilla.org/appshell/appShellService;1"].
            getService(Ci.nsIAppShellService);
        this.debug = function(str) { appShellService.hiddenDOMWindow.dump("Crossfire SocketTransport :: " + str + "\n"); };
    //} */
}

SocketTransport.prototype =
/** @lends SocketTransport */
{
    // ----- XPCOM -----

    classDescription: "Firefox Socket Transport for remote debugging.",
    contractID: "@almaden.ibm.com/crossfire/socket-transport;1",
    classID: Components.ID("{7bfa8f17-156a-43c2-80d6-07877ef71769}"),
    QueryInterface: XPCOMUtils.generateQI(),


    // ----- external API ----

    /**
     * @name SocketTransport.addListener
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
     * @name SocketTransport.sendResponse
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
        this._defer(function() { this._sendPacket(new Packets.ResponsePacket(command, requestSeq, body, running, success)); });
    },

    /**
     * @name SocketTransport.sendEvent
     * @function
     * @description Send an event packet. @see also Packet.js
     * @param event Event name
     * @param data optional JSON object containing additional data about the event.
     */
    sendEvent: function( event, data) {
        this._defer(function() { this._sendPacket(new Packets.EventPacket(event, data)); });
    },

    /**
     * @name SocketTransport.open
     * @function
     * @param {String} host the hostname.
     * @param {Number} port the port.
     * @description Open a connection to the specified host/port.
     */
    open: function( host, port) {
        this._destroyTransport();
        this._createTransport(host, port, false);
    },

    /**
     * @name SocketTransport.listen
     * @function
     * @param {String} host the hostname.
     * @param {Number} port the port.
     * @description Listen for connections on localhost to the specified port.
     */
    listen: function( host, port) {
        this._destroyTransport();
        this.listening = true;
        this._createTransport(host, port);

        if (this.debug)
            this.debug("listening...");
    },

    /**
     * @name SocketTransport.close
     * @function
     * @description close a previously opened connection.
     */
    close: function() {
        this.sendEvent("closed");

        this._defer(function() {
            this._notifyConnection("closed");
            this.connected = false;

            if (this._outputStream) {
                this._outputStream.close();
            }

            if (this._inputStream) {
                this._inputStream.close(null);
            }

            if (this._transport) {
                this._transport.close(null);
            }

            this._destroyTransport();
        });
    },

    // ----- internal methods -----
    /** @ignore */
    _createTransport: function (host, port) {

        if (this.debug)
            this.debug("_createTransport");

        if (this.listening) {

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
                    if (self.debug)
                        self.debug(" socket accepted. transport is => " + transport);

                    self._transport = transport;

                    self._createInputStream();

                    self._createOutputStream();

                    self._notifyConnection("waitOnHandshake");
                    self._waitHandshake();
                }
            });
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
        if (this.debug)
            this.debug("_createInputSteram");

        this._inputStream = this._transport.openInputStream(Ci.nsITransport.OPEN_BLOCKING & Ci.nsITransport.OPEN_UNBUFFERED, 0, 0);

        this._scriptableInputStream = Cc["@mozilla.org/scriptableinputstream;1"]
                            .createInstance(Ci.nsIScriptableInputStream);

        this._scriptableInputStream.init(this._inputStream);
    },

    _createOutputStream: function() {
        if (this.debug)
            this.debug("_createOutputStream");

        this._outputStream = this._transport.openOutputStream(Ci.nsITransport.OPEN_BLOCKING & Ci.nsITransport.OPEN_UNBUFFERED, 0, 0);

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
                        var packet;
                        while ((packet = this._packets.pop())) {
                            outputStream.write(packet.data, packet.length);
                            outputStream.flush();
                        }
                    } catch( ex) {
                        if (this.debug) this.debug(ex);
                    }
                }
            };

    },

    _destroyTransport: function() {
        if (this.debug)
            this.debug("_destroyTransport");

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
        if (this.debug)
            this.debug("_sendHandshake");

        this._outputStream.asyncWait( {
            QueryInterface: function( iid) {
                if(!iid.equals(Ci.nsISupports) && !iid.equals(Ci.nsIOutputStreamCallback))
                    throw NS_ERROR_NO_INTERFACE;
                return this;
            },
            onOutputStreamReady: function( outputStream) {
                outputStream.write(CROSSFIRE_HANDSHAKE, CROSSFIRE_HANDSHAKE.length);
                outputStream.flush();
            }
        }, 0, 0, null);

        if (this.listening) {
            this._waitOnPacket();
            this._notifyConnection("handshakeComplete");
        } else {
            this._notifyConnection("waitOnHandshake");
            this._waitHandshake();
        }
    },

    /** @ignore */
    _waitHandshake: function( timeout) {
        if (this.debug)
            this.debug("_waitHandshake");

        this._defer(function() {
            try {
                if (this._inputStream.available() == CROSSFIRE_HANDSHAKE.length) {
                    if (this._scriptableInputStream.read(CROSSFIRE_HANDSHAKE.length) == CROSSFIRE_HANDSHAKE) {
                        this.connected = true;
                        this._outputStream.asyncWait(this._outputStreamCallback,0,0,null);
                        if (this.listening) {
                            this._sendHandshake();
                        } else {
                            this._waitOnPacket();
                            this._notifyConnection("handshakeComplete");
                        }
                        return;
                    }
                }
                this._waitHandshake(HANDSHAKE_RETRY);
            } catch (e) {
                //this.close();
                if (this.debug)
                    this.debug("_waitHandshake: " + e);

                if (this.listening) {
                    this._waitHandshake(HANDSHAKE_RETRY);
                }
            }
        }, timeout);
    },

    /** @ignore */
    _sendPacket: function( packet) {
        this._outputStreamCallback.addPacket(packet);
        if (this.connected) {
            this._outputStream.asyncWait(this._outputStreamCallback,0,0,null);
        }
    },

    /** @ignore */
    _waitOnPacket: function() {
        var avail, response, packet;
        try {
            avail = this._inputStream.available();
        } catch (e) {
            if (this.debug) this.debug(e);
        }
        if (avail) {
            response = this._scriptableInputStream.read(avail);

            if (this.debug)
                this.debug("_waitOnPacket got response => " + response);

            if (response) {
                if (this.listening) {
                    packet = new Packets.EventPacket(response);
                } else {
                    packet = new Packets.RequestPacket(response);
                }
                this._notifyListeners(packet);
            }
        }
        if (this.connected) {
            this._defer(function() { this._waitOnPacket();});
        }
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
                if (this.debug) this.debug(e);
            }
        }
    },


    /** @ignore */
    _notifyListeners: function( packet) {
        var listener, handler;
        for (var i = 0; i < this.listeners.length; ++i) {
            listener = this.listeners[i];
            try {

                if (this.listening) {
                    handler = listener["fireEvent"];
                } else {
                    handler = listener["handleRequest"];
                }

                if (handler)
                    handler.apply(listener, [packet]);

            } catch (e) {
                if (this.debug) this.debug(e);
            }
        }
    }
};

/** @ignore */
function NSGetModule(compMgr, fileSpec)
{
  return XPCOMUtils.generateModule([SocketTransport]);
}
