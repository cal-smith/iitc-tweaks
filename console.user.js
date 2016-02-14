// ==UserScript==
// @id             iitc-plugin-console@hansolo669
// @name           IITC plugin: console
// @category       Debug
// @version        0.1.0
// @namespace      https://github.com/hansolo669/iitc-tweaks
// @updateURL      http://www.reallyawesomedomain.com/iitc-tweaks/console.meta.js
// @downloadURL    http://www.reallyawesomedomain.com/iitc-tweaks/console.user.js
// @description    Utility to pipe the standard console back into IITC and easily eval snippets
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
window.plugin.console = {};
window.plugin.console.history = [];
window.plugin.console.commands = [];
window.plugin.console.commandsidx = 0;

var setup = function() {
    //add options menu
    $('#toolbox').append('<a onclick="window.plugin.console.open();return false;" title="console">console</a>');
    var oldConsole = console;
    window.console = {
        _log: function(args) {
            var history = window.plugin.console.history;
            history.push(Array.prototype.slice.call(args).map(function(x) {
                if (typeof x === 'object') {
                    var seen = [];
                    return JSON.stringify(x, function(key, val) {
                        if (val != null && typeof val == 'object') {
                            if (seen.indexOf(val) >= 0 || seen.length > 10) return;
                            seen.push(val);
                        }
                        return val;
                    }, ' ');
                }
                return x;
            }).join(" ") + '\n');
            var out = document.querySelector('#out');
            if (out) {
                out.textContent += history[history.length-1];
                var scroll = out.scrollHeight - out.offsetHeight;
                var scrolltop = out.scrollTop;
                if (!(scrolltop < scroll - 100 && scroll > 100)) {
                    out.scrollTop = out.scrollHeight;
                }
            }
        },
        log: function() {
            this._log(arguments);
            oldConsole.log.apply(oldConsole, arguments);
        },
        info: function() {
            this._log(arguments);
            oldConsole.info.apply(oldConsole, arguments);
        },
        error: function() {
            this._log(arguments);
            oldConsole.error.apply(oldConsole, arguments);
        },
        warn: function() {
            this._log(arguments);
            oldConsole.warn.apply(oldConsole, arguments);
        },
        debug: function () { this.log.apply(this, arguments); },
        exception: function() { this.error.apply(this, arguments); }
    };

    window.plugin.console.eval = function(ev) {
        //console.log(ev);
        if(ev.code === 'Enter') {
            console.log(' -> ' + ev.target.value);
            var res = '';
            try { res = eval(ev.target.value) } catch(e) { res = e; }
            console.log(' <- ' + res);
            plugin.console.commands.push(ev.target.value);
            ev.target.value = ""
            plugin.console.commandsidx = 0;
        } else if(ev.code === 'ArrowUp') {
            var commands = plugin.console.commands;
            if(commands.length > 0) {
                if (plugin.console.commandsidx < commands.length) plugin.console.commandsidx++;
                ev.target.value = commands[commands.length-plugin.console.commandsidx];
            }
        } else if(ev.code === 'ArrowDown') {
            var commands = plugin.console.commands;
            if (plugin.console.commandsidx == 1) {
                ev.target.value = '';
                plugin.console.commandsidx = 0;
            } else if (commands.length > 0) {
                if (plugin.console.commandsidx > 1) plugin.console.commandsidx--;
                ev.target.value = commands[commands.length-plugin.console.commandsidx];
            }
        }
    };

    window.plugin.console.open = function() {
        var window = dialog({
            title:'console',
            html:
            '<pre id="out" style="height:500px;width:100%;overflow:auto;"></pre>'
            +'<input type="text" placeholder="command" onkeyup="window.plugin.console.eval(event)" style="width:100%;"/>',
            width:700,
            minHeight:500
        });
        document.querySelector('#out').textContent = plugin.console.history.reduce(function(x, y) { return x += y; });
        var out = document.querySelector('#out');
        out.scrollTop = out.scrollHeight - out.offsetHeight;
    };
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