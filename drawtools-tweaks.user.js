// ==UserScript==
// @id             iitc-plugin-drawtools-tweaks@hansolo669
// @name           IITC plugin: drawtools tweaks
// @category       Tweaks
// @version        0.0.1
// @namespace      https://github.com/hansolo669/iitc-tweaks
// @updateURL      https://iitc.reallyawesomedomain.com/drawtools-tweaks.user.js
// @downloadURL    https://iitc.reallyawesomedomain.com/drawtools-tweaks.user.js
// @description    Bolt on functionality for stock drawtools
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

window.plugin.drawToolsTweaks = {};

window.plugin.drawToolsTweaks.openPicker = function() {
	dialog({
		html: '<input type="color" name="drawColor" id="drawtools-color-picker"></input>',
		id: 'plugin-drawtools-color',
		title: 'Draw Tools Color Picker'
	});
	$('#drawtools-color-picker').spectrum({
		flat: false,
		showInput: false,
		showButtons: false,
		showPalette: true,
		showSelectionPalette: false,
		palette: [ 
			['#a24ac3','#514ac3','#4aa8c3','#51c34a'],
			['#c1c34a','#c38a4a','#c34a4a','#c34a6f'],
			['#000000','#666666','#bbbbbb','#ffffff']
		],
		change: function(color) { 
			window.plugin.drawTools.setDrawColor(color.toHexString()); 
			document.querySelector("#drawtools-color-picker-button").style.background = window.plugin.drawTools.currentColor;
		},
		color: window.plugin.drawTools.currentColor
	});
}

function attachControls() {
	var container = document.querySelector(".leaflet-top.leaflet-left");
	var buttonContainer = document.createElement("div");
	buttonContainer.classList.add("leaflet-bar");
	buttonContainer.classList.add("leaflet-control");
	var button = document.createElement("a");
	button.classList.add("leaflet-bar-part");
	button.id = "drawtools-color-picker-button"
	button.textContent = " ";
	button.style.background = window.plugin.drawTools.currentColor;
	button.addEventListener("click", function(ev) {
		ev.preventDefault();
		if (isSmartphone()) {
			ev.stopPropagation();
			window.plugin.drawToolsTweaks.openPicker();
		}
	});
	buttonContainer.appendChild(button);	
	container.appendChild(buttonContainer);
	if (!isSmartphone()) {
		$('#drawtools-color-picker-button').spectrum({
			flat: false,
			showInput: false,
			showButtons: false,
			showPalette: true,
			showSelectionPalette: false,
			palette: [ 
				['#a24ac3','#514ac3','#4aa8c3','#51c34a'],
				['#c1c34a','#c38a4a','#c34a4a','#c34a6f'],
				['#000000','#666666','#bbbbbb','#ffffff']
			],
			change: function(color) { 
				window.plugin.drawTools.setDrawColor(color.toHexString()); 
				document.querySelector("#drawtools-color-picker-button").style.background = window.plugin.drawTools.currentColor;
			},
			color: window.plugin.drawTools.currentColor
		});
	}
}

var setup = function() {
	attachControls();
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