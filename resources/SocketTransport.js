/* See license.txt for terms of usage */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
/**
 * @name CROSSFIRE_HANDSHAKE
 * @description the String representing the handshake that is negotiated when initially connecting
 * @constant
 * @public
 * @memberOf CrossfireSocketTransport
 * @type String
 */
const CROSSFIRE_HANDSHAKE = "CrossfireHandshake";
/**
 * @name HANDSHAKE_RETRY
 * @description The default time-out in milliseconds to re-try a handshake
 * @constant
 * @public
 * @memberOf CrossfireSocketTransport
 * @type Integer
 */
const HANDSHAKE_RETRY = 1007;

/**
 * @ignore
 */
var EXPORTED_SYMBOLS = [ "CrossfireSocketTransport", "getCrossfireServer", "CROSSFIRE_STATUS" ];

Cu.import("resource://crossfire/Packet.js");

try {
    Cu.import("resource://firebug/firebug-trace-service.js");
    FBTrace = traceConsoleService.getTracer("extensions.firebug");
} catch(ex) {
    FBTrace = {};
}

const PrefService = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService);


/**
 * @name CROSSFIRE_STATUS
 * @description The {@link Array} of valid statuses:
 * <ul>
 * <li><code>disconnected</code></li>
 * <li><code>wait_server</code></li>
 * <li><code>connecting</code></li>
 * <li><code>connected_server</code></li>
 * <li><code>connected_client</code></li>
 * </ul>
 * @public
 * @memberOf CrossfireSocketTransport
 */
var CROSSFIRE_STATUS = {
        STATUS_DISCONNECTED: "disconnected",
        STATUS_WAIT_SERVER: "wait_server",
        STATUS_CONNECTING: "connecting",
        STATUS_CONNECTED_SERVER: "connected_server",
        STATUS_CONNECTED_CLIENT: "connected_client"

};

/**
 * @name _instance
 * @description The singleton instance of {@link CrossfireSocketTransport}
 * @private
 * @memberOf CrossfireSocketTransport
 * @type CrossfireSocketTransport
 */
var _instance;

