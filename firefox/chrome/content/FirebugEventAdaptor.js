/* See license.txt for terms of usage */

if (!Crossfire) var Crossfire = {};

// FirebugEventAdaptor
FBL.ns(function() { with(FBL) {

	/**
	 * @name FirebugEventAdaptor
	 * @description handles events on a per-context basis and returns event arguments formatted as JSON objects.
	 * @constructor
	 * @public
	 * @param context the current Crossfire context
	 * @type FirebugEventAdaptor
	 * @returns a new {@link FirebugEventAdaptor}
	 */
	 function FirebugEventAdaptor( context) {
	     this.context = context;
	     this.contextId = context.Crossfire.crossfire_id;
	     if (FBTrace.DBG_CROSSFIRE)
	            FBTrace.sysout("CROSSFIRE Creating new FirebugEventAdaptor for context: " + this.contextId);
	 }
	
	 FirebugEventAdaptor.prototype = {
         /**
          * @name onContextCreated
          * @description Creates the body for an <code>onContextCreated</code> event.
          * <br><br>
          * The event body contains the following:
          * <ul>
          * <li><code>context_id</code> - the id of the current Crossfire context</li>
          * <li><code>data</code> - the event payload with the <code>href</code> value set</li>
          * </ul>
          * @function
          * @public
          * @memberOf FirebugEventAdaptor
          * @type Array
          * @return the Array of data items for the <code>onContextCreated</code> event.
          */
         "onContextCreated": function() {
             if (FBTrace.DBG_CROSSFIRE)
                 FBTrace.sysout("CROSSFIRE EventAdaptor onContextCreated");
             
             var href;
             try {
                 href = this.context.window.location.href;
             } catch(e) {
                 href = "";
             }
             return { "context_id": this.contextId, "data": { "href": href } };
          },

         /**
           * @name onContextLoaded
           * @description Creates the body for an <code>onContextLoaded</code> event.
           * <br><br>
           * The event body contains the following:
           * <ul>
           * <li><code>context_id</code> - the id of the current Crossfire context</li>
           * <li><code>data</code> - the event payload with the <code>href</code> value set</li>
           * </ul>
           * @function
           * @public
           * @memberOf FirebugEventAdaptor
           * @type Array
           * @return the Array of data items for the <code>onContextLoaded</code> event.
           */
          "onContextLoaded": function() {
        	  if (FBTrace.DBG_CROSSFIRE)
                  FBTrace.sysout("CROSSFIRE EventAdaptor onContextLoaded");

              var href;
              try {
                  href = this.context.window.location.href;
              } catch(e) {
                  href = "";
              }
              return { "context_id": this.contextId, "data": { "href": href } };
          },

          /**
           * @name onContextChanged
           * @description Creates the body for an <code>onContextChanged</code> event.
           * <br><br>
           * The event body contains the following:
           * <ul>
           * <li><code>context_id</code> - the id of the current Crossfire context</li>
           * <li><code>new_context_id</code> - the id of the Crossfire context switched to</li>
           * <li><code>data</code> - the event payload with the <code>href</code> and <code>new_href</code> values set</li>
           * </ul>
           * @function
           * @public
           * @memberOf FirebugEventAdaptor
           * @type Array
           * @return the Array of data items for the <code>onContextChanged</code> event.
           */
          "onContextChanged": function( newContext) {
        	  if (FBTrace.DBG_CROSSFIRE)
                  FBTrace.sysout("CROSSFIRE EventAdaptor onContextChanged");
        	  
              var newContextId, newHref, href;
              newContextId = newContext.Crossfire.crossfire_id;
              try {
                  href = this.context.window.location.href;
              } catch(e) {
                  href = "";
              }
              try {
                  newHref = newContext.window.location.href;
              } catch(e) {
                  newHref = "";
              }
              return { "context_id": this.contextId, "new_context_id": newContextId, "data": { "href": href, "new_href": newHref } };
          },
	
          /**
           * @name onContextDestroyed
           * @description Creates the body for an <code>onContextDestroyed</code> event.
           * <br><br>
           * The event body contains the following:
           * <ul>
           * <li><code>context_id</code> - the id of the current Crossfire context</li>
           * </ul>
           * @function
           * @public
           * @memberOf FirebugEventAdaptor
           * @type Array
           * @return the Array of data items for the <code>onContextDestroyed</code> event.
           */
          "onContextDestroyed": function() {
               if (FBTrace.DBG_CROSSFIRE)
                   FBTrace.sysout("CROSSFIRE EventAdaptor onContextDestroyed");
               return { "context_id": this.contextId };
          },

          /**
           * @name onConsoleDebug
           * @description Creates the body for an <code>onConsoleDebug</code> event.
           * <br><br>
           * The event body contains the following:
           * <ul>
           * <li><code>context_id</code> - the id of the current Crossfire context</li>
           * <li><code>data</code> - the event payload from Firebug</li>
           * </ul>
           * @function
           * @public
           * @memberOf FirebugEventAdaptor
           * @type Array
           * @return the Array of data items for the <code>onConsoleDebug</code> event.
           */
          "onConsoleDebug": function( data) {
             if (FBTrace.DBG_CROSSFIRE)
                 FBTrace.sysout("CROSSFIRE EventAdaptor onConsoleDebug");
             return { "context_id": this.contextId, "data": data };
          },

          /**
           * @name onConsoleLog
           * @description Creates the body for an <code>onConsoleLog</code> event.
           * <br><br>
           * The event body contains the following:
           * <ul>
           * <li><code>context_id</code> - the id of the current Crossfire context</li>
           * <li><code>data</code> - the event payload from Firebug</li>
           * </ul>
           * @function
           * @public
           * @memberOf FirebugEventAdaptor
           * @type Array
           * @return the Array of data items for the <code>onConsoleLog</code> event.
           */
          "onConsoleLog": function( data) {
             if (FBTrace.DBG_CROSSFIRE)
                 FBTrace.sysout("CROSSFIRE EventAdaptor onConsoleLog");
             return { "context_id": this.contextId, "data": data };
          },

          /**
           * @name onConsoleInfo
           * @description Creates the body for an <code>onConsoleInfo</code> event.
           * <br><br>
           * The event body contains the following:
           * <ul>
           * <li><code>context_id</code> - the id of the current Crossfire context</li>
           * <li><code>data</code> - the event payload from Firebug</li>
           * </ul>
           * @function
           * @public
           * @memberOf FirebugEventAdaptor
           * @type Array
           * @return the Array of data items for the <code>onConsoleInfo</code> event.
           */
          "onConsoleInfo": function( data) {
             if (FBTrace.DBG_CROSSFIRE)
                 FBTrace.sysout("CROSSFIRE EventAdaptor onConsoleInfo");
             return { "context_id": this.contextId, "data": data };
          },

          /**
           * @name onConsoleWarn
           * @description Creates the body for an <code>onConsoleWarn</code> event.
           * <br><br>
           * The event body contains the following:
           * <ul>
           * <li><code>context_id</code> - the id of the current Crossfire context</li>
           * <li><code>data</code> - the event payload from Firebug</li>
           * </ul>
           * @function
           * @public
           * @memberOf FirebugEventAdaptor
           * @type Array
           * @return the Array of data items for the <code>onConsoleWarn</code> event.
           */
          "onConsoleWarn": function( data) {
             if (FBTrace.DBG_CROSSFIRE)
                 FBTrace.sysout("CROSSFIRE EventAdaptor onConsoleWarn");
             return { "context_id": this.contextId, "data": data };
          },

          /**
           * @name onConsoleError
           * @description Creates the body for an <code>onConsoleError</code> event.
           * <br><br>
           * The event body contains the following:
           * <ul>
           * <li><code>context_id</code> - the id of the current Crossfire context</li>
           * <li><code>data</code> - the event payload from Firebug</li>
           * </ul>
           * @function
           * @public
           * @memberOf FirebugEventAdaptor
           * @type Array
           * @return the Array of data items for the <code>onConsoleError</code> event.
           */
          "onConsoleError": function( data) {
             if (FBTrace.DBG_CROSSFIRE)
                 FBTrace.sysout("CROSSFIRE EventAdaptor onConsoleError");
             return { "context_id": this.contextId, "data": data };
          },

          /**
           * @name onScript
           * @description Creates the body for an <code>onScript</code> event.
           * <br><br>
           * The event body contains the following:
           * <ul>
           * <li><code>context_id</code> - the id of the current Crossfire context</li>
           * <li><code>data</code> - the event payload from Firebug</li>
           * </ul>
           * @function
           * @public
           * @memberOf FirebugEventAdaptor
           * @type Array
           * @return the Array of data items for the <code>onScript</code> event.
           */
          "onScript": function( data) {
              if (FBTrace.DBG_CROSSFIRE)
                  FBTrace.sysout("CROSSFIRE EventAdaptor onScript");
              return {"context_id": this.contextId, "data": data };
          },

          /**
           * @name onBreak
           * @description Creates the body for an <code>onBreak</code> event.
           * <br><br>
           * The event body contains the following:
           * <ul>
           * <li><code>context_id</code> - the id of the current Crossfire context</li>
           * <li><code>data</code> - the event payload from Firebug with the <code>url</code> and <code>line</code> values set</li>
           * </ul>
           * @function
           * @public
           * @memberOf FirebugEventAdaptor
           * @type Array
           * @return the Array of data items for the <code>onBreak</code> event.
           */
          "onBreak": function() {
        	  if (FBTrace.DBG_CROSSFIRE)
                 FBTrace.sysout("CROSSFIRE EventAdaptor onBreak");
        	  var url, line;
	          if ((typeof arguments[0]) == "number") {
	              line = arguments[0];
	              url = arguments[1];
	          } else if ((typeof arguments[1]) == "number") {
	              line = arguments[1];
	              url = arguments[0];
	          }
	          return { "context_id": this.contextId, "data": { "url" : url, "line": line } };
	      },

          /**
           * @name onResume
           * @description Creates the body for an <code>onResume</code> event.
           * <br><br>
           * The event body contains the following:
           * <ul>
           * <li><code>context_id</code> - the id of the current Crossfire context</li>
           * </ul>
           * @function
           * @public
           * @memberOf FirebugEventAdaptor
           * @type Array
           * @return the Array of data items for the <code>onResume</code> event.
           */
          "onResume": function() {
              if (FBTrace.DBG_CROSSFIRE)
                   FBTrace.sysout("CROSSFIRE EventAdaptor onResume");
              return { "context_id": this.contextId };
          },

          /**
           * @name onToggleBreakpoint
           * @description Creates the body for an <code>onToggleBreakpoint</code> event.
           * <br><br>
           * The event body contains the following:
           * <ul>
           * <li><code>context_id</code> - the id of the current Crossfire context</li>
           * <li><code>data</code> - the event payload from Firebug</li>
           * </ul>
           * @function
           * @public
           * @memberOf FirebugEventAdaptor
           * @type Array
           * @return the Array of data items for the <code>onToggleBreakpoint</code> event.
           */
          "onToggleBreakpoint": function(data) {
              if (FBTrace.DBG_CROSSFIRE)
                   FBTrace.sysout("CROSSFIRE EventAdaptor onToggleBreakpoint");
              return { "context_id": this.contextId, "data": data};
          },

          /**
           * @name onInspectNode
           * @description Creates the body for an <code>onInspectNode</code> event.
           * <br><br>
           * The event body contains the following:
           * <ul>
           * <li><code>context_id</code> - the id of the current Crossfire context</li>
           * <li><code>data</code> - the event payload from Firebug with the <code>node</code> value set</li>
           * </ul>
           * @function
           * @public
           * @memberOf FirebugEventAdaptor
           * @type Array
           * @return the Array of data items for the <code>onInspectNode</code> event.
           */
          "onInspectNode": function( node) {
              if (FBTrace.DBG_CROSSFIRE)
                   FBTrace.sysout("CROSSFIRE EventAdaptor onInspectNode: ", node);

              if (typeof FireDiff != 'undefined') { //FIXME: remove dependency on FireDiff
                  var nodePath = FireDiff.Path.getElementPath(node, true);
              }

              return { "context_id": this.contextId, "data": { "node": nodePath } };
          }
	 };
	 Crossfire.FirebugEventAdaptor = FirebugEventAdaptor;
// end FBL.ns
}});