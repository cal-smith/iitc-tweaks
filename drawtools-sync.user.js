// ==UserScript==
// @id             iitc-plugin-drawtools-sync@hansolo669
// @name           IITC plugin: drawtools sync
// @category       Tweaks
// @version        0.0.1
// @namespace      https://github.com/hansolo669/iitc-tweaks
// @updateURL      http://www.reallyawesomedomain.com/iitc-tweaks/drawtools-sync.meta.js
// @downloadURL    http://www.reallyawesomedomain.com/iitc-tweaks/drawtools-sync.user.js
// @description    Uses the 'sync' plugin to sync drawtools data via the google realtime API.
// @include        https://www.ingress.com/intel*
// @include        http://www.ingress.com/intel*
// @match          https://www.ingress.com/intel*
// @match          http://www.ingress.com/intel*
// @include        https://www.ingress.com/mission/*
// @include        http://www.ingress.com/mission/*
// @match          https://www.ingress.com/mission/*
// @match          http://www.ingress.com/mission/*
// @grant          none
// ==/UserScript==

function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded
if(typeof window.plugin !== 'function') window.plugin = function() {};

// PLUGIN START ////////////////////////////////////////////////////////
window.plugin.drawtools_sync = function(){};

window.plugin.drawtools_sync.layers = {};

window.plugin.drawtools_sync.render = function() {
	var data = window.plugin.drawtools_sync.layers.drawn;
	if (!data) return null;
	// re-render drawn items
	window.plugin.drawTools.drawnItems.clearLayers();
	window.plugin.drawTools.import(JSON.parse(data));
	window.plugin.drawTools.save();
}

window.plugin.drawtools_sync.updated = function(plugin, field, ev, fullupdate) {
	console.log('updated', plugin, field, ev, fullupdate);
	console.log(window.plugin.drawtools_sync.layers);
	if (field === 'layers') {
		// render if its a full update, or if its a remote update
		if (fullupdate) window.plugin.drawtools_sync.render();
		if (!ev.islocal) window.plugin.drawtools_sync.render();
	}
};

window.plugin.drawtools_sync.initalized = function(plugin, field) {
	console.log('init', plugin, field);
	console.log(window.plugin.drawtools_sync.layers);
	if (field === 'layers') {
		window.drawtools_sync.plugin.sync_now();
	}
};

window.plugin.drawtools_sync.sync_now = function() {
	console.log('drawtools syncing');
	setTimeout(function() {
		console.log("sync");
		window.plugin.drawtools_sync.layers.drawn = localStorage['plugin-draw-tools-layer'];
		plugin.sync.updateMap('drawtools_sync', 'layers', ['drawn']);
		// wait for 2s so we can try and sync a few things at once
	}, 2000);
};

var setup = function() {
	// init after iitc has loaded
	window.addHook('iitcLoaded', function() {
		window.plugin.sync.registerMapForSync('drawtools_sync', 'layers', window.plugin.drawtools_sync.updated, window.plugin.drawtools_sync.initalized);
		// hook into drawtools updates
		addHook('pluginDrawTools', window.plugin.drawtools_sync.sync_now);
	});
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
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);
