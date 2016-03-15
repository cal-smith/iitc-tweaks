// ==UserScript==
// @id             iitc-plugin-chat-tools@hansolo669
// @name           IITC plugin: chat tools
// @category       Tweaks
// @version        0.0.1
// @namespace      https://github.com/hansolo669/iitc-tweaks
// @updateURL      https://www.reallyawesomedomain.com/iitc-tweaks/chat-tools.meta.js
// @downloadURL    https://www.reallyawesomedomain.com/iitc-tweaks/chat-tools.user.js
// @description    Provides details for portals not in view, features configurable auto refresh.
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
// some useful tooling
if (!window.tools) {
  window.tools = {};
  window.tools.elem = document.querySelector.bind(document);
  window.tools.elems = document.querySelectorAll.bind(document);
  window.tools.on = function (e, type, callback) { return e.addEventListener(type, callback); }
  window.tools.to_array = function(array) {
    return Array.prototype.slice.apply(array);
  }

  window.tools.PersistantObject = function(name) {
    this._id = "persistant-"+name;
    if (!window.localStorage.getItem(this._id)) {
      window.localStorage.setItem(this._id, "{}");
      this._data = {};
    } else {
      this._data = JSON.parse(window.localStorage[this._id]);
    }
  };

  window.tools.PersistantObject.prototype.set = function(name, value) {
    this._data[name] = value;
    window.localStorage.setItem(this._id, JSON.stringify(this._data));
    return this;
  };

  window.tools.PersistantObject.prototype.get = function(name) {
    return this._data[name];
  };

  window.tools.PersistantObject.prototype.remove = function(name) {
    delete this._data[name];
    window.localStorage.setItem(this._id, JSON.stringify(this._data));
    return this;
  };

  window.tools.PersistantObject.prototype.exists = function(name) {
    return this._data[name]?true:false;
  };

  window.tools.PersistantObject.prototype.each = function(callback) {
    var keys = Object.keys(this._data);
    for (var i = 0; i < keys.length; i++) {
      callback(keys[i], this._data[keys[i]]);
    }
    return this;
  };

  tools.PersistantArray = function(name) {
    var data = [];
    var id = "persistant-"+name;
    if (!window.localStorage.getItem(id)) {
      window.localStorage.setItem(id, "[]");
      data = [];
    } else {
      data = JSON.parse(localStorage[id]);
    }
    data.__proto__ = tools.PersistantArray.prototype;
    data._id = id;
    return data;
  };
  tools.PersistantArray.prototype = new Array;

  tools.PersistantArray.prototype.push = function(value) {
    Array.prototype.push.call(this, value);
    window.localStorage.setItem(this._id, JSON.stringify(this));
    return this;
  };

  tools.PersistantArray.prototype.pop = function() {
    var v = Array.prototype.pop.call(this);
    window.localStorage.setItem(this._id, JSON.stringify(this));
    return v;
  };

  tools.PersistantArray.prototype.remove = function(index) {
    this.splice(index, 1);
    window.localStorage.setItem(this._id, JSON.stringify(this));
    return this;
  }

  tools.PersistantArray.prototype.each = function(callback) {
    for (var i = 0; i < this.length; i++) {
      callback(i, this[i]);
    }
    return this;
  };
}

