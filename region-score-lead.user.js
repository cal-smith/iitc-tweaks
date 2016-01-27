// ==UserScript==
// @id             iitc-plugin-region-score-lead@hansolo669
// @name           IITC plugin: region score lead
// @category       Tweaks
// @version        0.0.3
// @namespace      https://github.com/hansolo669/iitc-tweaks
// @updateURL      http://www.reallyawesomedomain.com/iitc-tweaks/region-score-lead.meta.js
// @downloadURL    http://www.reallyawesomedomain.com/iitc-tweaks/region-score-lead.user.js
// @description    Small modification to the region scores to show the current mu lead.
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
// we stick all this stuff in the setup function to ensure it loads *after* IITC has booted
  window.regionScoreboard = function() {
    // TODO: rather than just load the region scores for the center of the map, display a list of regions in the current view
    // and let the user select one (with automatic selection when just one region, and limited to close enough zooms so list size is reasonable)
    var latlng = map.getCenter();
    
    window.requestRegionScores(latlng);
  }

  window.regionScoresAtRegion = function(region) {
    var latlng = regionToLatLong(region);
    window.requestRegionScores(latlng);
  };

  window.requestRegionScores = function(latlng) {
    var latE6 = Math.round(latlng.lat*1E6);
    var lngE6 = Math.round(latlng.lng*1E6);
    var dlg = dialog({title:'Region scores',html:'Loading regional scores...',width:450,minHeight:330});
    window.postAjax('getRegionScoreDetails', {latE6:latE6,lngE6:lngE6}, function(res){regionScoreboardSuccess(res,dlg);}, function(){regionScoreboardFailure(dlg);});
  };
  
  function regionScoreboardFailure(dlg) {
    dlg.html('Failed to load region scores - try again');
  }
  
  
  function regionScoreboardScoreHistoryChart(result, logscale) {
    // svg area 400x130. graph area 350x100, offset to 40,10
  
    if(!Math.log10)
      Math.log10 = function(x) { return Math.log(x) / Math.LN10; };
  
    var max = Math.max(result.gameScore[0],result.gameScore[1],10); //NOTE: ensure a min of 10 for the graph
    var items = []; //we'll copy the items to an array indexed by checkpoint number - easier to access!
    for (var i=0; i<result.scoreHistory.length; i++) {
      max = Math.max(max, result.scoreHistory[i][1], result.scoreHistory[i][2]); //note: index 0 is the checkpoint number here
      items[result.scoreHistory[i][0]] = [result.scoreHistory[i][1], result.scoreHistory[i][2]];
    }
  
    // scale up maximum a little, so graph isn't squashed right against upper edge
    max *= 1.09;
  
    // 0 cannot be displayed on a log scale, so we set the minimum to 0.001 and divide by lg(0.001)=-3
    var scale = logscale
      ? function(y) { return  10 - Math.log10(Math.max(0.001,y/max)) / 3 * 100; }
      : function(y) { return 110-y/max*100; };
  
    var teamPaths = [[],[]];
    var otherSvg = [];
  
    for (var i=0; i<items.length; i++) {
      var x=i*10+40;
      if (items[i] !== undefined) {
        // paths
        if (i>0 && items[i-1] !== undefined) {
          for (var t=0; t<2; t++) {
            teamPaths[t].push('M'+(x-10)+','+scale(items[i-1][t])+' L'+x+','+scale(items[i][t]));
          }
        }
        // markers
        otherSvg.push('<g title="test" class="checkpoint" data-cp="'+i+'" data-enl="'+items[i][0]+'" data-res="'+items[i][1]+'">');
        otherSvg.push('<rect x="'+(i*10+35)+'" y="10" width="10" height="100" fill="black" fill-opacity="0" />');
        for (var t=0; t<2; t++) {
          var col = t==0 ? COLORS[TEAM_ENL] : COLORS[TEAM_RES];
          otherSvg.push('<circle cx="'+x+'" cy="'+scale(items[i][t])+'" r="3" stroke-width="1" stroke="'+col+'" fill="'+col+'" fill-opacity="0.5" />');
        }
        otherSvg.push('</g>');
      }
    }
  
  
    var paths = '<path d="M40,110 L40,10 M40,110 L390,110" stroke="#fff" />';
  
    // graph tickmarks - horizontal
    var ticks = [];
    for (var i=5; i<=35; i+=5) {
      var x=i*10+40;
      ticks.push('M'+x+',10 L'+x+',110');
      otherSvg.push('<text x="'+x+'" y="125" font-size="12" font-family="Roboto, Helvetica, sans-serif" text-anchor="middle" fill="#fff">'+i+'</text>');
    }
  
    // vertical
    // first we calculate the power of 10 that is smaller than the max limit
    var vtickStep = Math.pow(10,Math.floor(Math.log10(max)));
    var vticks = [];
    if(logscale) {
      for(var i=0;i<4;i++) {
        vticks.push(vtickStep);
        vtickStep /= 10;
      }
    } else {
      // this could be between 1 and 10 grid lines - so we adjust to give nicer spacings
      if (vtickStep < (max/5)) {
        vtickStep *= 2;
      } else if (vtickStep > (max/2)) {
        vtickStep /= 2;
      }
      for (var i=vtickStep; i<=max; i+=vtickStep) {
        vticks.push(i);
      }
    }
    vticks.forEach(function(i) {
      var y = scale(i);
  
      ticks.push('M40,'+y+' L390,'+y);
  
      var istr = i>=1000000000 ? i/1000000000+'B' : i>=1000000 ? i/1000000+'M' : i>=1000 ? i/1000+'k' : i;
      otherSvg.push('<text x="35" y="'+y+'" font-size="12" font-family="Roboto, Helvetica, sans-serif" text-anchor="end" fill="#fff">'+istr+'</text>');
    });
  
    paths += '<path d="'+ticks.join(' ')+'" stroke="#fff" opacity="0.3" />;'
  
    for (var t=0; t<2; t++) {
      var col = t==0 ? COLORS[TEAM_ENL] : COLORS[TEAM_RES];
      if (teamPaths[t].length > 0) {
        paths += '<path d="'+teamPaths[t].join(' ')+'" stroke="'+col+'" />';
      }
  
      var y = scale(result.gameScore[t]);
      paths += '<path d="M40,'+y+' L390,'+y+'" stroke="'+col+'" stroke-dasharray="3,2" opacity="0.8" />';
    }
  
    var svg = '<div><svg width="400" height="130">'
             +'<rect x="0" y="0" width="400" height="130" stroke="#FFCE00" fill="#08304E" />'
             +paths
             +otherSvg.join('')
             +'<foreignObject height="18" width="45" y="111" x="0" class="node"><label title="Logarithmic scale">'
             +'<input type="checkbox" class="logscale" style="height:auto;padding:0;vertical-align:middle"'+(logscale?' checked':'')+'/>'
             +'log</label></foreignObject>'
             +'</svg></div>';
  
    return svg;
  }
  
  function regionScoreboardScoreHistoryTable(result) {
    var history = result.scoreHistory;
    var table = '<table class="checkpoint_table" style="width: 370px;"> \
      <thead><tr><th>Checkpoint</th><th>Enlightened</th><th>Resistance</th> \
      <th>Lead</th></tr></thead>';
    var lead = 0;
    var rows = '';
    for(var i=history.length-1; i >= 0; i--) {
      lead += history[i][1] - history[i][2];
      var checkpoint_lead = lead < 0?'res: ' + digits(Math.abs(lead)):'enl: ' + digits(lead);
      rows = '<tr><td>' + history[i][0] 
          + '</td><td>' + digits(history[i][1]) 
          + '</td><td>' + digits(history[i][2]) 
          + '</td><td class="' + (lead < 0?'res':'enl') + '" style="text-align: left;" >' + checkpoint_lead 
          + '</td></tr>' + rows;
    }
    return table += rows +'</table>';
  }

  // start crazy region code

  // facenames and codewords
  var facenames = [ 'AF', 'AS', 'NR', 'PA', 'AM', 'ST' ];
  var codewords = [
    'ALPHA',    'BRAVO',   'CHARLIE', 'DELTA',
    'ECHO',     'FOXTROT', 'GOLF',    'HOTEL',
    'JULIET',   'KILO',    'LIMA',    'MIKE',
    'NOVEMBER', 'PAPA',    'ROMEO',   'SIERRA',
  ];

  var regionToLatLong = function(region) {
    // rot, d2xy, facenames, and codewords taken from regions.user.js
    var rot = function(n, x, y, rx, ry) {
      if(ry == 0) {
        if(rx == 1) {
          x = n-1 - x;
          y = n-1 - y;
        }

        return [y, x];
      }
      return [x, y];
    }
    var d2xy = function(n, d) {
      var rx, ry, s, t = d, xy = [0, 0];
      for(s=1; s<n; s*=2) {
        rx = 1 & (t/2);
        ry = 1 & (t ^ rx);
        xy = window.plugin.regions.rot(s, xy[0], xy[1], rx, ry);
        xy[0] += s * rx;
        xy[1] += s * ry;
        t /= 4;
      }
      return xy;
    }
    // inspired by regions.user.js getSearchResult
    region = region.split("-");
    var faceId = facenames.indexOf(region[0].slice(0, 2));
    var regionI = parseInt(region[0].slice(2)) - 1;
    var regionJ = codewords.indexOf(region[1]);
    var xy = d2xy(4, parseInt(region[2]));
    regionI = (regionI << 2) + xy[0];
    regionJ = (regionJ << 2) + xy[1];
    var cell = (faceId % 2 == 1)
    ? S2.S2Cell.FromFaceIJ(faceId, [regionJ,regionI], 6)
    : S2.S2Cell.FromFaceIJ(faceId, [regionI,regionJ], 6);
    return cell.getLatLng();
  }

  // borrowed from the "regions" plugin
  var regionName = function(cell) {
    // ingress does some odd things with the naming. for some faces, the i and j coords are flipped when converting
    // (and not only the names - but the full quad coords too!). easiest fix is to create a temporary cell with the coords
    // swapped
    if (cell.face == 1 || cell.face == 3 || cell.face == 5) {
      cell = S2.S2Cell.FromFaceIJ ( cell.face, [cell.ij[1], cell.ij[0]], cell.level );
    }

    // first component of the name is the face
    var name = facenames[cell.face];

    if (cell.level >= 4) {
      // next two components are from the most signifitant four bits of the cell I/J
      var regionI = cell.ij[0] >> (cell.level-4);
      var regionJ = cell.ij[1] >> (cell.level-4);

      name += zeroPad(regionI+1,2)+'-'+codewords[regionJ];
    }

    if (cell.level >= 6) {
      // the final component is based on the hibbert curve for the relevant cell
      var facequads = cell.getFaceAndQuads();
      var number = facequads[1][4]*4+facequads[1][5];

      name += '-'+zeroPad(number,2);
    }


    return name;
  };

  window.regionSearch = function(ev) {
    if (ev.target.name === "regionsearch") {
      var search = ev.target.value.toUpperCase();
      var latlng = map.getCenter();
      var currentregion = regionName(S2.S2Cell.FromLatLng(latlng, 6)).split("-");
      
      // Borrwed from the regions plugin. It's a good regex for it's purpose.
      // This regexp is quite forgiving. Dashes are allowed between all components, each dash and leading zero is optional.
      // All whitespace is removed in onSearch(). If the first or both the first and second component are omitted, they are
      // replaced with the current cell's coordinates (=the cell which contains the center point of the map). If the last
      // component is ommited, the 4x4 cell group is used.
      var reparse = new RegExp('^(?:(?:(' + facenames.join('|') 
        + ')(?:\\s?|-?))?((?:1[0-6])|(?:0?[1-9]))(?:\\s?|-?))?(' + codewords.join('|') 
        + ')(?:(?:\\s?|-?)((?:1[0-5])|(?:0?\\d)))?$', 'i');
      var matches = search.match(reparse);
      console.log(matches);
      var result = "";

      if (matches === null) {
        if (search.search(/^\w{1,2}\d{1,2}$/i) !== -1) {
          for (var i = 0; i < codewords.length; i++) {
            result += '<span>' + search + '-' + codewords[i] + '</span><br>';
          }
        } else if (facenames.includes(search)) {
          for (var i = 1; i <= 16; i++) {
            result += '<span>' + search + (i>=10?i:('0' + i)) + '</span><br>';
          }
        }
      } else {
        var face = !matches[1]?currentregion[0]:matches[1];
        var facenum = matches[2]?matches[2]:"";
        var region = !matches[3]?currentregion[1]:matches[3];
        var regionnum = matches[4]?matches[4]:false;
        if (!regionnum) {
          for (var i = 0; i < 16; i++) {
            var res = face + facenum + '-' + region + '-' + (i>=10?i:('0' + i));
            result += '<a onclick="window.regionScoresAtRegion(\'' + res + '\')">' + res + '</a><br>';
          }
        } else {
          var res = face + facenum + '-' + region + '-' + (regionnum>=10?regionnum:('0' + regionnum));
          result = '<a onclick="window.regionScoresAtRegion(\'' + res + '\')">' + res + '</a><br>'
        }
      }

      $('.regionresults').html(result);
    }
  }

  window.regionSelector = function() {  
    var selectorhtml = '<div style="overflow-y: scroll; height: 235px;">'
    +'<input type="text" name="regionsearch" placeholder="search" onkeyup="window.regionSearch(event)"/>'
    +'<div class="regionresults"></div>'
    +'<div> possible regions: '
    +codewords.reduce(function(html, word) { return html += ', ' + word; })
    +'</div></div>';
    var dlg = dialog({title:'Region selector',html:selectorhtml,width:300,minHeight:330});
  }

  var handleRegionClick = function(e) {
    $(".leaflet-container")[0].style.cursor = "grab";
    requestRegionScores(e.latlng);
    map.off("click", handleRegionClick);
  }

  window.regionClickSelector = function() {
    $(".leaflet-container")[0].style.cursor = "crosshair";
    map.on("click", handleRegionClick);
  }
  // end of crazy region code
  
  function regionScoreboardSuccess(data,dlg,logscale) {
    if (data.result === undefined) {
      return regionScoreboardFailure(dlg);
    }
  
    var agentTable = '<table><tr><th>#</th><th>Agent</th></tr>';
    for (var i=0; i<data.result.topAgents.length; i++) {
      var agent = data.result.topAgents[i];
      agentTable += '<tr><td>'+(i+1)+'</td><td class="nickname '+(agent.team=='RESISTANCE'?'res':'enl')+'">'+agent.nick+'</td></tr>';
    }
    if (data.result.topAgents.length === 0) {
      agentTable += '<tr><td colspan="2"><i>no top agents</i></td></tr>';
    }
    agentTable += '</table>';
  
  
    var maxAverage = Math.max(data.result.gameScore[0], data.result.gameScore[1], 1);
    var teamRow = [];
    for (var t=0; t<2; t++) {
      var team = t===0 ? 'Enlightened' : 'Resistance';
      var teamClass = t===0 ? 'enl' : 'res';
      var teamCol = t===0 ? COLORS[TEAM_ENL] : COLORS[TEAM_RES];
      var barSize = Math.round(data.result.gameScore[t]/maxAverage*200);
      teamRow[t] = '<tr><th class="'+teamClass+'">'
        +team+'</th><td class="'+teamClass+'">'
        +digits(data.result.gameScore[t])+'</td><td><div style="background:'
        +teamCol+'; width: '+barSize+'px; height: 1.3ex; border: 2px outset '
        +teamCol+'"> </td></tr>';
  
    }
    
    var history = data.result.scoreHistory;
    // the lead is the sum of the difference of each checkpoint
    var lead = history.map(function(cp) { return cp[1] - cp[2] }).reduce(function(acc, diff) { return acc + diff }, 0);
    var leadinfo = '<div style="padding-left: 5px;">';
    // res lead when we sum to a negative value
    if (lead < 0) {
      leadinfo += '<span class="res">res lead: ' + digits(Math.abs(lead)) + 'mu</span></div>';
    } else {
      leadinfo += '<span class="enl">enl lead: ' + digits(lead) + 'mu</span></div>';
    }
  
    var first = PLAYER.team == 'RESISTANCE' ? 1 : 0;
  
    // we need some divs to make the accordion work properly
    dlg.html('<div class="cellscore">'
           +'<b>Region scores for '+data.result.regionName+'</b>'
           +'<div><a title="Search region" onclick="window.regionSelector()">Search region</a> OR '// lets add the ability to select another region
           +'<a title="Click to select region" onclick="window.regionClickSelector()">Select region from map</a>'
           +'<table>'+teamRow[first]+teamRow[1-first]+'</table>'
           +leadinfo // stick our info under the score bars
           +regionScoreboardScoreHistoryChart(data.result, logscale)+'</div>'
           +'<b>Checkpoint overview</b>'
           +'<div>'+regionScoreboardScoreHistoryTable(data.result)+'</div>'
           +'<b>Top agents</b>'
           +'<div>'+agentTable+'</div>'
           +'</div>');
      
    $('g.checkpoint', dlg).each(function(i, elem) {
      elem = $(elem);
  
      var tooltip = 'CP:\t'+elem.attr('data-cp')
        + '\nEnl:\t' + digits(elem.attr('data-enl'))
        + '\nRes:\t' + digits(elem.attr('data-res'))
        + '\nDiff:\t' + digits(Math.abs(elem.attr('data-res')-elem.attr('data-enl')));
      elem.tooltip({
        content: convertTextToTableMagic(tooltip),
        position: {my: "center bottom", at: "center top-10"}
      });
    });
  
    $('.cellscore', dlg).accordion({
      header: 'b',
      heightStyle: "fill",
    });
  
    $('input.logscale', dlg).change(function(){
      var input = $(this);
      regionScoreboardSuccess(data, dlg, input.prop('checked'));
    });
  }
}
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
