// ==UserScript==
// @id             iitc-plugin-region-score-lead@hansolo669
// @name           IITC plugin: region score lead
// @category       Tweaks
// @version        0.2.1
// @namespace      https://github.com/hansolo669/iitc-tweaks
// @updateURL      https://www.reallyawesomedomain.com/iitc-tweaks/region-score-lead.meta.js
// @downloadURL    https://www.reallyawesomedomain.com/iitc-tweaks/region-score-lead.user.js
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
  window.localedigits = function(d) {
    if(!parseInt(d)) return d;
    return parseInt(d).toLocaleString();
  }
  // include the S2 functions if they don't exist
  if (!window.S2) {
    (function() {
      window.S2 = {};

      var LatLngToXYZ = function(latLng) {
        var d2r = Math.PI/180.0;

        var phi = latLng.lat*d2r;
        var theta = latLng.lng*d2r;

        var cosphi = Math.cos(phi);

        return [Math.cos(theta)*cosphi, Math.sin(theta)*cosphi, Math.sin(phi)];
      };

      var XYZToLatLng = function(xyz) {
        var r2d = 180.0/Math.PI;

        var lat = Math.atan2(xyz[2], Math.sqrt(xyz[0]*xyz[0]+xyz[1]*xyz[1]));
        var lng = Math.atan2(xyz[1], xyz[0]);

        return L.latLng(lat*r2d, lng*r2d);
      };

      var largestAbsComponent = function(xyz) {
        var temp = [Math.abs(xyz[0]), Math.abs(xyz[1]), Math.abs(xyz[2])];

        if (temp[0] > temp[1]) {
          if (temp[0] > temp[2]) {
            return 0;
          } else {
            return 2;
          }
        } else {
          if (temp[1] > temp[2]) {
            return 1;
          } else {
            return 2;
          }
        }

      };

      var faceXYZToUV = function(face,xyz) {
        var u,v;

        switch (face) {
          case 0: u =  xyz[1]/xyz[0]; v =  xyz[2]/xyz[0]; break;
          case 1: u = -xyz[0]/xyz[1]; v =  xyz[2]/xyz[1]; break;
          case 2: u = -xyz[0]/xyz[2]; v = -xyz[1]/xyz[2]; break;
          case 3: u =  xyz[2]/xyz[0]; v =  xyz[1]/xyz[0]; break;
          case 4: u =  xyz[2]/xyz[1]; v = -xyz[0]/xyz[1]; break;
          case 5: u = -xyz[1]/xyz[2]; v = -xyz[0]/xyz[2]; break;
          default: throw {error: 'Invalid face'}; break;
        }

        return [u,v];
      }

      var XYZToFaceUV = function(xyz) {
        var face = largestAbsComponent(xyz);

        if (xyz[face] < 0) {
          face += 3;
        }

        uv = faceXYZToUV (face,xyz);

        return [face, uv];
      };

      var FaceUVToXYZ = function(face,uv) {
        var u = uv[0];
        var v = uv[1];

        switch (face) {
          case 0: return [ 1, u, v];
          case 1: return [-u, 1, v];
          case 2: return [-u,-v, 1];
          case 3: return [-1,-v,-u];
          case 4: return [ v,-1,-u];
          case 5: return [ v, u,-1];
          default: throw {error: 'Invalid face'};
        }
      };

      var STToUV = function(st) {
        var singleSTtoUV = function(st) {
          if (st >= 0.5) {
            return (1/3.0) * (4*st*st - 1);
          } else {
            return (1/3.0) * (1 - (4*(1-st)*(1-st)));
          }
        }

        return [singleSTtoUV(st[0]), singleSTtoUV(st[1])];
      };

      var UVToST = function(uv) {
        var singleUVtoST = function(uv) {
          if (uv >= 0) {
            return 0.5 * Math.sqrt (1 + 3*uv);
          } else {
            return 1 - 0.5 * Math.sqrt (1 - 3*uv);
          }
        }

        return [singleUVtoST(uv[0]), singleUVtoST(uv[1])];
      };

      var STToIJ = function(st,order) {
        var maxSize = (1<<order);

        var singleSTtoIJ = function(st) {
          var ij = Math.floor(st * maxSize);
          return Math.max(0, Math.min(maxSize-1, ij));
        };

        return [singleSTtoIJ(st[0]), singleSTtoIJ(st[1])];
      };

      var IJToST = function(ij,order,offsets) {
        var maxSize = (1<<order);

        return [
          (ij[0]+offsets[0])/maxSize,
          (ij[1]+offsets[1])/maxSize
        ];
      }

      // hilbert space-filling curve
      // based on http://blog.notdot.net/2009/11/Damn-Cool-Algorithms-Spatial-indexing-with-Quadtrees-and-Hilbert-Curves
      // note: rather then calculating the final integer hilbert position, we just return the list of quads
      // this ensures no precision issues whth large orders (S3 cell IDs use up to 30), and is more
      // convenient for pulling out the individual bits as needed later
      var pointToHilbertQuadList = function(x,y,order) {
        var hilbertMap = {
          'a': [ [0,'d'], [1,'a'], [3,'b'], [2,'a'] ],
          'b': [ [2,'b'], [1,'b'], [3,'a'], [0,'c'] ],
          'c': [ [2,'c'], [3,'d'], [1,'c'], [0,'b'] ],
          'd': [ [0,'a'], [3,'c'], [1,'d'], [2,'d'] ]  
        };

        var currentSquare='a';
        var positions = [];

        for (var i=order-1; i>=0; i--) {

          var mask = 1<<i;

          var quad_x = x&mask ? 1 : 0;
          var quad_y = y&mask ? 1 : 0;

          var t = hilbertMap[currentSquare][quad_x*2+quad_y];

          positions.push(t[0]);

          currentSquare = t[1];
        }

        return positions;
      };

      // S2Cell class

      S2.S2Cell = function(){};

      //static method to construct
      S2.S2Cell.FromLatLng = function(latLng,level) {

        var xyz = LatLngToXYZ(latLng);

        var faceuv = XYZToFaceUV(xyz);
        var st = UVToST(faceuv[1]);

        var ij = STToIJ(st,level);

        return S2.S2Cell.FromFaceIJ (faceuv[0], ij, level);
      };

      S2.S2Cell.FromFaceIJ = function(face,ij,level) {
        var cell = new S2.S2Cell();
        cell.face = face;
        cell.ij = ij;
        cell.level = level;

        return cell;
      };

      S2.S2Cell.prototype.toString = function() {
        return 'F'+this.face+'ij['+this.ij[0]+','+this.ij[1]+']@'+this.level;
      };

      S2.S2Cell.prototype.getLatLng = function() {
        var st = IJToST(this.ij,this.level, [0.5,0.5]);
        var uv = STToUV(st);
        var xyz = FaceUVToXYZ(this.face, uv);

        return XYZToLatLng(xyz);  
      };

      S2.S2Cell.prototype.getCornerLatLngs = function() {
        var result = [];
        var offsets = [
          [ 0.0, 0.0 ],
          [ 0.0, 1.0 ],
          [ 1.0, 1.0 ],
          [ 1.0, 0.0 ]
        ];

        for (var i=0; i<4; i++) {
          var st = IJToST(this.ij, this.level, offsets[i]);
          var uv = STToUV(st);
          var xyz = FaceUVToXYZ(this.face, uv);

          result.push ( XYZToLatLng(xyz) );
        }
        return result;
      };

      S2.S2Cell.prototype.getFaceAndQuads = function() {
        var quads = pointToHilbertQuadList(this.ij[0], this.ij[1], this.level);

        return [this.face,quads];
      };

      S2.S2Cell.prototype.getNeighbors = function() {

        var fromFaceIJWrap = function(face,ij,level) {
          var maxSize = (1<<level);
          if (ij[0]>=0 && ij[1]>=0 && ij[0]<maxSize && ij[1]<maxSize) {
            // no wrapping out of bounds
            return S2.S2Cell.FromFaceIJ(face,ij,level);
          } else {
            // the new i,j are out of range.
            // with the assumption that they're only a little past the borders we can just take the points as
            // just beyond the cube face, project to XYZ, then re-create FaceUV from the XYZ vector

            var st = IJToST(ij,level,[0.5,0.5]);
            var uv = STToUV(st);
            var xyz = FaceUVToXYZ(face,uv);
            var faceuv = XYZToFaceUV(xyz);
            face = faceuv[0];
            uv = faceuv[1];
            st = UVToST(uv);
            ij = STToIJ(st,level);
            return S2.S2Cell.FromFaceIJ (face, ij, level);
          }
        };

        var face = this.face;
        var i = this.ij[0];
        var j = this.ij[1];
        var level = this.level;


        return [
          fromFaceIJWrap(face, [i-1,j], level),
          fromFaceIJWrap(face, [i,j-1], level),
          fromFaceIJWrap(face, [i+1,j], level),
          fromFaceIJWrap(face, [i,j+1], level)
        ];

      };
    })();
  }
  // we stick all this stuff in the setup function to ensure it loads *after* IITC has booted
  window.regionScoreboard = function() {
    var latlng = map.getCenter();
    window.requestRegionScores(latlng);
  }

  window.regionScoresAtRegion = function(region) {
    var latlng = regionToLatLong(region);
    window.requestRegionScores(latlng);
  };

  window.nextCheckpoint = function() {
    var checkpoint = 5*60*60;
    var now = Date.now();
    return (Math.floor(now / (checkpoint*1000)) * (checkpoint*1000)) + checkpoint*1000;
  };

  // apprently this doesn't exist sometimes?
  // I have no idea, but I kinda need this
  // borrowed from hooks.js
  if (!window.removeHook) {
    // callback must the SAME function to be unregistered.
    window.removeHook = function(event, callback) {
      if (typeof callback !== 'function') throw('Callback must be a function.');

      if (window._hooks[event]) {
        var index = window._hooks[event].indexOf(callback);
        if(index == -1)
          console.warn('Callback wasn\'t registered for this event.');
        else
          window._hooks[event].splice(index, 1);
      }
    }
  }

  window.formattedTimeToCheckpoint = function(checkpointms) {
    var now = Date.now();
    var hours = Math.floor(((((checkpointms-now)/1000)/60)/60)%24);
    var mins = Math.floor((((checkpointms-now)/1000)/60)%60);
    var sec = Math.floor(((checkpointms-now)/1000)%60);
    return 'Next Checkpoint in: ' + hours + 'h ' + mins + 'm ' + sec + 's';
  };

  // global time to next checkpoint
  var currentcheckpoint = nextCheckpoint();
  setInterval(function() {
    var nextcheckpoint = nextCheckpoint();
    var now = Date.now();
    if (now > currentcheckpoint) {
      currentcheckpoint = nextcheckpoint;
      runHooks('pluginRegionScores', {event:'checkpoint'});
      $('.time-to-checkpoint').each(function(i, elem) {
        elem.innerHTML = formattedTimeToCheckpoint(nextCheckpoint());
      });
    }
  }, 1000);
  pluginCreateHook('pluginRegionScores');

  window.requestRegionScores = function(latlng, existingdlg) {
    var latE6 = Math.round(latlng.lat*1E6);
    var lngE6 = Math.round(latlng.lng*1E6);
    var dlg = null;
    if (existingdlg) {
      dlg = existingdlg;
      dlg.html('Loading regional scores...');
    } else {
      dlg = dialog({
        title:'Region scores',
        html:'Loading regional scores...',
        width:450,
        minHeight:345,
        create: function() {
          this.currentRegionLatLong = latlng;
          var _this = this;
          this.refreshRegionScores = function() {
            window.requestRegionScores(_this.currentRegionLatLong, _this.currentdlg);
          };
          window.addHook('pluginRegionScores', this.refreshRegionScores);
        },
        closeCallback: function() {
         window.removeHook('pluginRegionScores', this.refreshRegionScores);
        }
      });
    }
    dlg[0].currentdlg = dlg;
    window.postAjax('getRegionScoreDetails', {latE6:latE6,lngE6:lngE6}, function(res){regionScoreboardSuccess(res,dlg);}, function(){regionScoreboardFailure(dlg);});
  };

  window.requestRegionScoresRetry = function(ev) {
    window.requestRegionScores(ev.target.parentNode.currentRegionLatLong, ev.target.parentNode.currentdlg);
  };
  
  function regionScoreboardFailure(dlg) {
    dlg.html('Failed to load region scores - <a onclick="window.requestRegionScoresRetry(event)">try again</a>');
  }
  
  // function to compute a simple linear regression for both teams
  function simpleLinearRegression(items) {
    var len = items.length-1;
    var sumx = 0;
    var sumxsq = 0;
    var sumyres = 0;
    var sumyenl = 0;
    var sumprodres = 0;
    var sumprodenl = 0;
    for (var i = 1; i < items.length; i++) {
      sumyenl += parseInt(items[i][0]);
      sumyres += parseInt(items[i][1]);
      sumprodenl += i * parseInt(items[i][0]);
      sumprodres += i * parseInt(items[i][1]);
      sumx += i;
      sumxsq += i*i;
    }

    // a = (sum_of_products - (sum_x * sum_y) / length) / (sum_x_squared - ((sum_x ** 2) / length))
    // b = (sum_y - a * sum_x) / length
    // return a, b
    var a = function(sxs, sx, sy, sp, len) { return (sp - (sx*sy)/len)/(sxs-((sx*sx)/len)); };
    var b = function(sy, sx, alpha, len) { return (sy - alpha * sx)/len; };
    return {enl: [
        a(sumxsq, sumx, sumyenl, sumprodenl, len),
        b(sumyenl, sumx, a(sumxsq, sumx, sumyenl, sumprodenl, len), len)], 
      res: [
        a(sumxsq, sumx, sumyres,sumprodres, len),  
        b(sumyres, sumx, a(sumxsq, sumx, sumyres,sumprodres, len), len)
      ]};
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
    
    // calculate and generate linear regressions
    var linregs = simpleLinearRegression(items);
    var resy1 = linregs.res[0] * 1 + linregs.res[1];
    var resy2 = linregs.res[0] * (items.length-1) + linregs.res[1];
    var enly1 = linregs.enl[0] * 1 + linregs.enl[1];
    var enly2 = linregs.enl[0] * (items.length-1) + linregs.enl[1];
    var x1 = 0*10+40
    var x2 = items.length*10+40;
    var regressions =  '<line x1="'+x1+'" y1="'+scale(resy1)+'" x2="'+x2+'" y2="'+scale(resy2)+'" stroke="'+COLORS[TEAM_RES]+'" stroke-width="1" />'
                      +'<line x1="'+x1+'" y1="'+scale(enly1)+'" x2="'+x2+'" y2="'+scale(enly2)+'" stroke="'+COLORS[TEAM_ENL]+'" stroke-width="1" />'
  
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
             +regressions
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
      var checkpoint_lead = lead < 0?'res: ' + localedigits(Math.abs(lead)):'enl: ' + localedigits(lead);
      rows = '<tr><td>' + history[i][0] 
          + '</td><td>' + localedigits(history[i][1]) 
          + '</td><td>' + localedigits(history[i][2]) 
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
        xy = rot(s, xy[0], xy[1], rx, ry);
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
  function regionName(cell) {
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
  }

  window.regionSearch = function(ev) {
    if (ev.target.name === "regionsearch") {
      var search = ev.target.value.toUpperCase();
      var latlng = map.getCenter();
      var currentregion = regionName(S2.S2Cell.FromLatLng(latlng, 6)).split("-");
      
      // Borrwed from the regions plugin and modified to allow spaces OR dashes OR nothing between keywords. 
      // It's a good enough regex for it's purpose.
      // This regexp is quite forgiving. Dashes are allowed between all components, each dash and leading zero is optional.
      // All whitespace is removed in onSearch(). If the first or both the first and second component are omitted, they are
      // replaced with the current cell's coordinates (=the cell which contains the center point of the map). If the last
      // component is ommited, the 4x4 cell group is used.
      var reparse = new RegExp('^(?:(?:(' + facenames.join('|') 
        + ')(?:\\s?|-?))?((?:1[0-6])|(?:0?[1-9]))(?:\\s?|-?))?(' + codewords.join('|') 
        + ')(?:(?:\\s?|-?)((?:1[0-5])|(?:0?\\d)))?$', 'i');
      var matches = search.match(reparse);
      var result = "";

      if (matches === null) {
        var searches = search.match(/^(\w{1,2})(\d{1,2})$/i);
        if (facenames.includes(search)) {
          for (var i = 1; i <= 16; i++) {
            result += '<span>' + search + (i>=10?i:('0' + i)) + '</span><br>';
          }
        } else if (searches !== null) {
          var num = searches[2]?parseInt(searches[2]):'';
          var word = searches[1]?searches[1]:'';
          for (var i = 0; i < codewords.length; i++) {
            result += '<span>' + word + (num>=10?num:'0'+num) + '-' + codewords[i] + '</span><br>';
          }
        }
      } else {
        var face = !matches[1]?currentregion[0]:matches[1];
        var facenum = matches[2]?parseInt(matches[2]):false;
        var region = !matches[3]?currentregion[1]:matches[3];
        var regionnum = matches[4]?parseInt(matches[4]):false;
        if (!regionnum) {
          for (var i = 0; i < 16; i++) {
            var res = face + (facenum?(facenum>=10?facenum:'0'+facenum):'') + '-' + region + '-' + (i>=10?i:('0'+i));
            result += '<a onclick="window.regionScoresAtRegion(\'' + res + '\')">' + res + '</a><br>';
          }
        } else {
          var res = face + (facenum?(facenum>=10?facenum:'0'+facenum):'') + '-' + region + '-' + (regionnum>=10?regionnum:('0' + regionnum));
          result = '<a onclick="window.regionScoresAtRegion(\'' + res + '\')">' + res + '</a><br>'
        }
      }

      $('.regionresults').html(result);
    }
  }

  window.regionSelector = function() {  
    var selectorhtml = '<input style="width:100%;" type="text" name="regionsearch" placeholder="search" onkeyup="window.regionSearch(event)"/>'
    +'<div style="overflow-y: scroll; height: 241px; padding-top: 5px;">'
    +'<div class="regionresults"></div>'
    +'<div> possible regions: '
    +codewords.reduce(function(html, word) { return html += ', ' + word; })
    +'</div></div>';
    var dlg = dialog({title:'Region selector',html:selectorhtml,width:300,minHeight:345});
  };

  var handleRegionClick = function(e) {
    $('.leaflet-container')[0].style.cursor = '';
    this.textContent = 'Select region from map';
    requestRegionScores(e.latlng);
    map.off('click', handleRegionClick, this);
  };

  window.regionClickSelector = function(ev) {
    var target = ev.target;  
    if ($('.leaflet-container')[0].style.cursor === 'crosshair') {
      ev.target.textContent = 'Select region from map';
      $('.leaflet-container')[0].style.cursor = '';
      map.off('click', handleRegionClick, target);
      return;
    }
    ev.target.textContent = 'click to cancel select from map';
    $('.leaflet-container')[0].style.cursor = 'crosshair';
    map.on('click', handleRegionClick, target);
  };
  // end of crazy region code

  function generateTeamScoreBars(data) {
    var maxAverage = Math.max(data.result.gameScore[0], data.result.gameScore[1], 1);
    var teamRow = [];
    for (var t=0; t<2; t++) {
      var team = t===0 ? 'Enlightened' : 'Resistance';
      var teamClass = t===0 ? 'enl' : 'res';
      var teamCol = t===0 ? COLORS[TEAM_ENL] : COLORS[TEAM_RES];
      var barSize = Math.round(data.result.gameScore[t]/maxAverage*200);
      teamRow[t] = '<tr><th class="'+teamClass+'">'
        +team+'</th><td class="'+teamClass+'">'
        +localedigits(data.result.gameScore[t])+'</td><td><div style="background:'
        +teamCol+'; width: '+barSize+'px; height: 1.3ex; border: 2px outset '
        +teamCol+'"> </td></tr>';
  
    }
    return teamRow;
  }

  function findScoreLead(history) {
    // the lead is the sum of the difference of each checkpoint
    var lead = history.map(function(cp) { return cp[1] - cp[2] }).reduce(function(acc, diff) { return acc + diff }, 0);
    var leadinfo = '<div style="padding-left: 5px;">';
    // res lead when we sum to a negative value
    if (lead < 0) {
      leadinfo += '<span class="res" style="font-weight: bold;">res lead: ' + localedigits(Math.abs(lead)) + 'mu</span></div>';
    } else {
      leadinfo += '<span class="enl" style="font-weight: bold;">enl lead: ' + localedigits(lead) + 'mu</span></div>';
    }
    return leadinfo;
  }
  
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
    
    var leadinfo = findScoreLead(data.result.scoreHistory);
  
    var first = PLAYER.team == 'RESISTANCE' ? 1 : 0;
    
    var teamBars = generateTeamScoreBars(data);
    // we need some divs to make the accordion work properly
    dlg.html('<div class="cellscore">'
           +'<b>Region scores for '+data.result.regionName+'</b>'
           +'<div><a title="Search region" onclick="window.regionSelector()">Search region</a> OR '// lets add the ability to select another region
           +'<a title="Click to select region" onclick="window.regionClickSelector(event)">Select region from map</a>'
           +'<table>'+teamBars[first]+teamBars[1-first]+'</table>'
           +leadinfo // stick our info under the score bars
           +regionScoreboardScoreHistoryChart(data.result, logscale)
           +'<div class="time-to-checkpoint">'+ formattedTimeToCheckpoint(nextCheckpoint()) +'</div></div>'
           +'<b>Checkpoint overview</b>'
           +'<div>'+regionScoreboardScoreHistoryTable(data.result)+'</div>'
           +'<b>Top agents</b>'
           +'<div>'+agentTable+'</div>'
           +'</div>');
      
    $('g.checkpoint', dlg).each(function(i, elem) {
      elem = $(elem);
  
      var tooltip = 'CP:\t'+elem.attr('data-cp')
        + '\nEnl:\t' + localedigits(elem.attr('data-enl'))
        + '\nRes:\t' + localedigits(elem.attr('data-res'))
        + '\nDiff:\t' + localedigits(Math.abs(elem.attr('data-res')-elem.attr('data-enl')));
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

  window.requestScore = function(latlng, success, fail) {
    window.postAjax('getRegionScoreDetails', {
      latE6:Math.round(latlng.lat*1E6),
      lngE6:Math.round(latlng.lng*1E6)}, 
      function(res){success(res);}, 
      function(){fail()});
  }

  window.sidebarScoreSuccess = function(data) {
    var teamBars = generateTeamScoreBars(data);
    var first = PLAYER.team == 'RESISTANCE' ? 1 : 0;
    $('#sidebarscore').html('<a onclick="window.regionScoreboard()" title="open detailed score info">\
      <b style="padding: 5px;">' + data.result.regionName + '</b></a>\
      <table>'+teamBars[first]+teamBars[1-first]+'</table>' + findScoreLead(data.result.scoreHistory));
  }

  window.sidebarScoreFailure = function() {
   $('#sidebarscore').html('score request failed... <a onclick="window.retrySidebarScores()">retry</a>'); 
  }

  window.retrySidebarScores = function() {
    requestScore(map.getCenter(), sidebarScoreSuccess, sidebarScoreFailure);
  }

  window.addHook('iitcLoaded', function() {
    $('#searchwrapper').before('<div id="sidebarscore" style="min-height:60px;">score loading...</div>');
    requestScore(map.getCenter(), sidebarScoreSuccess, sidebarScoreFailure);
    addHook('pluginRegionScores', function(event) {
      if (event.event !== 'checkpoint') return;
      requestScore(map.getCenter(), sidebarScoreSuccess, sidebarScoreFailure);
    });
    //listen for moveend, but only request if the new region is different than the old region
    var region = regionName(S2.S2Cell.FromLatLng(map.getCenter(),6));
    map.on('moveend', function() {
      if (region !== regionName(S2.S2Cell.FromLatLng(map.getCenter(),6)) && map.getZoom() > 8) {
        region = regionName(S2.S2Cell.FromLatLng(map.getCenter(),6));
        requestScore(map.getCenter(), sidebarScoreSuccess, sidebarScoreFailure);
      }
    });
  });
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