window.plugin.chat_tools = {};
window.plugin.chat_tools.filters = new tools.PersistantArray('chat-tools-filters');
window.plugin.chat_tools.highlighters = new tools.PersistantArray('chat-tools-highlighters');
window.plugin.chat_tools.highlight_color = "#505050";
window.plugin.chat_tools.hide_all = false;
// filter {matcher: 'string', tab: {'all':true, 'faction':true, 'alerts':true}, type: 'includes|excludes'}
// highlighter {matcher: 'string', tab: {'all':true, 'faction':true, 'alerts':true}, color: '#505050'}
window.plugin.chat_tools.open = function() {
  var dlg = dialog({
    title: 'chat tools',
    dialogClass: 'chat-tools',
    html: '<div><div id="chat-tools-tabs">\
      <ul><li><a href="#filter-tab">filters</a></li><li><a href="#highlight-tab">highlighters</a></li></ul>\
      <div id="filter-tab">\
        <div id="filter-list"></div>\
        <form id="filterform" style="bottom: 0;position: absolute;">\
          <input type="text" placeholder="regex or search string">\
          <label>&nbsp;[ all <input type="checkbox" checked> |&nbsp;</label>\
          <label>faction <input type="checkbox" checked> |&nbsp;</label>\
          <label>alerts <input type="checkbox" checked> ]&nbsp;</label>\
          <label title="show items matching this filter">include<input name="filtertype" type="radio"></label>\
          <label title="hide items matching this filter">exclude<input name="filtertype" type="radio" checked></label>\
          <button type="submit">add filter</button>\
        </form></div>\
      <div id="highlight-tab">\
        <div id="highlighter-list"></div>\
        <form id="highlighterform" style="bottom: 0;position: absolute;">\
          <input type="text" placeholder="regex or search string">\
          <label>&nbsp;[ all <input type="checkbox" checked> |&nbsp;</label>\
          <label>faction <input type="checkbox" checked> |&nbsp;</label>\
          <label>alerts <input type="checkbox" checked> ]&nbsp;</label>\
          <label>color <input type="color" value="#505050"></input></label>\
          <button type="submit">add highlighter</button>\
        </form></div>\
      </div></div>',
    width:550,
    height: 400
  });
  $('.chat-tools .ui-dialog-buttonset').prepend('<label style="float: left;">exclude all messages\
                                                  <input type="checkbox" onclick="window.plugin.chat_tools.toggle_all()">\
                                                </label>');
  $('#chat-tools-tabs').tabs();
  tools.on(tools.elem('#filterform'), 'submit', function(event) {
    event.preventDefault();
    window.plugin.chat_tools.filters.push({
      matcher: event.target[0].value,
      tab: {
        all: event.target[1].checked,
        faction: event.target[2].checked,
        alerts: event.target[3].checked
      },
      type: event.target[4].checked?'include':'exclude'
    });
    event.target[0].value = '';
    var tab = chat.getActive() === 'all'?'public':chat.getActive();
    chat.renderData(chat['_' + tab].data, 'chat' + chat.getActive(), false);
    window.plugin.chat_tools.render_filterlist();
  });
  tools.on(tools.elem('#highlighterform'), 'submit', function(event) {
     event.preventDefault();
     window.plugin.chat_tools.highlighters.push({
      matcher: event.target[0].value,
      tab: {
        all: event.target[1].checked,
        faction: event.target[2].checked,
        alerts: event.target[3].checked
      },
      color: event.target[4].value
    });
    event.target[0].value = '';
    var tab = chat.getActive() === 'all'?'public':chat.getActive();
    chat.renderData(chat['_' + tab].data, 'chat' + chat.getActive(), false);
    window.plugin.chat_tools.render_highlighterlist();
  });
  window.plugin.chat_tools.render_filterlist();
  window.plugin.chat_tools.render_highlighterlist();
}

window.plugin.chat_tools.remove = function(type, index) {
  if (type === 'filter') {
    window.plugin.chat_tools.filters.remove(index);
    window.plugin.chat_tools.render_filterlist();
  } else {
    window.plugin.chat_tools.highlighters.remove(index);
    window.plugin.chat_tools.render_highlighterlist();
  }
  var tab = chat.getActive() === 'all'?'public':chat.getActive();
  chat.renderData(chat['_' + tab].data, 'chat' + chat.getActive(), false);
}

window.plugin.chat_tools.toggle_all = function() {
  window.plugin.chat_tools.hide_all = !window.plugin.chat_tools.hide_all;
  var tab = chat.getActive() === 'all'?'public':chat.getActive();
  chat.renderData(chat['_' + tab].data, 'chat' + chat.getActive(), false);
}

window.plugin.chat_tools.render_filterlist = function() {
  var filters = window.plugin.chat_tools.filters;
  var list = '';
  filters.each(function(i, v) {
    list += '<li style="border-bottom: 1px solid lightslategrey;margin-bottom: 5px;padding-bottom: 5px;">\
              <a onclick="window.plugin.chat_tools.remove(\'filter\', \'' + i + '\')">[x]</a>' + JSON.stringify(v) + '</li>';
  });
  tools.elem('#filter-list').innerHTML = '<ul style="list-style: none;padding-left: 0;overflow: auto;height: 263px;">' + list + '</ul>';
}

window.plugin.chat_tools.render_highlighterlist = function() {
  var highlighters = window.plugin.chat_tools.highlighters;
  var list = '';
  highlighters.each(function(i, v) {// some way of getting the whole thing ... maybe wrapping in a form? yup - event.target.form[] 
    // ... now i just have to override the array setter in the PersistantArray :P
    list += '<li style="border-bottom: 1px solid lightslategrey;margin-bottom: 5px;padding-bottom: 5px;"\
              onchange="window.plugin.chat_tools.update(\'highlighter\', \'' + i + '\')">\
              <a onclick="window.plugin.chat_tools.remove(\'highlighter\', \'' + i + '\')">[x]</a>' 
              + '<label> matches <input type="text" value="' + v.matcher + '"></label>'
              + ' enabled for [ <label> all <input type="checkbox"' + (v.tab.all?'checked':'') + '></label> | '
              + '<label> faction <input type="checkbox"' + (v.tab.faction?'checked':'') + '></label> | ' 
              + '<label> alerts <input type="checkbox"' + (v.tab.alerts?'checked':'') + '></label> ] '
              + '<label> color <input type="color" value="' + v.color + '"></label></li>';
  });
  tools.elem('#highlighter-list').innerHTML = '<ul style="list-style: none;padding-left: 0;overflow: auto;height: 263px;">' + list + '</ul>';  
}

