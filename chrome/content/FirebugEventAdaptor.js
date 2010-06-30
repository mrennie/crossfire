/* See license.txt for terms of usage */

if (!Crossfire) var Crossfire = {};

// FirebugEventAdaptor
FBL.ns(function() { with(FBL) {

    /**
     * @name FirebugEventAdaptor
     * @constructor FirebugEventAdaptor
     * @description handles events on a per-context basis
     * @description and returns event arguments formatted as JSON objects.
     */
     function FirebugEventAdaptor( context) {
         this.context = context;
         this.contextId = context.Crossfire.crossfire_id;
         if (FBTrace.DBG_CROSSFIRE)
                FBTrace.sysout("CROSSFIRE Creating new FirebugEventAdaptor for context: " + this.contextId);
     }

     FirebugEventAdaptor.prototype =
         /**
          *  @lends FirebugEventAdaptor
          */
         {
             /**
              * @name FirebugEventAdaptor.onContextCreated
              * @function
              * @return <code>context_id</code> of the created context.
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
                * @name FirebugEventAdaptor.onContextLoaded
                * @function
                * @return <code>context_id</code> of the loaded context.
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
               * @name FirebugEventAdaptor.onContextDestroyed
               * @function
               * @return <code>context_id</code> of the destroyed context.
               */
              "onContextDestroyed": function() {
                   if (FBTrace.DBG_CROSSFIRE)
                       FBTrace.sysout("CROSSFIRE EventAdaptor onContextDestroyed");
                   return { "context_id": this.contextId };
              },

             /**
              * @name FirebugEventAdaptor.onConsoleDebug
              * @function
              * @param data the data that was logged to the console with this console event.
              * @returns <code>context_id</code>, <code>data</code>
              */
            "onConsoleDebug": function( data) {
                 if (FBTrace.DBG_CROSSFIRE)
                     FBTrace.sysout("CROSSFIRE EventAdaptor onConsoleDebug");
                 return { "context_id": this.contextId, "data": data };
             },

             /**
              * @name FirebugEventAdaptor.onConsoleLog
              * @function
              * @param data the data that was logged to the console with this console event.
              * @returns <code>context_id</code>, <code>data</code> data associated with this console event.
              */
            "onConsoleLog": function( data) {
                 if (FBTrace.DBG_CROSSFIRE)
                     FBTrace.sysout("CROSSFIRE EventAdaptor onConsoleLog");
                 return { "context_id": this.contextId, "data": data };
             },

             /**
              * @name FirebugEventAdaptor.onConsoleInfo
              * @function
              * @param data the data that was logged to the console with this console event.
              * @returns <code>context_id</code>, <code>data</code> data associated with this console event.
              */
            "onConsoleInfo": function( data) {
                 if (FBTrace.DBG_CROSSFIRE)
                     FBTrace.sysout("CROSSFIRE EventAdaptor onConsoleInfo");
                 return { "context_id": this.contextId, "data": data };
             },

             /**
              * @name FirebugEventAdaptor.onConsoleWarn
              * @function
              * @param data the data that was logged to the console with this console event.
              * @returns <code>context_id</code>, <code>data</code> data associated with this console event.
              */
             "onConsoleWarn": function( data) {
                 if (FBTrace.DBG_CROSSFIRE)
                     FBTrace.sysout("CROSSFIRE EventAdaptor onConsoleWarn");
                 return { "context_id": this.contextId, "data": data };
             },

             /**
              * @name FirebugEventAdaptor.onConsoleError
              * @function
              * @param data the data that was logged to the console with this console event.
              * @returns <code>context_id</code>, <code>data</code> data associated with this console event.
              */
             "onConsoleError": function( data) {
                 if (FBTrace.DBG_CROSSFIRE)
                     FBTrace.sysout("CROSSFIRE EventAdaptor onConsoleError");
                 return { "context_id": this.contextId, "data": data };
             },

             /**
              * @name FirebugEventAdaptor.onScript
              * @function
              * @description Event that is generated when a new script is compiled
              * @param data
              * @returns <code>context_id</code>, <code>data</code> script that was created
              */
             "onScript": function( data) {
                  if (FBTrace.DBG_CROSSFIRE)
                      FBTrace.sysout("CROSSFIRE EventAdaptor onScript");
                  return {"context_id": this.contextId, "data": data };
             },


           /**
            * @name FirebugEventAdaptor.onBreak
            * @function
            * @description handles <code>onBreak</code> event.
            * @returns <code>url</code>, <code>line<code> and <code>context_id</code>
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
             * @name FirebugEventAdaptor.onResume
             * @function
             * @description handles <code>onResume</code> event.
             * @returns <code>context_id</code>
             */
            "onResume": function() {
                if (FBTrace.DBG_CROSSFIRE)
                     FBTrace.sysout("CROSSFIRE EventAdaptor onResume");
                return { "context_id": this.contextId };
            },

            /**
             * @name FirebugEventAdaptor.onToggleBreakpoint
             * @function
             * @description handles <code>onToggleBreakpoint</code> event.
             * @returns <code>context_id</code>
             */
            "onToggleBreakpoint": function() {
                if (FBTrace.DBG_CROSSFIRE)
                     FBTrace.sysout("CROSSFIRE EventAdaptor onToggleBreakpoint");
                return { "context_id": this.contextId };
            },

            /**
             * @name FirebugEventAdaptor.onInspectNode
             * @function
             * @param node the node that is being inspected.
             * @description handles <code>onInspectNode</code> event.
             * @description returns an xpath string that selects the inspected node.
             * @returns <code>context_id</code>, <code>node</code>
             */
            "onInspectNode": function( node) {
                if (FBTrace.DBG_CROSSFIRE)
                     FBTrace.sysout("CROSSFIRE EventAdaptor onInspectNode: ", node);

                if (FireDiff) { //FIXME: remove dependency on FireDiff
                    var nodePath = FireDiff.Path.getElementPath(node, true);
                }

                return { "context_id": this.contextId, "data": { "node": nodePath } };
            }
     };

     Crossfire.FirebugEventAdaptor = FirebugEventAdaptor;

// end FBL.ns
}});