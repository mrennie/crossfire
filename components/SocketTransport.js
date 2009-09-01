/* See license.txt for terms of usage */
	
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
                                           
const CROSSFIRE_HANDSHAKE        = "Fbug+CrossfireHandshake\r\n";
const CHROME_DEV_TOOLS_HANDSHAKE = "ChromeDevToolsHandshake\r\n";
const HANDSHAKE_RETRY = 1007;

const Packets = {};

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

/**
 * SocketTransport
 * Firefox Socket Transport for remote debug protocol.
 * Opens a socket connection to a remote host and handles handshaking and
 * sending/receiving packets.
 */
function SocketTransport() {	
	Cu.import("resource://crossfire/Packet.js", Packets);
	this.wrappedJSObject = this;
	this.listeners = [];	
	this.connected = false;
}
	
SocketTransport.prototype = 
{
	// ----- XPCOM -----
		
	classDescription: "Firefox Socket Transport for remote debugging.",
	contractID: "@almaden.ibm.com/crossfire/socket-transport;1",
	classID: Components.ID("{7bfa8f17-156a-43c2-80d6-07877ef71769}"),
	QueryInterface: XPCOMUtils.generateQI(),
	  	
	
	// ----- external API ----
		
	/**
	 * SocketTransport.addListener
	 * 
	 * Adds listener to be called when the transport receives requests.
	 * The transport will pass a RequestPacket @see Packet.js
	 * as an argument to the listener's "handleRequest" method.
	 * 
	 * @param listener An object which contains a method named "handleRequest".
	 */
	addListener: function( listener) {
		this.listeners.push(listener);
	},
	
	/**
	 * Send a response packet. @see also Packet.js
	 * 
	 */
	sendResponse: function(command, requestSeq, body, running, success) {
		if (running == null || running == undefined) running = true; // assume we are running unless explicitly told otherwise
		success = !!(success); // convert to boolean
		var self = this;
		this._defer(function() { self._sendPacket(new Packets.ResponsePacket(command, requestSeq, body, running, success)); });
	},
	
	/**
	 * Send an event packet. @see also Packet.js
	 */
	sendEvent: function( event, args) {
		var self = this;
		this._defer(function() { self._sendPacket(new Packets.EventPacket(event, args)); });
	},
	
	/**
	 * Open a connection to the specified host/port
	 */
	open: function( host, port) {
		this._createTransport(host, port);
	},
	
	/**
	 * close a previously opened connection.
	 */
	close: function() {
		this.listeners = [];
		
		if (this._transport) {
			this._transport.close(null);
			delete this._transport;
		}

		if (this._outputStreamCallback)
			delete this._outputStreamCallback;
		
		this.connected = false;
	},
	
	// ----- internal methods -----
	
	_createTransport: function (host, port) {

		var transportService = Cc["@mozilla.org/network/socket-transport-service;1"]
		      				    .getService(Ci.nsISocketTransportService);
	
		this._transport = transportService.createTransport(null,0, host, port, null);
		
		this._outputStream = this._transport.openOutputStream(0, 0, 0);						

		this._inputStream = this._transport.openInputStream(Ci.nsITransport.OPEN_BLOCKING, 0, 0);

		this._scriptableInputStream = Cc["@mozilla.org/scriptableinputstream;1"]
   			             .createInstance(Ci.nsIScriptableInputStream);
		
		this._scriptableInputStream.init(this._inputStream);
		
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
						//TODO: log exception
					}
				}										
			};
		
		this._sendHandshake();			
	},
	
	_defer: function( callback, delay) {
		if (!delay) delay = 1;
		var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
		timer.initWithCallback( {
			QueryInterface: function( iid) {
				if(!iid.equals(Ci.nsISupports) && !iid.equals(Ci.nsITimerCallback))			
					throw NS_ERROR_NO_INTERFACE;
				return this;
			},
			notify: function( aTimer) {
				callback.call(null);
			}
		}, delay, timer.TYPE_ONE_SHOT);
	},
			
	_sendHandshake: function() {
		this._outputStream.asyncWait( {
			QueryInterface: function( iid) { 
				if(!iid.equals(Ci.nsISupports) && !iid.equals(Ci.nsIOutputStreamCallback))			
					throw NS_ERROR_NO_INTERFACE;
				return this;
			},
			onOutputStreamReady: function( outputStream) {
				outputStream.write(CROSSFIRE_HANDSHAKE, 25);
				outputStream.flush();
			}
		}, 0, 0, null); 
		
		this._waitHandshake();
	},
	
	_waitHandshake: function( timeout) {
		var self = this;
		this._defer(function() { 
			if (self._inputStream.available() == 25) {
				if (self._scriptableInputStream.read(25) == CROSSFIRE_HANDSHAKE) {
					self.connected = true;
					self._outputStream.asyncWait(self._outputStreamCallback,0,0,null);
					self._waitOnPacket();
					return;
				}
			}
			self._waitHandshake(HANDSHAKE_RETRY);
		}, timeout);
	},
	
	_sendPacket: function( packet) {
		this._outputStreamCallback.addPacket(packet);
		if (this.connected) {
			this._outputStream.asyncWait(this._outputStreamCallback,0,0,null);
		}
	},
	
	_waitOnPacket: function() {
		var self = this;
		var avail;
		try {
			avail = this._inputStream.available();
		} catch (e) {

		}
		if (avail) {
			var response = this._scriptableInputStream.read(avail);
			if (response) {
				this._notifyListeners(new Packets.RequestPacket(response));
			}
		}
		this._defer(function() { self._waitOnPacket();});
	},
	

	
	_notifyListeners: function( requestPacket) {
		for (var i = 0; i < this.listeners.length; ++i) {
			var listener = this.listeners[i];				
			try {
				var handler = listener["handleRequest"];
				if (handler)
					handler.apply(listener, [requestPacket]);
			} catch (e) {
				//TODO: log exception
			}
		}
	}
};

function NSGetModule(compMgr, fileSpec)
{
  return XPCOMUtils.generateModule([SocketTransport]);
}
