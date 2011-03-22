/** 
 * Parallax 0.2.01
 * 
 * Includes jquery.schedule.js by Ralf S. Engelschall <rse@engelschall.com>
 * 
 * http://www.dom111.co.uk/blog/coding/jquery-parallax-0-2-minor-updates/125
 * 
 * Add a simple parallax effect to a page
 * 
 * Requires jQuery. Tested with v1.5.1.
 * 
 * options: object, Contains all the options required to run the parallax effect:
 * options.useHTML: boolean, If set to true the script will use the HTML element
 *   instead of the container to capture mousemove events
 * options.elements: array, An array of objects of the following structure:
 *   {
 *     'selector': 'div.test',
 *     'properties': {
 *       'x': {
 *         'left': {
 *           'initial': 0,
 *           'multiplier': 0.1,
 *           'invert': true,
 *           'unit': 'px',
 *           'min': -160,
 *           'max': 160
 *         }
 *       },
 *       'y': {
 *          'top': {
 *           'initial': 0,
 *           'multiplier': 0.1,
 *           'invert': false,
 *           'unit': 'px',
 *           'min': 90,
 *           'max': 110
 *          }
 *       }
 *     }
 *   }
 * 
 * options.elements[n].selector: string, The jQuery selector for the element
 * options.elements[n].properties: object, Contains 'x' and 'y' keys for the properties
 *   that are affected by either horizontal, or vertical movement respectively
 * options.elements[n].properties[x || y]: object, Contains keys relating to the CSS
 *   property to be changed on movement
 * options.elements[n].properties[x || y][cssProperty]: object, Must contain at least
 *   two keys 'initial' and 'multiplier'.
 *   'initial' is the starting point for the property and 'multiplier' is used to create
 *   the parallax effect. For example to have the element property move exactly with the
 *   mouse cursor you'd use 1, lower values move less...
 *   'min' and 'max' should be fairly self explanetory, the value will be prevented from
 *   deviating beyond these boundaries (both are optional)
 *   'unit' is also optional unit of measurement (the default is 'px')
 *   'invert' is also an optional boolean, if true, the number will be negated
 * 
 * Free to use anywhere for anything, but I'd love to see what anyone does with it...
 * 
 * dom111.co.uk
 * 
 * Changelog:
 * 
 * 0.2.01
 * 	Added autoMove Property
 * 
 * 0.2
 *   Added an optional unit and invert paramter to each item
 *   Turned the function into a jQuery plugin
 * 
 * 0.1
 *   Initial release
 */
