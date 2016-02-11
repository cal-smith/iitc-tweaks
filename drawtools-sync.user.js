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
var setup = function() {
	// object to hold synced data
	// the sync plugin will automagically grab this and populate it as data comes in
	window.plugin.drawtools_sync.layers = {};
	window.plugin.drawtools_sync.sync_timeout = null;
	window.plugin.drawtools_sync.sync = window.plugin.sync;
	window.plugin.drawtools_sync.drawTools = window.plugin.drawTools;
	window.plugin.drawtools_sync.syncloaded = false;
	// init after iitc has loaded
	window.addHook('iitcLoaded', function() {
		console.log(window.plugin.drawtools_sync);
		window.plugin.drawtools_sync.sync.registerMapForSync('drawtools_sync', 
			'layers', 
			window.plugin.drawtools_sync.updated, 
			window.plugin.drawtools_sync.initalized);
		// hook into drawtools updates
		addHook('pluginDrawTools', window.plugin.drawtools_sync.delayed_sync);
	});

	window.plugin.drawtools_sync.render = function() {
		console.log('rendering');
		var data = window.plugin.drawtools_sync.layers.drawn;
		if (!data) return;
		// re-render drawn items
		//this.drawTools.drawnItems.clearLayers();
		//this.drawTools.import(JSON.parse(data));
		//this.drawTools.save();
		localStorage['plugin-draw-tools-layer'] = data;
		window.plugin.drawtools_sync.drawTools.load();
	}

	window.plugin.drawtools_sync.updated = function(plugin, field, ev, fullupdate) {
		console.log('updated', plugin, field, ev, fullupdate, window.plugin.drawtools_sync.layers);
		if (field === 'layers') {
			// render if its a full update, or if its a remote update
			if (fullupdate) window.plugin.drawtools_sync.render();
			if (!ev.islocal) window.plugin.drawtools_sync.render();
		}
	};

	window.plugin.drawtools_sync.initalized = function(plugin, field) {
		console.log('init', plugin, field, window.plugin.drawtools_sync.layers);
		if (field === 'layers') {
			window.plugin.drawtools_sync.syncloaded = true;
			window.plugin.drawtools_sync.delayed_sync();
		}
	};

	window.plugin.drawtools_sync.sync_now = function() {
		if(!window.plugin.drawtools_sync.syncloaded) return;
		if(!localStorage['plugin-draw-tools-layer']||JSON.parse(localStorage['plugin-draw-tools-layer']).length === 0) return;
		console.log('drawtools syncing');
		window.plugin.drawtools_sync.layers.drawn = JSON.parse(localStorage['plugin-draw-tools-layer']);
		window.plugin.drawtools_sync.sync.updateMap('drawtools_sync', 'layers', ['drawn']);
	};

	window.plugin.drawtools_sync.delayed_sync = function(ev) {
		if(!window.plugin.drawtools_sync.syncloaded) return;
		if (ev.event === 'import') return;
		console.log('drawtools delayed syncing', ev);
		clearTimeout(window.plugin.drawtools_sync.sync_timeout);
		window.plugin.drawtools_sync.sync_timeout = setTimeout(function() {
			console.log("sync");
			window.plugin.drawtools_sync.sync_timeout = null;
			window.plugin.drawtools_sync.sync_now();
			// wait for 7s so we can try and sync a few things at once
		}, 7000);
	}
}};
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