var setup = function() {
  // tools.append(tools.elem('#chatcontrols'), tools.template(['a', {text: 'tools', onclick='window.plugin.chat_tools.open()'}]));
  tools.elem('#chatcontrols').innerHTML += '<a onclick="window.plugin.chat_tools.open()">tools</a>';
  // re-run setup to re-bind the tab change handlers
  chat.setup();

  var match_filter = function(message) {
    if (plugin.chat_tools.filters.length > 0) {
      var filters = plugin.chat_tools.filters;
      //var matches = []
      for (var i = 0; i < filters.length; i++) {
        if(filters[i].tab[chat.getActive()] && RegExp(filters[i].matcher, 'gi').test(message)) return filters[i];
      }
    }
    return false;
  };

  var match_highlight = function(message) {
    //console.log(message);
    if (plugin.chat_tools.highlighters.length > 0) {
      var highlighters = plugin.chat_tools.highlighters;
      for (var i = 0; i < highlighters.length; i++) {
        if(highlighters[i].tab[chat.getActive()] && RegExp(highlighters[i].matcher, 'gi').test(message)) return highlighters[i];
      }
    }
    return false;
  };

  // override the renderMsg function because we need a way to set a background for the message
  // so we just add the <tr> tags when we're actually rendering the chat log
  window.chat.renderMsg = function(msg, nick, time, team, msgToPlayer, systemNarrowcast) {
    var ta = unixTimeToHHmm(time);
    var tb = unixTimeToDateTimeString(time, true);
    //add <small> tags around the milliseconds
    tb = (tb.slice(0,19)+'<small class="milliseconds">'+tb.slice(19)+'</small>').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    // help cursor via “#chat time”
    var t = '<time title="'+tb+'" data-timestamp="'+time+'">'+ta+'</time>';
    if ( msgToPlayer )
    {
      t = '<div class="pl_nudge_date">' + t + '</div><div class="pl_nudge_pointy_spacer"></div>';
    }
    if (systemNarrowcast)
    {
      msg = '<div class="system_narrowcast">' + msg + '</div>';
    }
    var color = COLORS[team];
    if (nick === window.PLAYER.nickname) color = '#fd6';    // highlight things said/done by the player in a unique colour 
                                                            //  (similar to @player mentions from others in the chat text itself)
    var s = 'style="cursor:pointer; color:'+color+'"';
    var i = ['<span class="invisep">&lt;</span>', '<span class="invisep">&gt;</span>'];
    return '<td>'+t+'</td><td>'+i[0]+'<mark class="nickname" ' + s + '>'+ nick+'</mark>'+i[1]+'</td><td>'+msg+'</td>';
  }

  // override the renderData function
  window.chat.renderData = function(data, element, likelyWereOldMsgs) {
    var elm = $('#'+element);
    if(elm.is(':hidden')) return;

    // discard guids and sort old to new
    // TODO? stable sort, to preserve server message ordering? or sort by GUID if timestamps equal?
    var vals = $.map(data, function(v, k) { return [v]; });
    vals = vals.sort(function(a, b) { return a[0]-b[0]; });

    function highlight_message(msg) {
       // if the message matches a highlighter, highlight it
      var highlight = match_highlight(msg[4])
      if(highlight) {
        // do the highlight dance
        var color = highlight.color;
        return '<tr style="background:' + color + ';">' + msg[2] + '</tr>';  
      } else {
        return '<tr>' + msg[2] + '</tr>';
      } 
    }

    // render to string with date separators inserted
    var msgs = '';
    var prevTime = null;
    $.each(vals, function(ind, msg) {
      var nextTime = new Date(msg[0]).toLocaleDateString();
      if(prevTime && prevTime !== nextTime)
        msgs += chat.renderDivider(nextTime);
      prevTime = nextTime;
      var filter = match_filter(msg[4]);
      // filter type is include, just render the message
      if (filter && filter.type === 'include') {
          msgs += highlight_message(msg);
      // if hide_all we just render messages that match 'include' filters
      } else if (!window.plugin.chat_tools.hide_all) {
        // filter type is exclude, if we don't match the filter render the message
        if (!filter) {
          msgs += highlight_message(msg);
        }
      }
    });

    var scrollBefore = scrollBottom(elm);
    elm.html('<table>' + msgs + '</table>');
    chat.keepScrollPosition(elm, scrollBefore, likelyWereOldMsgs);
  }

  // override writeDataToHash so we can get the raw message data
  window.chat.writeDataToHash = function(newData, storageHash, isPublicChannel, isOlderMsgs) {
    $.each(newData.result, function(ind, json) {
      // avoid duplicates
      if(json[0] in storageHash.data) return true;

      var isSecureMessage = false;
      var msgToPlayer = false;

      var time = json[1];
      var team = json[2].plext.team === 'RESISTANCE' ? TEAM_RES : TEAM_ENL;
      var auto = json[2].plext.plextType !== 'PLAYER_GENERATED';
      var systemNarrowcast = json[2].plext.plextType === 'SYSTEM_NARROWCAST';

      // track oldest + newest timestamps
      if (storageHash.oldestTimestamp === -1 || storageHash.oldestTimestamp > time) storageHash.oldestTimestamp = time;
      if (storageHash.newestTimestamp === -1 || storageHash.newestTimestamp < time) storageHash.newestTimestamp = time;

      // remove "Your X on Y was destroyed by Z" from the faction channel
      // if (systemNarrowcast && !isPublicChannel) return true;

      var msg = '', nick = '';
      $.each(json[2].plext.markup, function(ind, markup) {
        switch(markup[0]) {
        case 'SENDER': // user generated messages
          nick = markup[1].plain.slice(0, -2); // cut “: ” at end
          break;

        case 'PLAYER': // automatically generated messages
          nick = markup[1].plain;
          team = markup[1].team === 'RESISTANCE' ? TEAM_RES : TEAM_ENL;
          if(ind > 0) msg += nick; // don’t repeat nick directly
          break;

        case 'TEXT':
          msg += $('<div/>').text(markup[1].plain).html().autoLink();
          break;

        case 'AT_PLAYER':
          var thisToPlayer = (markup[1].plain == ('@'+window.PLAYER.nickname));
          var spanClass = thisToPlayer ? "pl_nudge_me" : (markup[1].team + " pl_nudge_player");
          var atPlayerName = markup[1].plain.replace(/^@/, "");
          msg += $('<div/>').html($('<span/>')
                            .attr('class', spanClass)
                            .attr('onclick',"window.chat.nicknameClicked(event, '"+atPlayerName+"')")
                            .text(markup[1].plain)).html();
          msgToPlayer = msgToPlayer || thisToPlayer;
          break;

        case 'PORTAL':
          var latlng = [markup[1].latE6/1E6, markup[1].lngE6/1E6];
          var perma = '/intel?ll='+latlng[0]+','+latlng[1]+'&z=17&pll='+latlng[0]+','+latlng[1];
          var js = 'window.selectPortalByLatLng('+latlng[0]+', '+latlng[1]+');return false';

          msg += '<a onclick="'+js+'"'
            + ' title="'+markup[1].address+'"'
            + ' href="'+perma+'" class="help">'
            + window.chat.getChatPortalName(markup[1])
            + '</a>';
          break;

        case 'SECURE':
          // NOTE: we won't add the '[secure]' string here - it'll be handled below instead
          isSecureMessage = true;
          break;

        default:
          //handle unknown types by outputting the plain text version, marked with it's type
          msg += $('<div/>').text(markup[0]+':<'+markup[1].plain+'>').html();
          break;
        }
      });

      // from the server, private channel messages are flagged with a SECURE string '[secure] ', and appear in
      // both the public and private channels
      // we don't include this '[secure]' text above, as it's redundant in the faction-only channel
      // let's add it here though if we have a secure message in the public channel, or the reverse if a non-secure in the faction one
      if (!auto && !(isPublicChannel===false) && isSecureMessage) msg = '<span style="color: #f88; background-color: #500;">[faction]</span> ' + msg;
      // and, add the reverse - a 'public' marker to messages in the private channel
      if (!auto && !(isPublicChannel===true) && (!isSecureMessage)) msg = '<span style="color: #ff6; background-color: #550">[public]</span> ' + msg;


      // format: timestamp, autogenerated, HTML message
      storageHash.data[json[0]] = [json[1], auto, chat.renderMsg(msg, nick, time, team, msgToPlayer, systemNarrowcast), nick, json[2].plext.text];

    });
  }

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