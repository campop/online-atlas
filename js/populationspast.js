// Populationspast application code

/*jslint browser: true, white: true, single: true, for: true */
/*global alert, console, window, $, jQuery, L, autocomplete, vex */

var populationspast = (function ($) {
	
	'use strict';
	
	// Internal class properties
	var _baseUrl;
	var _layer = null;
	var _field = null;	// E.g. TMFR, TFR, etc.
	var _currentZoom = null;
	var _zoomedOut = null;	// Boolean for whether the map is zoomed out 'too far'
	var _legendHtml = null;	// Legend HTML content
	var _summary = null;
	var _defaultLineWeight = 1;
	
	// Settings
	var _settings = {
		
		// Default map view
		defaultLatitude: 53.035,
		defaultLongitude: -1.082,
		defaultZoom: 7,
		
		// Tileservers; historical map sources are listed at: http://wiki.openstreetmap.org/wiki/National_Library_of_Scotland
		tileUrls: {
			'bartholomew': [
				'https://geo.nls.uk/mapdata2/bartholomew/great_britain/{z}/{x}/{-y}.png',	// E.g. http://geo.nls.uk/mapdata2/bartholomew/great_britain/12/2046/2745.png
				{maxZoom: 15, attribution: '&copy; <a href="http://maps.nls.uk/copyright.html">National Library of Scotland</a>', 'backgroundColour': '#a2c3ba'},
				'NLS - Bartholomew Half Inch, 1897-1907'
			],
			'os6inch': [
				'https://geo.nls.uk/maps/os/1inch_2nd_ed/{z}/{x}/{-y}.png',	// E.g. http://geo.nls.uk/maps/os/1inch_2nd_ed/12/2046/2745.png
				{maxZoom: 15, attribution: '&copy; <a href="http://maps.nls.uk/copyright.html">National Library of Scotland</a>', 'backgroundColour': '#f0f1e4'},
				'NLS - OS 6-inch County Series 1888-1913'
			],
			'mapnik': [
				'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',	// E.g. http://a.tile.openstreetmap.org/16/32752/21788.png
				{maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'},
				'OpenStreetMap style (modern)'
			],
			'osopendata': [
				'https://{s}.os.openstreetmap.org/sv/{z}/{x}/{y}.png',	// E.g. http://a.os.openstreetmap.org/sv/18/128676/81699.png
				{maxZoom: 19, attribution: 'Contains Ordnance Survey data &copy; Crown copyright and database right 2010'},
				'OS Open Data (modern)'
			]
		},
		
		// Geocoder
		geocoderApiBaseUrl: 'https://api.cyclestreets.net/v2/geocoder',
		geocoderApiKey: 'YOUR_API_KEY',		// Obtain at https://www.cyclestreets.net/api/apply/
		autocompleteBbox: '-6.6577,49.9370,1.7797,57.6924',
		
		// Dataset years
		datasets: [1851, 1861, 1881, 1891, 1901, 1911],
		
		// Fields and their labels
		fields: {},		// Will be supplied from the database
		
		// Map geometry colours; colour scales can be created at http://www.colorbrewer.org/
		colourStops: [
			'#4575b5',	// Blue - least
			'#849eb9',
			'#c0ccbe',
			'#ffffbf',	// Yellow
			'#fab884',
			'#ed7552',
			'red'		// Red - most
		]
	};
	
	
	
	// Functions
	return {
		
		// Entry point
		initialise: function (config, baseUrl)
		{
			// Obtain the configuration and add to settings
			$.each (config, function (key, value) {
				_settings[key] = value;
			});
			
			// Parse out the intervals in each field into an array, for use as colour stops
			$.each (_settings.fields, function (field, value) {
				if (typeof value.intervals == 'string') {
					_settings.fields[field].intervals = value.intervals.split(', ');
				}
			});
			
			// Obtain the base URL
			_baseUrl = baseUrl;
			
			// Create the map panel and associated controls
			populationspast.mapUi ('map');
		},
		
		
		// Main function to create a map panel
		mapUi: function (divId)
		{
			// Create a map UI collection object
			var mapUi = {};
			
			// Create the map
			mapUi.map = populationspast.createMap (divId);
			
			// Create the location overlay pane
			populationspast.createPane (mapUi.map);
			
			// Show first-run welcome message if the user is new to the site
			populationspast.welcomeFirstRun ();
			
			// Determine the active field, and create a handler for changes
			_field = populationspast.getField ();
			$('form#field input[type="radio"]').on('change', function() {
				_field = populationspast.getField ();
			});
			
			// Create the legend for the current field, and update on changes
			populationspast.createLegend (mapUi.map, _field);
			$('form#field input[type="radio"]').on('change', function() {
				populationspast.setLegend (_field);
			});
			
			// Register an summary box control
			populationspast.summaryControl (mapUi.map);
			$('form#field input[type="radio"]').on('change', function() {
				_summary.update (_field, null);
			});
			
			// Add the data via AJAX requests
			populationspast.getData (mapUi.map);
			
			// Register to refresh data on map move
			mapUi.map.on ('moveend', function (e) {
				populationspast.getData (mapUi.map);
			});
			
			// Register to refresh data on any form field change
			$('form#field :input').on('change', function() {
				populationspast.getData (mapUi.map);
			});
			
			// Add tooltips to the forms
			populationspast.tooltips ();
			
			// Register a dialog dialog box handler, giving a link more information
			populationspast.moreDetails ();
		},
		
		
		// Function to determine the field from the form value
		getField: function ()
		{
			return $('form#field input[type="radio"]:checked').val();
		},
		
		
		// Function to create the map
		createMap: function (divId)
		{
			// Add the tile layers
			var tileLayers = [];		// Background tile layers
			var baseLayers = {};		// Labels, by name
			var baseLayersById = {};	// Layers, by id
			var layer;
			var name;
			$.each (_settings.tileUrls, function (tileLayerId, tileLayerAttributes) {
				layer = L.tileLayer(tileLayerAttributes[0], tileLayerAttributes[1]);
				tileLayers.push (layer);
				name = tileLayerAttributes[2];
				baseLayers[name] = layer;
				baseLayersById[tileLayerId] = layer;
			});
			
			// Create the map
			var map = L.map(divId, {
				center: [_settings.defaultLatitude, _settings.defaultLongitude],
				zoom: _settings.defaultZoom,
				layers: tileLayers[0]	// Documentation suggests tileLayers is all that is needed, but that shows all together
			}).setActiveArea('activearea');
			
			// Set a class corresponding to the map tile layer, so that the background can be styled with CSS
			populationspast.setMapBackgroundColour (tileLayers[0].options);
			map.on('baselayerchange', function(e) {
				populationspast.setMapBackgroundColour (baseLayers[e.name].options);
			});
			
			// Set the zoom and determine whether the map is zoomed out too far, and set the mouse cursor
			_currentZoom = map.getZoom();
			_zoomedOut = (_settings.defaultZoom <= _settings.zoomedOut);
			map.on('zoomend', function() {
				_currentZoom = map.getZoom();
				_zoomedOut = (_currentZoom <= _settings.zoomedOut);
			});
			
			// Set mouse cursor based on zoom status
			$('#map').css('cursor', (_zoomedOut ? 'zoom-in' : 'auto'));
			
			// Zoom in on single click if zoomed out
			 map.on ('click', function (e) {
				if (_zoomedOut) {
					map.setZoomAround (e.latlng, (_settings.zoomedOut + 1));
				}
			});
			
			// Add the base (background) layer switcher
			L.control.layers(baseLayers, null, {position: 'bottomright'}).addTo(map);
			
			// Add geocoder control
			populationspast.geocoder (map);
			
			// Add hash support
			new L.Hash (map, baseLayersById);
			
			// Add full screen control
			map.addControl(new L.Control.Fullscreen({pseudoFullscreen: true}));
			
			// Add geolocation control
			L.control.locate().addTo(map);
			
			// Return the map
			return map;
		},
		
		
		// Function to set the map background colour for a layer
		setMapBackgroundColour: function (tileLayerOptions)
		{
			// Set, using jQuery, if specified, or clear
			var backgroundColour = (tileLayerOptions.backgroundColour ? tileLayerOptions.backgroundColour : '');
			$('.leaflet-container').css ('background-color', backgroundColour);
		},
		
		
		// Wrapper function to add a geocoder control
		geocoder: function (map)
		{
			// Attach the autocomplete library behaviour to the location control
			autocomplete.addTo ('#geocoder input', {
				sourceUrl: _settings.geocoderApiBaseUrl + '?key=' + _settings.geocoderApiKey + '&bounded=1&bbox=' + _settings.autocompleteBbox,
				select: function (event, ui) {
					var bbox = ui.item.feature.properties.bbox.split(',');
					map.fitBounds([ [bbox[1], bbox[0]], [bbox[3], bbox[2]] ]);
					event.preventDefault();
				}
			});
		},
		
		
		// Function to create a location overlay pane; see: http://leafletjs.com/examples/map-panes/
		createPane: function (map)
		{
			// Create a pane
			map.createPane('labels');
			map.getPane('labels').style.zIndex = 650;
			map.getPane('labels').style.pointerEvents = 'none';
			
			// Create a labels layer; see: https://carto.com/location-data-services/basemaps/
//			var locationLabels = L.tileLayer('http://tiles.oobrien.com/shine_labels_cdrc/{z}/{x}/{y}.png', {
			var locationLabels = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_only_labels/{z}/{x}/{y}.png', {
				attribution: '&copy; OpenStreetMap, &copy; CartoDB',
				pane: 'labels'
			})
			
			// Add to the map
			locationLabels.addTo(map);
		},
		
		
		// Function to show a welcome message on first run
		welcomeFirstRun: function ()
		{
			// End if cookie already set
			var name = 'welcome';
			if (Cookies.get(name)) {return;}
			
			// Set the cookie
			Cookies.set(name, '1', {expires: 14});
			
			// Define a welcome message
			var message =
			   '<p><strong>Welcome to Populations Past, from CAMPOP</strong></p>'
			 + '<p>Populationspast.org, the Atlas of Victorian and Edwardian Population, enables you to explore demographic changes from 1851-1911.</p>'
			 + '<p>Please note that various improvements are still being made to the site.</p>';
			
			// Show the dialog
			vex.dialog.alert ({unsafeMessage: message});
		},
		
		
		// Handler for a more details popup layer
		moreDetails: function ()
		{
			// Create popup when link clicked on
			$('.moredetails').click (function (e) {
				
				// Obtain the field
				var field = $(this).attr('data-field');
				
				// Obtain the content; see: https://stackoverflow.com/a/14744011/180733 and https://stackoverflow.com/a/25183183/180733
				var dialogBoxContentHtml = $('#aboutfields').find('h3#' + field).nextUntil('h3').addBack().map(function() {
					return this.outerHTML;
				}).get().join('');
				if (!dialogBoxContentHtml) {
					dialogBoxContentHtml = '<p><em>Sorry, no further details for this field available yet.</em></p>';
				}
				
				// Create the dialog box
				populationspast.dialogBox ('#moredetails', _field, dialogBoxContentHtml);
				
				// Prevent link
				e.preventDefault ();
			});
		},
		
		
		// Dialog box
		dialogBox: function (triggerElement, name, html)
		{
			html = '<div id="moredetailsbox">' + html + '</div>';
			vex.dialog.buttons.YES.text = 'Close';
			vex.dialog.alert ({unsafeMessage: html, showCloseButton: true, className: 'vex vex-theme-plain wider'});
		},
		
		
		// Function to add data to the map via an AJAX API call
		getData: function (map)
		{
			// Start API data parameters
			var apiData = {};
			
			// Supply the bbox and zoom
			apiData.bbox = map.getBounds().toBBoxString();
			apiData.zoom = _currentZoom;
			
			// Set the field, based on the radiobutton value
			apiData.field = _field;
			
			// Set the year, based on the slider value
			var yearIndex = $('form input#year').val();
			apiData.year = _settings.datasets[yearIndex];
			
			// Start spinner, initially adding it to the page
			if (!$('#loading').length) {
				$('#mapcontainer').append('<img id="loading" src="' + _baseUrl + '/images/spinner.svg" />');
			}
			$('#loading').show();
			
			// Fetch data
			$.ajax({
				url: _baseUrl + '/api/locations',
				dataType: (populationspast.browserSupportsCors () ? 'json' : 'jsonp'),		// Fall back to JSON-P for IE9
				crossDomain: true,	// Needed for IE<=9; see: https://stackoverflow.com/a/12644252/180733
				data: apiData,
				error: function (jqXHR, error, exception) {
					
					// Show error, unless deliberately aborted
					if (jqXHR.statusText != 'abort') {
						var data = $.parseJSON(jqXHR.responseText);
						alert ('Error: ' + data.error);
					}
				},
				success: function (data, textStatus, jqXHR) {
					
					// Remove spinner
					$('#loading').hide();
					
					// Show API-level error if one occured
					// #!# This is done here because the API still returns Status code 200
					if (data.error) {
						populationspast.removeLayer (map);
						vex.dialog.alert ('Error: ' + data.error);
						return {};
					}
					
					// Show the data successfully
					populationspast.showCurrentData(map, data);
				}
			});
		},
		
		
		// Function to show the data for a layer
		showCurrentData: function (map, data)
		{
			// If this layer already exists, remove it so that it can be redrawn
			populationspast.removeLayer (map);
			
			// Define the data layer
			_layer = L.geoJson(data, {
				onEachFeature: populationspast.onEachFeature,
				style: populationspast.setStyle,
				interactive: (!_zoomedOut)
			});
			
			// Add to the map
			_layer.addTo(map);
			
		},
		
		
		// Helper function to enable fallback to JSON-P for older browsers like IE9; see: https://stackoverflow.com/a/1641582
		browserSupportsCors: function ()
		{
			return ('withCredentials' in new XMLHttpRequest ());
		},
		
		
		// Function to remove the data layer
		removeLayer: function (map)
		{
			// Remove the layer, checking first to ensure it exists
			if (_layer) {
				map.removeLayer (_layer);
			}
		},
		
		
		// Function to set the feature style
		setStyle: function (feature)
		{
			// Base the colour on the specified colour field
			var style = {
				fillColor: populationspast.getColour (feature.properties[_field], _field),
				weight: (_zoomedOut ? 0 : _defaultLineWeight),
				fillOpacity: 0.7
			};
			
			// Return the style
			return style;
		},
		
		
		// Assign colour from lookup table
		getColour: function (value, field)
		{
			// Create a simpler variable for the intervals field
			var intervals = _settings.fields[field].intervals;
			
			// If the intervals is an array, i.e. standard list of colour stops, loop until found
			if (intervals[0]) {		// Simple, quick check
				
				// Loop through each colour downwards until found
				var interval;
				for (var i = intervals.length; i >= 0; i--) {
					interval = intervals[i];
					if (value >= interval) {
						return _settings.colourStops[i];
					}
				}
				
				// Fall back to final colour in the list
				return _settings.colourStops[0];
				
			// For pure key-value pair objects, read the value off
			} else {
				return intervals[value];
			}
		},
		
		
		// Feature wrapper, handling popups and highlighting
		onEachFeature: function (feature, layer)
		{
			// Highlight features on hover; see: http://leafletjs.com/examples/choropleth/
			layer.on({
				mouseover: populationspast.highlightFeature,
				mouseout: populationspast.resetHighlight
			});
			
			// Enable popups (if close enough)
			if (!_zoomedOut) {
				var popupHtml = populationspast.popupHtml (feature);
				layer.bindPopup(popupHtml, {autoPan: false});
			}
		},
		
		
		// Function to highlight a feature
		highlightFeature: function (e)
		{
			var layer = e.target;
			layer.setStyle({
				weight: 4
			});
			
			if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
				layer.bringToFront();
			}
			
			// Update the summary box
			_summary.update (_field, layer.feature);
		},
		
		
		// Function to reset highlighting
		resetHighlight: function (e)
		{
			// Reset the style; NB can't use resetStyle (e.target) as that requires a handle to the layer, which would need to be a global properly
			var layer = e.target;
			layer.setStyle({
				weight: _defaultLineWeight
			});
			
			// Update the summary box
			_summary.update (_field, null);
		},
		
		
		// Function to define popup content
		popupHtml: function (feature /*, dataset */)
		{
			// Start with the title
			var html = '<p><strong>Displayed data for ' + feature.properties['SUBDIST'] + ', ' + feature.properties['REGDIST'] + /* ' in ' + _settings.datasets[dataset].name + */ ':</strong></p>';
			
			// Add table
			html += '<table id="chart" class="lines compressed">';
			$.each (feature.properties, function (field, value) {
				if (typeof value == 'string') {
					value = populationspast.htmlspecialchars (value);
				}
				html += '<tr class="' + field + '"><td>' + populationspast.htmlspecialchars (_settings.fields[field].label) + ':</td><td><strong>' + value + '</strong></td></tr>';
			});
			html += '</table>';
			
			// Return the HTML
			return html;
		},
		
		
		// Function to make data entity-safe
		htmlspecialchars: function (string)
		{
			return string.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		},
		
		
		// Function to make first character upper-case; see: https://stackoverflow.com/a/1026087/180733
		ucfirst: function (string)
		{
			return string.charAt(0).toUpperCase() + string.slice(1);
		},
		
		
		// Function to define summary box content
		summaryHtml: function (field, feature)
		{
			// Assemble the HTML
			var html = '<p>' + populationspast.htmlspecialchars (feature.properties['SUBDIST']) + ', in ' + feature.properties['year'] + ': <strong>' + feature.properties[field] + '</strong></p>';
			
			// Return the HTML
			return html;
		},
		
		
		// Function to create and update the legend
		createLegend: function (map, field)
		{
			// Affix the legend
			var legend = L.control({position: 'bottomleft'});
			
			// Define its contents
			legend.onAdd = function () {
				return L.DomUtil.create ('div', 'info legend');
			};
			
			// Add to the map
			legend.addTo(map);
			
			// Set the initial value
			populationspast.setLegend (field);
		},
		
		
		
		// Function to set the legend contents
		setLegend: function (field)
		{
			// If the intervals is an array, i.e. standard list of colour stops, loop until found
			var labels = [];
			var intervals = _settings.fields[field].intervals;
			if (intervals[0]) {		// Simple, quick check
				
				// Loop through each colour until found
				var from;
				var to;
				for (var i = 0; i < intervals.length; i++) {
					from = intervals[i];
					to = intervals[i + 1];
					labels.push('<i style="background:' + _settings.colourStops[i] + '"></i> ' + from + (to ? '&ndash;' + to : '+'));
				}
				labels = labels.reverse();	// Legends should be shown highest first
			} else {
				$.each (intervals, function (key, colour) {
					labels.push('<i style="background:' + colour + '"></i> ' + populationspast.htmlspecialchars (populationspast.ucfirst (key)));
				});
			}
			
			// Compile the HTML
			var html = '<h4>' + populationspast.htmlspecialchars (_settings.fields[field].label) + '</h4>';
			html += '<p>' + populationspast.htmlspecialchars (_settings.fields[field].description) + '</p>';
			html += labels.join ('<br />');
			
			// Set the HTML
			$('.legend').html (html);
		},
		
		
		// Function to create a summary box
		summaryControl: function (map)
		{
			// Create the control
			_summary = L.control();
			
			// Define its contents
			_summary.onAdd = function (map) {
			    this._div = L.DomUtil.create('div', 'info summary'); // create a div with a classes 'info' and 'summary'
			    this.update(_field, null);
			    return this._div;
			};
			
			// Register a method to update the control based on feature properties passed
			_summary.update = function (field, feature) {
				var html = '<h4>' + populationspast.htmlspecialchars (_settings.fields[field].label) + '</h4>';
				html += (feature ?
					populationspast.summaryHtml (field, feature)
					: 'Hover over an area to view details.');
				this._div.innerHTML = html;
			};
			
			// Add to the map
			_summary.addTo(map);
		},
		
		
		// Function to add tooltips, using the title value
		tooltips: function ()
		{
			// Use jQuery tooltips; see: https://jqueryui.com/tooltip/
			$('form#field').tooltip ({
				track: true
			});
		}
		
	}
	
} (jQuery));