(function($) {
	
  /** ------------------------------------------------------ **/
  /**
	* jquery.schedule.js -- jQuery plugin for scheduled/deferred actions *
	* Copyright (c) 2007 Ralf S. Engelschall <rse@engelschall.com> 
	* Licensed under GPL <http://www.gnu.org/licenses/gpl.txt>
	* 
	* Original Version:
	* http://trainofthoughts.org/repo/fileview?f=jquery/jquery.schedule.js&v=20
	*/
  /** ------------------------------------------------------ **/
  
  
  /*  object constructor  */
  $.scheduler = function () {
      this.bucket = {};
      return;
  };

  /*  object methods  */
  $.scheduler.prototype = {
      /*  schedule a task  */
      schedule: function () {
          /*  schedule context with default parameters */
          var ctx = {
              "id":         null,         /* unique identifier of high-level schedule */
              "time":       1000,         /* time in milliseconds after which the task is run */
              "repeat":     false,        /* whether schedule should be automatically repeated */
              "protect":    false,        /* whether schedule should be protected from double scheduling */
              "obj":        null,         /* function context object ("this") */
              "func":       function(){}, /* function to call */
              "args":       []            /* function arguments to pass */
          };

          /*  helper function: portable checking whether something is a function  */
          function _isfn (fn) {
              return (
                     !!fn
                  && typeof fn != "string"
                  && typeof fn[0] == "undefined"
                  && RegExp("function", "i").test(fn + "")
              );
          };
          
          /*  parse arguments into context parameters (part 1/4):
              detect an override object (special case to support jQuery method) */
          var i = 0;
          var override = false;
          if (typeof arguments[i] == "object" && arguments.length > 1) {
              override = true;
              i++;
          }

          /*  parse arguments into context parameters (part 2/4):
              support the flexible way of an associated array */
          if (typeof arguments[i] == "object") {
              for (var option in arguments[i])
                  if (typeof ctx[option] != "undefined")
                      ctx[option] = arguments[i][option];
              i++;
          }

          /*  parse arguments into context parameters (part 3/4):
              support: schedule([time [, repeat], ]{{obj, methodname} | func}[, arg, ...]); */
          if (   typeof arguments[i] == "number"
              || (   typeof arguments[i] == "string" 
                  && arguments[i].match(RegExp("^[0-9]+[smhdw]$"))))
              ctx["time"] = arguments[i++];
          if (typeof arguments[i] == "boolean")
              ctx["repeat"] = arguments[i++];
          if (typeof arguments[i] == "boolean")
              ctx["protect"] = arguments[i++];
          if (   typeof arguments[i] == "object"
              && typeof arguments[i+1] == "string"
              && _isfn(arguments[i][arguments[i+1]])) {
              ctx["obj"] = arguments[i++];
              ctx["func"] = arguments[i++];
          }
          else if (   typeof arguments[i] != "undefined"
                   && (   _isfn(arguments[i]) 
                       || typeof arguments[i] == "string"))
              ctx["func"] = arguments[i++];
          while (typeof arguments[i] != "undefined")
              ctx["args"].push(arguments[i++]);

          /*  parse arguments into context parameters (part 4/4):
              apply parameters from override object */
          if (override) {
              if (typeof arguments[1] == "object") {
                  for (var option in arguments[0])
                      if (   typeof ctx[option] != "undefined"
                          && typeof arguments[1][option] == "undefined")
                          ctx[option] = arguments[0][option];
              }
              else {
                  for (var option in arguments[0])
                      if (typeof ctx[option] != "undefined")
                          ctx[option] = arguments[0][option];
              }
              i++;
          }

          /*  annotate context with internals */
          ctx["_scheduler"] = this; /* internal: back-reference to scheduler object */
          ctx["_handle"]    = null; /* internal: unique handle of low-level task */

          /*  determine time value in milliseconds */
          var match = String(ctx["time"]).match(RegExp("^([0-9]+)([smhdw])$"));
          if (match && match[0] != "undefined" && match[1] != "undefined")
              ctx["time"] = String(parseInt(match[1]) *
                  { s: 1000, m: 1000*60, h: 1000*60*60,
                    d: 1000*60*60*24, w: 1000*60*60*24*7 }[match[2]]);

          /*  determine unique identifier of task  */
          if (ctx["id"] == null)
              ctx["id"] = (  String(ctx["repeat"])  + ":"
                           + String(ctx["protect"]) + ":"
                           + String(ctx["time"])    + ":"
                           + String(ctx["obj"])     + ":"
                           + String(ctx["func"])    + ":"
                           + String(ctx["args"])         );

          /*  optionally protect from duplicate calls  */
          if (ctx["protect"])
              if (typeof this.bucket[ctx["id"]] != "undefined")
                  return this.bucket[ctx["id"]];

          /*  support execution of methods by name and arbitrary scripts  */
          if (!_isfn(ctx["func"])) {
              if (   ctx["obj"] != null
                  && typeof ctx["obj"] == "object"
                  && typeof ctx["func"] == "string"
                  && _isfn(ctx["obj"][ctx["func"]]))
                  /*  method by name  */
                  ctx["func"] = ctx["obj"][ctx["func"]];
              else
                  /*  arbitrary script  */
                  ctx["func"] = eval("function () { " + ctx["func"] + " }");
          }

          /*  pass-through to internal scheduling operation  */
          ctx["_handle"] = this._schedule(ctx);

          /*  store context into bucket of scheduler object  */
          this.bucket[ctx["id"]] = ctx;

          /*  return context  */
          return ctx;
      },

      /*  re-schedule a task  */
      reschedule: function (ctx) {
          if (typeof ctx == "string")
              ctx = this.bucket[ctx];

          /*  pass-through to internal scheduling operation  */
          ctx["_handle"] = this._schedule(ctx);

          /*  return context  */
          return ctx;
      },

      /*  internal scheduling operation  */
      _schedule: function (ctx) {
          /*  closure to act as the call trampoline function  */
          var trampoline = function () {
              /*  jump into function  */
              var obj = (ctx["obj"] != null ? ctx["obj"] : ctx);
              (ctx["func"]).apply(obj, ctx["args"]);

              /*  either repeat scheduling and keep in bucket or
                  just stop scheduling and delete from scheduler bucket  */
              if (   /* not cancelled from inside... */
                     typeof (ctx["_scheduler"]).bucket[ctx["id"]] != "undefined"
                  && /* ...and repeating requested */
                     ctx["repeat"])
                  (ctx["_scheduler"])._schedule(ctx);
              else
                  delete (ctx["_scheduler"]).bucket[ctx["id"]];
          };

          /*  schedule task and return handle  */
          return setTimeout(trampoline, ctx["time"]);
      },

      /*  cancel a scheduled task  */
      cancel: function (ctx) {
          if (typeof ctx == "string")
              ctx = this.bucket[ctx];

          /*  cancel scheduled task  */
          if (typeof ctx == "object") {
              clearTimeout(ctx["_handle"]);
              delete this.bucket[ctx["id"]];
          }
      }
  };

  /* integrate a global instance of the scheduler into the global jQuery object */
  $.extend({
      scheduler$: new $.scheduler(),
      schedule:   function () { return $.scheduler$.schedule.apply  ($.scheduler$, arguments) },
      reschedule: function () { return $.scheduler$.reschedule.apply($.scheduler$, arguments) },
      cancel:     function () { return $.scheduler$.cancel.apply    ($.scheduler$, arguments) }
  });

  /* integrate scheduling convinience method into all jQuery objects */
  $.fn.extend({
      schedule: function () {
          var a = [ {} ];
          for (var i = 0; i < arguments.length; i++)
              a.push(arguments[i]);
          return this.each(function () {
              a[0] = { "id": this, "obj": this };
              return $.schedule.apply($, a);
          });
      }
  });

  /** ------------------------------------------------------ **/
  /** Parallax Plugin */
  /** ------------------------------------------------------ **/	
	
  $.fn.parallax = function(options) {
    // options
    var options = $.extend({
      // useHTML: use the whole document as a listener
      'useHTML': true,
      // elements: the elements to manipulate
      'elements': [],
      // autoMotion : Auto Move Parallax Effect
      'autoMove' : false
    }, options || {});

    var mouseMoveHandler = function(e) {
        
    	// set up the element as a variable
        var el = $(this);
        
    	// the the cursor's position
        var pos = {
          'x': (e.pageX - el.offset().left),
          'y': (e.pageY - el.offset().top)
        };
        
        animFunction(pos);
        
    };
    
    var animFunction = function (pos) {
    
        // set up the element as a variable
        var el = $(this);
        
        // calculate the center
        var center = {
          'x': Math.floor(parseInt(el.width()) / 2),
          'y': Math.floor(parseInt(el.height()) / 2)
        }
        
        // calculate the offset
        var offset = {
          'x': (pos.x - center.x),
          'y': (pos.y - center.y)
        }

        // loop through all the elements
        for (var i = options.elements.length - 1; i >= 0; i--) {
          // set up a container for the properties
          var opts = {}, value, p;

          // loop through all the properties specified
          for (var property in options.elements[i].properties.x) {
            // store the objet in a nicer variable
            p = options.elements[i].properties.x[property];

            // set the value
            value = p.initial + (offset.x * p.multiplier);

            // check that the value's within the bounds
            if ('min' in p && value < p.min) {
              value = p.min;

            } else if ('max' in p && value > p.max) {
              value = p.max;
            }

            // invert the value if required
            if ('invert' in p && p.invert) {
              value = -(value);
            }

            // check if a unit has been specified
            if (!('unit' in p)) {
              p.unit = 'px';
            }

            // append it
            opts[property] = value + p.unit;
          }

          for (var property in options.elements[i].properties.y) {
            p = options.elements[i].properties.y[property];
            
            value = p.initial + (offset.y * p.multiplier);
            
            if ('min' in p && value < p.min) {
              value = p.min;
              
            } else if ('max' in p && value > p.max) {
              value = p.max;
            }
            
            if ('invert' in p && p.invert) {
              value = -(value);
            }

            if (!('unit' in p)) {
              p.unit = 'px';
            }

            opts[property] = value + p.unit;
          }

          // fix for firefox
          if ($.browser.mozilla) {
	          if ('background-position-x' in opts || 'background-position-y' in opts) {
	            opts['background-position'] = '' + (('background-position-x' in opts) ? opts['background-position-x'] : '0px') + ' ' + (('background-position-y' in opts) ? opts['background-position-y'] : '0px');
	
	            delete opts['background-position-x'];
	            delete opts['background-position-y'];
	          }
          }

          // here's the magic! simples!
          $(options.elements[i].selector).css(opts);
        };
    }
    
    var el = $(this);

    if(options.autoMove && (typeof(el.schedule) != 'undefined') ) {

    	var dynamicPosition = {
    		'x' : 0,
    		'y' : 0,
    		'direction' : 1,
    		'upperLimit' : 10000
    	};

    	el.schedule(
			{
                time: 10,
                func: function (posSch) {
					if(posSch.x>posSch.upperLimit){
						posSch.direction = -1;
					} else if(posSch.x<0) {
						posSch.direction = 1;
					}
					posSch.x = posSch.x+posSch.direction;
			    	animFunction(posSch);
				},
				repeat: true,
				args: [dynamicPosition]
            }
    	);
    	
    } else {
    	// attach the mousemove event to the specified element
    	$((options.useHTML) ? 'html' : this).bind('mousemove',mouseMoveHandler);
    }

  }

})(jQuery);