/**
 * @name getCrossfireServer
 * @description returns the singleton instance of {@link CrossfireSocketTransport}
 * @function
 * @public
 * @memberOf CrossfireSocketTransport
 * @type CrossfireSocketTransport
 * @returns the singleton instance of the {@link CrossfireSocketTransport}
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
 * @description Firefox Socket Transport for remote debug protocol.
 * Opens a socket connection to a remote host and handles handshaking and
 * sending/receiving packets.
 * @constructor
 * @public
 * @param isServer boolean specifying whether to start the transport as client or server
 * @type CrossfireSocketTransport
 * @returns a new instance of CrossfireSocketTransport
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
{

    // ----- external API ----

    /**
     * @name addListener
     * @description Adds a listener to be called when the transport receives requests.
     * The transport will pass a {@link RequestPacket} as an argument to the listener's <code>handleRequest</code> method.
     * @function
     * @public
     * @memberOf CrossfireSocketTransport
     * @param listener An object which contains a method named "handleRequest".
     * @see Packet.js
     */
    addListener: function( listener) {
        // don't push the listener again if it is already there
        // http://code.google.com/p/fbug/issues/detail?id=3452
        if(this.listeners.indexOf(listener) < 0) {
            this.listeners.push(listener);
        }
    },

    /**
     * @name removeListener
     * @description removes a previously added listener
     * @function
     * @public
     * @param listener
     * @returns the listener that was removed.
     */
    removeListener: function( listener) {
        var lIndex = this.listeners.indexOf(listener);
        if(lIndex > 0) {
            return this.listeners.splice(lIndex, 1);
        }
    },

    /**
     * @name sendResponse
     * @description Builds and sends a response packet. @see also Packet.js
     * @function
     * @public
     * @memberOf CrossfireSocketTransport
     * @param command The name of the command for the response.
     * @param requestSeq Sequence number of the request that initiated the response.
     * @param the Crossfire id for the given context. Can be <code>null</code>
     * @param body JSON body of the response
     * @param running boolean indicates if execution is continuing.
     * @param success boolean indicates whether the command was successful.
     */
    sendResponse: function(command, requestSeq, contextid, body, running, success, tool) {
        if (running == null || running == undefined) running = true; // assume we are running unless explicitly told otherwise
        success = !!(success); // convert to boolean
        var packet;
        if (tool) {
            packet = new ResponsePacket(command, requestSeq, contextid, body, running, success, ["tool:"+tool]);
        } else {
            packet = new ResponsePacket(command, requestSeq, contextid, body, running, success);
        }
        this._defer(function() { this._sendPacket(packet); });
    },

    /**
     * @name sendEvent
     * @description Send an event packet. @see also Packet.js
     * @function
     * @public
     * @memberOf CrossfireSocketTransport
     * @param event Event name
     * @param data optional JSON object containing additional data about the event.
     */
    sendEvent: function( event, data, tool) {
        if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
            FBTrace.sysout("sendEvent " + event + " :: " + data);
        var packet;

        if (tool) {
            packet = new EventPacket(event, data, ["tool:"+tool]);
        } else {
            packet = new EventPacket(event, data);
        }

        this._defer(function() { this._sendPacket(packet); });
    },

    /**
     * @name sendRequest
     * @description Send a request packet. @see also Packet.js
     * @function
     * @public
     * @memberof CrossfireSocketTransport
     */
    sendRequest: function(command, data, tool) {
        var packet;
        if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
            FBTrace.sysout("sendRequest");

        if (!data) data = {};
        if (!tool) tool = "";
        packet = new RequestPacket(command, data, ["tool:"+tool]);

        if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
            FBTrace.sysout("packet is " + packet,packet);

        this._defer(function() {this._sendPacket(packet);});
    },

    /**
     * @name open
     * @description Open a connection to the specified host/port.
     * @function
     * @public
     * @memberOf CrossfireSocketTransport
     * @param {String} host the hostname.
     * @param {Number} port the port.
     */
    open: function( host, port) {
        this._destroyTransport();
        this.host = host;
        this.port = port;
        this._createTransport(host, port);
    },

    /**
     * @name close
     * @description Close a previously opened connection.
     * <br><br>
     * Fires a <code>closed</code> event.
     * @function
     * @public
     * @memberOf CrossfireSocketTransport
     */
    close: function() {
        this.sendEvent("closed",{});

        this._defer(function() {
            this._notifyConnection(CROSSFIRE_STATUS.STATUS_DISCONNECTED);
            this.connected = false;

            this._closeStreams();

            if (this._transport) {
                this._transport.close("disconnected"); // pass aReason for close
            }

            try {
                if (this.isServer) {
                    this._serverSocket.close();
                }
            } catch( e2) {
                if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
                    FBTrace.sysout("exception closing server socket: " +e2);
            }

            this._destroyTransport();
            // clean up the listeners
            // http://code.google.com/p/fbug/issues/detail?id=3452
            this.listeners = [];
        });
    },

    /**
     * @name reset
     * @description reset the server (for example if a client connection drops).
     * @function
     * @public
     * @memberOf CrossfireSocketTransport
     */
    reset: function() {
        if (this.isServer) {
             if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
                 FBTrace.sysout("Crossfire server resetting");

            this._closeStreams();

            if (this._transport) {
                this._transport.close("resetting");
            }

            this._defer(function() {
                try {
                    this._notifyConnection(CROSSFIRE_STATUS.STATUS_WAIT_SERVER);
                } catch (e) {
                    if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
                        FBTrace.sysout("exception resetting: " + e);
                }

                //this._createTransport(this.host, this.port);
            });


        }
    },

    // ----- internal methods -----
    /**
     * @name _createTransport
     * @description Creates a new {@link CrossfireSocketTransport} for the given host and port
     * @function
     * @private
     * @memberOf CrossfireSocketTransport
     * @param host a {@link String} value for the host
     * @param port an {@link Integer} value for the port
     * @type CrossfireSocketTransport
     * @returns a new {@link CrossfireSocketTransport} for the given host and port
     * @see https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIServerSocket
     * @see https://developer.mozilla.org/en/nsISocketTransportService
     */
    _createTransport: function (host, port) {

        if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
            FBTrace.sysout("_createTransport");

        if (this.isServer) {

            this._serverSocket = Cc["@mozilla.org/network/server-socket;1"]
                                  .createInstance(Ci.nsIServerSocket);

            // mcollins: issue 3606
            // create a preference to pass to serverSocket.init() so we can connect to more than loopback.
            // https://developer.mozilla.org/en/XPCOM_Interface_Reference/nsIServerSocket#init%28%29
            var isLoopbackOnly = true;
            try {
                var prefBranch = PrefService.getBranch("extensions.firebug.crossfire.");
                if (prefBranch) {
                    isLoopbackOnly = prefBranch.getBoolPref("loopbackOnly");
                    if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
                        FBTrace.sysout("Crossfire got loopbackOnly pref: " + isLoopbackOnly);
                }
            } catch (e1) {
                if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
                    FBTrace.sysout("Exception getting loopbackOnly pref. Crossfire will only accept connections from localhost.");
            }
            try {
                this._serverSocket.init(port, isLoopbackOnly, -1);
                this._listenForHandshake();
                this._notifyConnection(CROSSFIRE_STATUS.STATUS_WAIT_SERVER);
            } catch (e2) {
                if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
                    FBTrace.sysout("exception creating crossfire server: " + e2);
                // TODO: notifyConnection of failure
            }
        } else {
            var transportService = Cc["@mozilla.org/network/socket-transport-service;1"]
                                      .getService(Ci.nsISocketTransportService);

            this._transport = transportService.createTransport(null,0, host, port, null);

            this._createInputStream();

            this._createOutputStream();

            this._sendHandshake();
        }
    },

    /**
     * @name _createInputStream
     * @description Creates a new input stream
     * @function
     * @private
     * @memberOf CrossfireSocketTransport
     * @see https://developer.mozilla.org/en/nsScriptableInputStream
     */
    _createInputStream: function() {
        if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
            FBTrace.sysout("_createInputStream");

        this._inputStream = this._transport.openInputStream(Ci.nsITransport.OPEN_BLOCKING | Ci.nsITransport.OPEN_UNBUFFERED, 0, 0);

        this._scriptableInputStream = Cc["@mozilla.org/scriptableinputstream;1"]
                            .createInstance(Ci.nsIScriptableInputStream);

        this._scriptableInputStream.init(this._inputStream);
    },

    /**
     * @name _createOutputStream
     * @description Creates an output stream
     * @function
     * @private
     * @memberOf CrossfireSocketTransport
     * @see https://developer.mozilla.org/en/nsIOutputStream
     */
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

    /**
     * @name _destroyTransport
     * @description Destroys the input and output streams and the underlying transport
     * @function
     * @private
     * @memberOf CrossfireSocketTransport
     * @see https://developer.mozilla.org/en/nsScriptableInputStream
     * @see https://developer.mozilla.org/en/nsIOutputStream
     * @see https://developer.mozilla.org/en/nsISocketTransportService
     */
    _destroyTransport: function() {
        if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
            FBTrace.sysout("_destroyTransport");

        delete this._outputStreamCallback;
        delete this._outputStream;

        delete this._scriptableInputStream;
        delete this._inputStream;

        delete this._transport;
    },

    /**
     * @name _closeStreams
     * @description close the input and output streams created by the transport.
     * @function
     * @private
     * @memberOf CrossfireSocketTransport
     */
    _closeStreams: function() {
        this._buffer='';
        if (this._inputStream) {
            this._inputStream.close(null);
        }

        if (this._outputStream) {
            this._outputStream.flush();
            this._outputStream.close();
        }
    },

    /**
     * @name _defer
     * @description Defers a call-back for the given delay time (in milliseconds)
     * @function
     * @private
     * @memberOf CrossfireSocketTransport
     * @param callback
     * @param delay the amount of time to wait (in milliseconds)
     * @see https://developer.mozilla.org/en/nsITimer
     */
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

    /**
     * @name _listenForHandshake
     * @description waits for a handshake to be received on the server socket.
     * @function
     * @private
     * @memberOf CrossfireSocketTransport
     * @since 0.3a4
     */
    _listenForHandshake: function() {
        var self = this;
        this._serverSocket.asyncListen({
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
    },

    /**
     * @name _sendHandshake
     * @description Sends the standard handshake ({@link CROSSFIRE_HANDSHAKE}) over the transport.
     * @function
     * @private
     * @memberOf CrossfireSocketTransport
     */
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
                if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
                    FBTrace.sysout("_sendHandshake output stream is ready.");
                var tools = self._collectToolNames();
                if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
                    FBTrace.sysout("_sendHandshake toolString is: " + tools);
                var handshake = CROSSFIRE_HANDSHAKE + "\r\n" + tools + "\r\n";
                //outputStream.flush();
                outputStream.write(handshake, handshake.length);
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

    /**
     * @name _waitHandshake
     * @description Waits for a handshake acknowledgment for the given timeout interval
     * @function
     * @private
     * @memberOf CrossfireSocketTransport
     * @param timeout the amount of time to wait for a handshake acknowledgment
     */
    _waitHandshake: function( timeout) {
        if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
            FBTrace.sysout("_waitHandshake");

        this._defer(function() {
            try {
                if (this._inputStream.available() >= CROSSFIRE_HANDSHAKE.length) {
                    if (this._scriptableInputStream.read(CROSSFIRE_HANDSHAKE.length) == CROSSFIRE_HANDSHAKE) {
                        if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
                            FBTrace.sysout("_waitHandshake read handshake string");
                        if (this.isServer) {
                            var buff = "";
                            while (this._inputStream.available() > 1 && buff != "\r\n" )
                                buff = this._scriptableInputStream.read(2);
                            this._readToolString();
                            this._sendHandshake();
                        } else {
                            this.connected = true;
                            this._notifyConnection(CROSSFIRE_STATUS.STATUS_CONNECTED_CLIENT);
                            this._waitOnPacket();
                        }
                        return;
                    }
                }
                this._waitHandshake(HANDSHAKE_RETRY);
            } catch (e) {
                if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
                    FBTrace.sysout("_waitHandshake exception: " + e, e);

                if (this.isServer) {
                    this._waitHandshake(HANDSHAKE_RETRY);
                } else {
                    this.close();
                }
            }
        }, timeout);
    },

    _readToolString: function() {
        var tools, prev, cur, toolString = "";
        if (this._inputStream.available() > 0) {
            while(prev != '\r' && cur != '\n') {
                cur = this._scriptableInputStream.read(1);
                toolString += cur;
                prev = cur;
            }
            if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
                FBTrace.sysout("toolString is: " + toolString);

            tools = toolString.split(",");

            var activationListener;
            for (var i = 0; i < this.listeners.length; ++i) {
                listener = this.listeners[i];
                if (typeof(listener.activateTool) == "function") {
                    activationListener = listener;
                    break;
                }
            }
            if (activationListener) {
                for (var i in tools) {
                    try {
                        activationListener.activateTool(tools[i]);
                    } catch (e) {
                        if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
                            FBTrace.sysout("exception activating tool: " + tools[i] + ", " + e);
                    }
                }
            }
        }
    },

    /**
     * @name _sendPacket
     * @description Sends the given packet over the underlying transport
     * @function
     * @private
     * @memberOf CrossfireSocketTransport
     * @param packet the packet to send over the underlying transport
     */
    _sendPacket: function( packet) {
        if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
            FBTrace.sysout("_sendPacket " + packet, packet);
        if (this._outputStreamCallback) {
            this._outputStreamCallback.addPacket(packet);
        }
        if (this.connected && this._outputStream) {
            this._outputStream.asyncWait(this._outputStreamCallback,0,0,null);
        }
    },

    /** @ignore */
    _buffer: '',

    /**
     * @name _waitOnPacket
     * @description Waits for a packet to be read from the underlying transport
     * @function
     * @private
     * @memberOf CrossfireSocketTransport
     * @see https://developer.mozilla.org/en/nsIScriptableInputStream/available
     */
    _waitOnPacket: function() {
        var avail, response;
        if (!this.connected || !this._inputStream)
            return;
        try {
            avail = this._inputStream.available();
        } catch (e) {
            if (FBTrace.DBG_CROSSFIRE_TRANSPORT) FBTrace.sysout("_waitOnPacket " + e);
            if (this.isServer) {
                this.reset();
            } else {
                this.close();
            }
            return;
        }
        if (avail) {
            response = this._scriptableInputStream.read(avail);

            if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
                FBTrace.sysout("_waitOnPacket got response => " + response);

            if (response) {
                this._buffer += response;

                while(this._parseBuffer()){
                    // until nothing more is recognized
                }
            }
        }
        if (this.connected) {
            this._defer(function() { this._waitOnPacket();},5);
        }
    },

    /**
     * @name _parseBuffer
     * @description Reads packets from the backing buffer
     * @function
     * @private
     * @memberOf CrossfireSocketTransport
     */
     _parseBuffer: function() {
        /*
         * Buffer always has length header:
         *   "Content-Length:" + str.length + "\r\n"
         */
        var block, packet, length, i, headers = {}, header,
            headersRaw, contentBegin,
            headersEnd = this._buffer.indexOf("\r\n\r\n");

        if (headersEnd <= 4) {
            // xxxMcollins then we got junk whitespace in the stream
            // this happens on the client side, but is probably the server side's fault?
            this._buffer = this._buffer.slice(4);
            headersEnd = this._buffer.indexOf("\r\n\r\n");
        }

        contentBegin = headersEnd + 4;
        headersRaw = this._buffer.substring(0,headersEnd);

        headersRaw = headersRaw.split("\r\n");
        for (i=0; i < headersRaw.length; i++)
        {
            header = /([\w-]+)\s*:\s*(\S+)/.exec(headersRaw[i]);
            if (header)
                headers[header[1].toLowerCase()] = header[2];
        }

        length = parseInt(headers['content-length'],10);

        if (this._buffer.length >= contentBegin + length) {
            block = this._buffer.substr(contentBegin, length);
            this._buffer = this._buffer.slice(contentBegin + length);
            if (!this.isServer) {
                //FIXME: mcollins handle events/requests based on packet type, not server/client mode
                packet = new EventPacket(block);
            } else {
                packet = new RequestPacket(block);
            }
            this._notifyListeners(packet, headers);
            return true;
        }
        return false;
    },

    /**
     * @name _notifyConnection
     * @description Notifies <code>onConnectionStatusChanged</code> listeners that the connection state has changed
     * @function
     * @private
     * @memberOf CrossfireSocketTransport
     * @param status the status of the connection
     */
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

    /**
     * @name _notifyListeners
     * @description Notifies <code>fireEvent</code> or <code>handleRequest</code> listeners based on the kind of the packet
     * @function
     * @private
     * @memberOf CrossfireSocketTransport
     * @param packet the packet that has been read
     */
    _notifyListeners: function( packet, headers) {
        var listener, handler;

        if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
            FBTrace.sysout("SocketTransport notifying " + this.listeners.length + " listeners");

        for (var i = 0; i < this.listeners.length; ++i) {
            listener = this.listeners[i];

            if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
                FBTrace.sysout("notifying " + listener.toolName);

            try {
                handler = null;
                if (packet.type == "event") {
                    if ("all" == listener.toolName) {
                        handler = listener["fireEvent"];
                    } else if ( headers["tool"] && listener.toolName
                            &&  headers["tool"] == listener.toolName
                            && listener.supportsEvent(packet)) {
                        handler = listener["handleEvent"];
                    }
                } else if (packet.type == "response") {
                    if ("all" == listener.toolName) {
                        handler = listener["handleResponse"];
                    } else if ( headers["tool"] && listener.toolName
                            &&  headers["tool"] == listener.toolName
                            && listener.supportsResponse(packet)) {
                        handler = listener["handleResponse"];
                    }
                } else {
                    if ("all" == listener.toolName
                        || ( headers["tool"] && listener.toolName
                            &&  headers["tool"] == listener.toolName
                            && listener.supportsRequest(packet))) {
                        handler = listener["handleRequest"];
                    }
                }

                if (handler)
                    handler.apply(listener, [packet]);

            } catch (e) {
                if (FBTrace.DBG_CROSSFIRE_TRANSPORT) FBTrace.sysout("_notifyListeners " + e);
            }
        }
    },

    /**
     * @name _collectToolNames
     * @description collects a comma-separated list of all tool names from registered listeners
     * @function
     * @private
     * @memberOf CrossfireSocketTransport
     */
    _collectToolNames: function() {
        var i, j,
        listener,
        toolName,
        toolNames = [];

        if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
            FBTrace.sysout("_collectToolNames");

        for (i = 0; i < this.listeners.length; ++i) {
            listener = this.listeners[i];
            if (listener.toolName) {
                try {
                    toolName = listener.toolName;
                    if (toolName != "all") {
                        if (FBTrace.DBG_CROSSFIRE_TRANSPORT)
                            FBTrace.sysout("_collectToolNames adding " + toolName);
                        toolNames.push(toolName);
                    }

                } catch( e) {
                    if (FBTrace.DBG_CROSSFIRE_TRANSPORT) FBTrace.sysout("_collectToolNames " + e);
                }
            }
        }

        if (toolNames.length > 0)
            return toolNames.join(",");

        return "";
    }

};
