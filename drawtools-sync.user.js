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
var DTSync = function(){
	// object to hold synced data
	// the sync plugin will automagically grab this and populate it as data comes in
	this.layers = {};
	this.sync_timeout = null;
	this.sync = window.plugin.sync;
	this.drawTools = window.plugin.drawTools;
	this.syncloaded = false;
	// init after iitc has loaded
	window.addHook('iitcLoaded', function() {
		console.log(this);
		this.sync.registerMapForSync('drawtools_sync', 'layers', this.updated.bind(this), this.initalized.bind(this));
		// hook into drawtools updates
		addHook('pluginDrawTools', this.delayed_sync.bind(this));
	}.bind(this));
};

DTSync.prototype.render = function() {
	console.log('rendering');
	var data = this.layers.drawn;
	if (!data) return;
	// re-render drawn items
	//this.drawTools.drawnItems.clearLayers();
	//this.drawTools.import(JSON.parse(data));
	//this.drawTools.save();
	localStorage['plugin-draw-tools-layer'] = data;
	this.drawTools.load();
}

DTSync.prototype.updated = function(plugin, field, ev, fullupdate) {
	console.log('updated', plugin, field, ev, fullupdate, this.layers);
	if (field === 'layers') {
		// render if its a full update, or if its a remote update
		if (fullupdate) this.render();
		if (!ev.islocal) this.render();
	}
};

DTSync.prototype.initalized = function(plugin, field) {
	console.log('init', plugin, field, this.layers);
	if (field === 'layers') {
		this.syncloaded = true;
		this.delayed_sync();
	}
};

DTSync.prototype.sync_now = function() {
	if(!this.syncloaded) return;
	if(!localStorage['plugin-draw-tools-layer']||JSON.parse(localStorage['plugin-draw-tools-layer']).length === 0) return;
	console.log('drawtools syncing');
	this.layers.drawn = JSON.parse(localStorage['plugin-draw-tools-layer']);
	this.sync.updateMap('drawtools_sync', 'layers', ['drawn']);
};

DTSync.prototype.delayed_sync = function(ev) {
	if(!this.syncloaded) return;
	if (ev.event === 'import') return;
	console.log('drawtools delayed syncing', ev);
	clearTimeout(this.sync_timeout);
	this.sync_timeout = setTimeout(function() {
		console.log("sync");
		this.sync_timeout = null;
		this.sync_now();
		// wait for 7s so we can try and sync a few things at once
	}.bind(this), 7000);
}

var setup = function() {
	window.plugin.drawtools_sync = new DTSync();
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
