// ==UserScript==
// @id             iitc-plugin-drawtools-sync@hansolo669
// @name           IITC plugin: drawtools sync
// @category       Tweaks
// @version        0.1.1
// @namespace      https://github.com/hansolo669/iitc-tweaks
// @updateURL      https://iitc.reallyawesomedomain.com/drawtools-sync.meta.js
// @downloadURL    https://iitc.reallyawesomedomain.com/drawtools-sync.user.js
// @description    Uses the 'sync' plugin to sync drawtools data via the google realtime API.
// @include        https://*.ingress.com/intel*
// @include        http://*.ingress.com/intel*
// @match          https://*.ingress.com/intel*
// @match          http://*.ingress.com/intel*
// @include        https://*.ingress.com/mission/*
// @include        http://*.ingress.com/mission/*
// @match          https://*.ingress.com/mission/*
// @match          http://*.ingress.com/mission/*
// @grant          none
// ==/UserScript==

function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded
if(typeof window.plugin !== 'function') window.plugin = function() {};

// PLUGIN START ////////////////////////////////////////////////////////
window.plugin.drawtools_sync = function() {};
// object to hold synced data
// the sync plugin will automagically grab this and populate it as data comes in
window.plugin.drawtools_sync.layers = {};
window.plugin.drawtools_sync.sync_timeout = null;
window.plugin.drawtools_sync.sync = window.plugin.sync;
window.plugin.drawtools_sync.drawTools = window.plugin.drawTools;
window.plugin.drawtools_sync.syncloaded = false;

window.plugin.drawtools_sync.register_with_sync = function() {
	window.plugin.sync.registerMapForSync('drawtools_sync', 'layers', window.plugin.drawtools_sync.updated, window.plugin.drawtools_sync.initialized);
};

// copied from drawtools, lets us load sync'd data *and* import drawn items without triggering needless syncs...because it doesnt run hooks
window.plugin.drawtools_sync.import_without_hooks = function(data) {
  $.each(data, function(index,item) {
    var layer = null;
    var extraOpt = {};
    if (item.color) extraOpt.color = item.color;

    switch(item.type) {
      case 'polyline':
        layer = L.geodesicPolyline(item.latLngs, L.extend({},window.plugin.drawTools.lineOptions,extraOpt));
        break;
      case 'polygon':
        layer = L.geodesicPolygon(item.latLngs, L.extend({},window.plugin.drawTools.polygonOptions,extraOpt));
        break;
      case 'circle':
        layer = L.geodesicCircle(item.latLng, item.radius, L.extend({},window.plugin.drawTools.polygonOptions,extraOpt));
        break;
      case 'marker':
        var extraMarkerOpt = {};
        if (item.color) extraMarkerOpt.icon = window.plugin.drawTools.getMarkerIcon(item.color);
        layer = L.marker(item.latLng, L.extend({},window.plugin.drawTools.markerOptions,extraMarkerOpt));
        window.registerMarkerForOMS(layer);
        break;
      default:
        console.warn('unknown layer type "'+item.type+'" when loading draw tools layer');
        break;
    }

    if (layer) {
      window.plugin.drawTools.drawnItems.addLayer(layer);
    }
  });
  // check all links in crosslinks and donelinks manually
  if (window.plugin.crossLinks) window.plugin.crossLinks.checkAllLinks();
  if (window.plugin.doneLinks) window.plugin.doneLinks.checkAllLinks();
}

window.plugin.drawtools_sync.render = function() {
	console.log('rendering');
	var data = window.plugin.drawtools_sync.layers.drawn;
	if (!data) return;
	// re-render drawn items
	window.plugin.drawTools.drawnItems.clearLayers();
	window.plugin.drawtools_sync.import_without_hooks(JSON.parse(data));
	window.plugin.drawTools.save();
};

window.plugin.drawtools_sync.updated = function(plugin, field, ev, fullupdate) {
	if(!window.plugin.drawtools_sync.syncloaded) return;
	console.log('updated', plugin, field, ev, fullupdate, window.plugin.drawtools_sync.layers);
	if (field === 'layers') {
		// render if its a full update, or if its a remote update
		if (!ev) return;
		window.plugin.drawtools_sync.render();
	}
};

window.plugin.drawtools_sync.initialized = function(plugin, field) {
	console.log('init', plugin, field, window.plugin.drawtools_sync.layers);
	if (field === 'layers') {
		window.plugin.drawtools_sync.syncloaded = true;
		addHook('pluginDrawTools', window.plugin.drawtools_sync.delayed_sync);
		// re-render the drawn items after load to ensure consistency and pick up any changes
		window.plugin.drawtools_sync.render();
	}
};

window.plugin.drawtools_sync.sync_now = function() {
	if(!window.plugin.drawtools_sync.syncloaded) return;
	if(!localStorage['plugin-draw-tools-layer']) return;
	console.log('drawtools syncing');
	window.plugin.drawtools_sync.layers.drawn = localStorage['plugin-draw-tools-layer'];
	window.plugin.sync.updateMap('drawtools_sync', 'layers', ['drawn']);
};

window.plugin.drawtools_sync.delayed_sync = function(ev) {
	if(!window.plugin.drawtools_sync.syncloaded) return;
	console.log('drawtools delayed syncing', ev);
	if(ev.event === 'clear') localStorage['plugin-draw-tools-layer'] = '[]';
	clearTimeout(window.plugin.drawtools_sync.sync_timeout);
	window.plugin.drawtools_sync.sync_timeout = setTimeout(function() {
		console.log("sync");
		window.plugin.drawtools_sync.sync_timeout = null;
		window.plugin.drawtools_sync.sync_now();
		// wait for 7s so we can try and sync a few things at once
	}, 7000);
};

var setup = function() {
	if (!window.plugin.drawTools || !window.plugin.sync) {
		alert('drawtools sync requires drawtools and the sync plugin');
		return;
	}
	// create the drawtools hook just incase we load before drawtools
	window.pluginCreateHook('pluginDrawTools');
	window.addHook('iitcLoaded', window.plugin.drawtools_sync.register_with_sync);
};
// PLUGIN END //////////////////////////////////////////////////////////
setup.info = plugin_info; //add the script info data to the function as a property
if(!window.bootPlugins) window.bootPlugins = [];
window.bootPlugins.push(setup);
// if IITC has already booted, immediately run the 'setup' function
if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { 
	version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);
