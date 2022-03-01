'use strict';

/**
 * @ngdoc service
 * @name irpsimApp.Graph
 * @description
 * # Graph
 * Service in the irpsimApp.
 */
/*jslint bitwise: true */
angular.module('irpsimApp')
  .service('Graph', function ($rootScope, ScenarioDefinitions, ChartDefaultOptions) {
    var Graph = this;

    function str2hash(str){
      var hash = 0;
      for (var i = 0; i < str.length; ){
        hash = str.charCodeAt(i++) + ((hash << 5) - hash);
      }
      return hash;
    }

    // shapes
    function distinctColor(hash){
      var color = '#';
      for (var i = 0; i < 3; i++) {
        var value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).substr(-2);
      }
      return color;
    }

    var nodeWidth = 50;
    var strokeWidth = 4;

    var svg2URL = function(svgText){
      return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgText);
    };

    function makeSVGEmbeddable(svgText){
      var doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
      doc.rootElement.removeAttribute('width');
      doc.rootElement.removeAttribute('height');
      return new XMLSerializer().serializeToString(doc);
    }
    function inSVG(shapeScale, shapeElement, iconSVG){
      var xt = nodeWidth/shapeScale; // variable 2
      var sc = xt/2-nodeWidth/2;
      var prefix= '<svg xmlns="http://www.w3.org/2000/svg"'+
        ' width="' + nodeWidth +
        '" height="' + nodeWidth + '">';
      var body = '';
      if(shapeElement){
        body += '<g transform="translate('+nodeWidth/2+','+nodeWidth/2+')">'+shapeElement+'</g>';
      }
      if(shapeElement && iconSVG){
        body+='<g transform="scale('+ shapeScale +')translate('+sc+','+sc+')">' + iconSVG + '</g>';
      }else if(iconSVG){
        body+=iconSVG;
      }
      return prefix+body+'</svg>';
    }

    function regularPolygonCoordinates(n, radius){
      var coords = [];
      for (var i = 0; i < n; i++) {
        coords.push([radius * Math.cos(2 * Math.PI * i / n), radius * Math.sin(2 * Math.PI * i / n)]);
      }
      return coords;
    }

    function regularPolygon(n, radius){
      var res =_.reduce(regularPolygonCoordinates(n,radius), function(s,xy){
        return s+xy[0]+','+xy[1]+' ';
      },'M');
      return res+'Z';
    }

    function distance(a,b){
      return Math.sqrt(Math.pow(b[0]-a[0],2)+Math.pow(b[1]-a[1],2));
    }

    // polygon plus half circles on each side, either outwards or inwards
    function regularPolygonPlus(n, radius,isCCW){
      var coords = regularPolygonCoordinates(n,radius);
      var last = coords[coords.length - 1], crnt;
      var segmentLen = distance(coords[0],coords[1]);
      var res = 'M'+last[0]+','+last[1];
      for (var i = 0; i < coords.length; i++) {
        crnt = coords[i];
        res+='A'+(segmentLen / 2)+','+(segmentLen / 2)+',0,0,'+(isCCW?0:1)+','+crnt[0]+','+crnt[1]+' ';
        last = crnt;
      }
      return res+'Z';
    }

    function svgShape(shapeName, style){
      var close = '" style="'+style+'"/>';
      var content;
      var halfDiagonal = Math.sqrt(2*nodeWidth*nodeWidth) / 2;
      var r = nodeWidth / 2 - strokeWidth;
      switch(shapeName) {
        case 'warning':
        case 'triangle-up':
          content='<path transform="rotate(90)" d="'+regularPolygon(3,r);
          break;
        case 'triangle':
        case 'triangle-down':
          content='<path transform="rotate(-90)" d="'+regularPolygon(3,r);
          break;
        case 'pentagon':
          content='<path transform="rotate(-90)" d="'+regularPolygon(5,r);
          break;
        case 'hexagon':
          content='<path d="'+regularPolygon(6,r);
          break;
        case 'octagon':
          content='<path d="'+regularPolygon(8,r);
          break;
        case 'gear':
          content='<path d="'+regularPolygonPlus(14,r,true);
          break;
        case 'flower':
          content='<path d="'+regularPolygonPlus(14,r-nodeWidth/10,false);
          break;
        case 'rectangle':
          var scale = 1.61;
          content = '<rect transform="translate(0,'+r/2/scale+')" x="'+(-r)+'" y="'+(-r)+'" width="'+ (nodeWidth-1)+'" height="'+(nodeWidth-1)/scale;
          break;
        case 'circle':
          content='<ellipse cx="0" cy="0" rx="'+ (r) +'" ry="'+ (r);
          break;
        case 'ellipse':
          content='<ellipse cx="0" cy="0" rx="' + (nodeWidth/2 - 1) + '" ry="' + (nodeWidth/3-1);
          break;
        case 'diamond':
          content='<path d="'+regularPolygon(4,r);
          break;
        case 'square':
          content='<path transform="rotate(45)" d="'+regularPolygon(4,halfDiagonal);
          break;
        default:
          var l = nodeWidth/6;
          content = '<path  transform="rotate(45)" d="M' + -3 * l + ',' + -l + 'H' + -l + 'V' + -3 * l + 'H' + l + 'V' + -l + 'H' + 3 * l + 'V' + l + 'H' + l + 'V' + 3 * l + 'H' + -l + 'V' + l+ 'H' + -3 * l + 'Z';
      }
      return content+close;
    }

    var shapeScales = {
      'triangle-up': 0.32,
      'triangle-down': 0.32,
      'pentagon': 0.6,
      'hexagon': 0.6,
      'octagon': 0.6,
      'gear': 0.5,
      'flower': 0.6,
      'rectangle':0.6,
      'square': 0.6,
      'circle': 0.6,
      'ellipse': 0.5,
      'diamond': 0.5
    };
    var shapeNames = _.keys(shapeScales);

    /**
     * Find all leaf subsets of set 'setName'. Leaf subsets are GAMS sets that do not comprise other sets.
     * @param {String} modelType type of the current GAMS model
     * @param {String} setName name of the parent set
     */
    function getLeafSubsets(modelType, setName, subModelDefinition){
      var parentDefinition = ScenarioDefinitions.getDefinition(modelType, subModelDefinition, 'sets', setName);
      return _(parentDefinition.subsets)
        .map(function(n){ return ScenarioDefinitions.getDefinition(modelType, subModelDefinition, 'sets', n);})
        .filter(function(obj){ return _.isEmpty(obj.subsets);})
        .value();
    }
    /**
     * @param {String} modelType type of model we are currently using
     * @param {String} setName name of the parent set
     * @param {String} elementName name of an element in the parent set
     * @param {String} nodeAttribute the subset should have this attribute defined, specifies the node shape/color we are looking for
     * @returns {string}
     */
    function lookupSubsetAttribute(modelType, scenario, setName, elementName, nodeAttribute, groups, legend){
      // identify the leaf subset `elementName` is in, then lookup the `attribute` from its definition
      var res = [];
      var subModelDefinition = scenario.config.modeldefinition;
      _.each(getLeafSubsets(modelType, setName, subModelDefinition), function(subsetDefinition){
        var subsetName = subsetDefinition.name;
        // is this a leaf set that contains our element?
        if(scenario.sets[subsetName].values[elementName]) {
          // this subset contains the element of interest
          var attributes = _.find(groups, function(group){ return _.includes(group.sets, subsetName); }) || subsetDefinition;
          var attr = attributes[nodeAttribute];
          if (attr) {
            var label = attributes.label || attributes.identifier;
            res.push(attr);
            var prevTitle = _.get(legend, [nodeAttribute, label, 'title']);
            var newTitle = (prevTitle ? prevTitle + ' / ' : '') + subsetDefinition.name
            _.set(legend,[nodeAttribute, label],
              {label: label,
               value: attr,
               title: newTitle});
          }
        }
      });
      return validatedAttribute(nodeAttribute,res);
    }

    var errorIconName = '__internal_error_icon';
    var errorIcon='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 438.5 438.5"><path d="M409.1 109.2c-19.6-33.6-46.2-60.2-79.8-79.8C295.7 9.8 259.1 0 219.3 0c-39.8 0-76.5 9.8-110.1 29.4 -33.6 19.6-60.2 46.2-79.8 79.8C9.8 142.8 0 179.5 0 219.3c0 39.8 9.8 76.5 29.4 110.1 19.6 33.6 46.2 60.2 79.8 79.8 33.6 19.6 70.3 29.4 110.1 29.4s76.5-9.8 110.1-29.4c33.6-19.6 60.2-46.2 79.8-79.8 19.6-33.6 29.4-70.3 29.4-110.1C438.5 179.5 428.7 142.8 409.1 109.2zM387.4 290.2c-9.7 22.6-22.7 42-39 58.2 -16.3 16.3-35.7 29.3-58.2 39 -22.6 9.7-46.2 14.6-70.9 14.6 -24.7 0-48.4-4.9-70.9-14.6 -22.6-9.7-42-22.7-58.2-39 -16.3-16.3-29.3-35.7-39-58.2 -9.7-22.6-14.6-46.2-14.6-70.9 0-24.7 4.9-48.4 14.6-70.9 9.7-22.6 22.7-42 39-58.2 16.3-16.3 35.7-29.3 58.2-39 22.6-9.7 46.2-14.6 70.9-14.6 24.7 0 48.4 4.9 70.9 14.6 22.6 9.7 42 22.7 58.2 39 16.3 16.3 29.3 35.7 39 58.2 9.7 22.6 14.6 46.2 14.6 70.9C402 244 397.1 267.7 387.4 290.2z"/><path d="M284.4 258.7c-19.2-14.1-40.9-21.1-65.1-21.1 -24.2 0-45.9 7-65.1 21.1 -19.2 14.1-32.4 32.6-39.4 55.7 -1.5 4.8-1.1 9.4 1.1 13.8 2.3 4.5 5.9 7.5 10.9 9 4.8 1.5 9.4 1.1 13.8-1.1 4.5-2.3 7.5-5.9 9-10.8 4.8-15.2 13.6-27.6 26.4-37 12.8-9.4 27.3-14.1 43.3-14.1 16 0 30.4 4.7 43.3 14.1 12.9 9.4 21.7 21.7 26.4 37 1.5 4.9 4.6 8.6 9.1 10.8 4.6 2.3 9.2 2.7 14 1.1 4.8-1.5 8.3-4.5 10.6-9 2.3-4.5 2.7-9.1 1.1-13.8C316.7 291.3 303.6 272.8 284.4 258.7z"/><path d="M146.2 182.7c10.1 0 18.7-3.6 25.8-10.7 7.1-7.1 10.7-15.7 10.7-25.8 0-10.1-3.6-18.7-10.7-25.8s-15.8-10.7-25.8-10.7c-10.1 0-18.7 3.6-25.8 10.7 -7.1 7.1-10.7 15.7-10.7 25.8 0 10.1 3.6 18.7 10.7 25.8C127.5 179.2 136.1 182.7 146.2 182.7z"/><path d="M292.4 109.6c-10.1 0-18.7 3.6-25.8 10.7 -7.1 7.1-10.7 15.7-10.7 25.8 0 10.1 3.6 18.7 10.7 25.8 7.1 7.1 15.8 10.7 25.8 10.7 10.1 0 18.7-3.6 25.8-10.7 7.1-7.1 10.7-15.7 10.7-25.8 0-10.1-3.6-18.7-10.7-25.8S302.4 109.6 292.4 109.6z"/></svg>';
    /**
     * Validate node attributes found. Should be exactly one. If more or
     * less than that, return a signal color/shape.
     * @param {String} nodeAttribute name/type of the node attribute
     * @param {Array[String]} res options found, should be exactly one.
     * @returns {*}
     */
    function validatedAttribute(nodeAttribute, res){
      if(!res || res.length === 0 || res.length > 1){
        switch(nodeAttribute){
          case 'fill': return 'red';
          case 'border': return 'red';
          case 'shape': return 'error';
          case 'icon': return errorIconName;
          default:
            throw new Error('Unknown graphe node property type: '+ nodeAttribute);
        }
      }else{
        return res[0];
      }
    }

    function getDefaultNodeAttribute(nodeAttribute){
      switch(nodeAttribute){
        case 'fill': return 'white';
        case 'border': return 'black';
        case 'shape': return 'circle';
        case 'icon': return null;
        default:
          throw new Error('Unknown graph node property type: '+ nodeAttribute);
      }
    }

    function mapAttribute(string, nodeAttribute){
      var colors = ChartDefaultOptions.colors;
      var hash = Math.abs(str2hash(string)); // negative values lead to negative array indices
      switch(nodeAttribute){
        case 'shape':
          return shapeNames[hash % shapeNames.length];
        case 'fill':
        case 'border':
          return colors[hash % colors.length];
        case 'icon':
          return null;
        default:
          throw new Error('Unknown graph node property type: '+nodeAttribute);
      }
    }
    /**
     *
     * @param {String} modelType type of model we are currently using
     * @param {String} tableName name of the table parameter
     * @param {Object} table table element from the scenario
     * @param {String} setName name of the parent set, all nodes are derived from it
     * @param {String} elementName name of the current node element in the parent set
     * @param {String} nodeAttribute attribute
     * @returns {string}
     */
    function lookupTableAttribute(scenario, elementName, nodeAttribute, tableNames, legend){
      var res = [];
      _.forEach(tableNames, function(tableName) {
        var table = scenario.tables[tableName].value;
        _.forOwn(table, function (row, key) {
          if (key === elementName) {
            _.forOwn(row, function (v, key2) {
              if (v.value === true) {
                var value = mapAttribute(key2,nodeAttribute);
                res.push(value);
                _.set(legend,[nodeAttribute, key2],{title: tableName, value: value});
              }
            });
          } else if (row[elementName] && row[elementName].value === true) {
            var value = mapAttribute(key,nodeAttribute);
            res.push(value);
            _.set(legend,[nodeAttribute, key],{title: tableName, value: value});
          }
        });
      });
      return validatedAttribute(nodeAttribute, res);
    }

    function lookupNodeAttribute(modelType, scenario, elementName, nodesSet, spec, nodeAttribute, legend){
      if(!spec){
        return validatedAttribute(nodeAttribute,[getDefaultNodeAttribute(nodeAttribute)]);
      }
      switch(spec.type){
        case 'fix':
          // fixed values are just a visual setting, they cary no semantics, so we don't need a legend entry for them
          return spec.value;
        case 'parameter':
          var tableNames = spec.value;
          return lookupTableAttribute(scenario, elementName, nodeAttribute, tableNames, legend);
        case 'subsets':
          return lookupSubsetAttribute(modelType, scenario, nodesSet, elementName, nodeAttribute, spec.groups, legend);
        default:
          // something went wrong, we don't know the type of attribute
          throw new Error('Don\'t know how to handle node attribute:', nodesSet, spec, nodeAttribute);
      }
    }

    function maybeLoadEmbeddableSVG(modelType, iconRef, subModelDefinition) {
      var svg = iconRef === errorIconName? errorIcon : ScenarioDefinitions.getIcons(modelType, subModelDefinition)[iconRef];
      if(svg){
        var start = svg.indexOf('<svg');
        return makeSVGEmbeddable(svg.substring(start));
      }
    }

    // function findEdgeColor(modelType, tableName) {
    //   var tableDef = ScenarioDefinitions.getDefinition(modelType, modelType, 'tables', tableName);
    //   if(tableDef && tableDef.color){
    //     return tableDef.color;
    //   }else {
    //     return distinctColor(str2hash(tableName));
    //   }
    // }

    function createNodeImage(settings){
      var shapeScale = shapeScales[settings.shape] || 0.32; // scale factor
      return svg2URL(inSVG(shapeScale, svgShape(settings.shape, 'fill:'+settings.fill+';stroke:'+settings.border+';stroke-width: '+strokeWidth), settings.icon));
    }

    function createNetwork(modelType, scenario, graphSpec){
      /* shape of graphspec:
        {
          edges: {'groups': [{'parameters':['par_X_NS_Egrid_DSEenergyLink','par_X_NS_Ggrid_DSGenergyLink', 'par_X_NS_Wgrid_DSWenergyLink'],
                              'label':'....',
                              'color': '#CAFE01'}],
                   'heading': '....'},
          nodes: {
            set: 'set_pss',
            where: 'par_X_pss_model'
            fill:   {type: 'parameter', value: ['par_OH_MS_market_side']},
            border: {type: 'fix', value: '#CAFE12'},
            shape:  {type: 'subsets', 'groups': [...]}, // shape is implicit, depends on containment in subset of the 'nodes.set' set
            icon: null // only subsets or fix!
          }
      }*/
      var setName = graphSpec.nodes.set;
      var namesSet = scenario.sets[setName].names.slice();
      var subModelDefinition = scenario.config.modeldefinition;
      if(graphSpec.nodes.where){
        // boolean parameter, single dependency on our nodes set
        namesSet = _.filter(namesSet,function(name){
          return scenario.sets[graphSpec.nodes.set].values[name][graphSpec.nodes.where].value;
        });
      }
      var legend = {};
      var edges = _(graphSpec.edges.groups)
        .map(function(edgeSpec){
          return _.map(edgeSpec.parameters, function(parameterName){
            var table = scenario.tables[parameterName].value;
            return _.map(table,function(v, n1){
              if(_.contains(namesSet,n1)){
                return _.map(v, function (v, n2) {
                  if (_.contains(namesSet,n2) && _.isBoolean(v.value)) {
                    if (v.value === true) {
                      var label = edgeSpec.label || '!!! Label fehlt !!!';
                      var color = edgeSpec.color || 'black';
                      var prevLegendTitle = _.get(legend, ['edges',label,'title']);
                      var newLegendTitle = prevLegendTitle?prevLegendTitle+' / '+parameterName : parameterName;
                      _.set(legend,['edges', label],{label: label, title: newLegendTitle, value: color});
                      return {
                        from: n1,
                        to: n2,
                        arrows: 'to',
                        color: {color: color},
                        title: ScenarioDefinitions.getDefinition(modelType, subModelDefinition, 'tables', parameterName).identifier + ' (' + parameterName + ')'
                      };
                    }
                  }
                });
              }
            });
          });
        })
        .flatten(true)
        .compact()
        .value();
      // if we are told to hide unconnected nodes, only show nodes that have at least one edge
      if(graphSpec.nodes['hide-single?']){
        namesSet = _.uniq(_.map(edges,'from').concat(_.map(edges,'to')));
      }
      var nodes = [];
      for (var i = 0; i < namesSet.length; i++) {
        var s = namesSet[i];
        var fill = lookupNodeAttribute(modelType, scenario, s, setName, graphSpec.nodes.fill,'fill', legend);
        var stroke = lookupNodeAttribute(modelType, scenario, s, setName, graphSpec.nodes.border,'border', legend);
        var shape = lookupNodeAttribute(modelType, scenario, s, setName, graphSpec.nodes.shape,'shape', legend);
        var iconRef = lookupNodeAttribute(modelType, scenario, s, setName, graphSpec.nodes.icon,'icon', legend);
        var icon = maybeLoadEmbeddableSVG(modelType,iconRef, subModelDefinition);

        var allSubsetDefinitions = getLeafSubsets(modelType, setName, subModelDefinition);

        var node = {
          id: s,
          label: s,
          title: _.result(_.find(allSubsetDefinitions, function(d){ return scenario.sets[d.name].values[s]; }), 'name'),
          shape: 'image',
          image: null,
          _visuals: {
            icon:icon,
            fill: fill,
            border: stroke,
            shape: shape
          }
        };
        node.image = createNodeImage(node._visuals);
        nodes.push(node);
      }

      var state = {
        nodes: new vis.DataSet(nodes),
        edges: new vis.DataSet(edges),
        legend: legend,
        spec: graphSpec
      };

     return state;
    }
    function getIconDataURL(modelType, iconName, subModelDefinition){
      var icon = iconName === errorIconName ? errorIcon : ScenarioDefinitions.getIcons(modelType, subModelDefinition)[iconName];
      return svg2URL(icon);
    }

    function getShapeDataURL(shapeName){
      var shapeScale = shapeScales[shapeName] || 0.32;
      return svg2URL(inSVG(shapeScale, svgShape(shapeName, 'fill: white;stroke:black;stroke-width:2')));
    }
    function toggle(state, type){
      if(type === 'edgeColor'){
        state.edges.forEach(function(edge){
          if(edge.color._color){
            edge.color.color = edge.color._color;
            delete edge.color._color;
          }else{
            edge.color._color = edge.color.color;
            edge.color.color = 'black';
          }
          state.edges.update(edge);
        });
      }else{
        var saved = '_'+type;
        state.nodes.forEach(function(node){
          var s = node._visuals;
          if(s[saved]){
            s[type] = s[saved];
            delete s[saved];
          }else{
            s[saved] = s[type];
            s[type] = getDefaultNodeAttribute(type);
          }
          // recreate node image
          node.image = createNodeImage(node._visuals);
          state.nodes.update(node);
        });
      }
    }

    Graph.createNetwork = createNetwork;
    Graph.getIconDataURL = getIconDataURL;
    Graph.getShapeDataURL = getShapeDataURL;
    Graph.getDefaultValue = validatedAttribute;
    Graph.toggle = toggle;
  });
