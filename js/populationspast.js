// Populationspast application code

/*jslint browser: true, white: true, single: true, for: true */
/*global alert, console, window, $, jQuery, L, autocomplete, vex */

var populationspast = (function ($) {
	
	'use strict';
	
	// Internal class properties
	var _baseUrl;
	var _map = null;
	var _layer = null;
	var _field = null;	// E.g. TMFR, TFR, etc.
	var _currentZoom = null;
	var _zoomedOut = null;	// Boolean for whether the map is zoomed out 'too far'
	
	// Settings
	var _settings = {
		
		// Default map view
		defaultLatitude: 53,
		defaultLongitude: -2,
		defaultZoom: 7,
		
		// Tileservers; historical map sources are listed at: http://wiki.openstreetmap.org/wiki/National_Library_of_Scotland
		tileUrls: {
			'bartholomew': [
				'https://geo.nls.uk/mapdata2/bartholomew/great_britain/{z}/{x}/{-y}.png',	// E.g. http://geo.nls.uk/mapdata2/bartholomew/great_britain/12/2046/2745.png
				{maxZoom: 15, attribution: '&copy; <a href="http://maps.nls.uk/copyright.html">National Library of Scotland</a>'},
				'NLS - Bartholomew Half Inch, 1897-1907'
			],
			'os6inch': [
				'https://geo.nls.uk/maps/os/1inch_2nd_ed/{z}/{x}/{-y}.png',	// E.g. http://geo.nls.uk/maps/os/1inch_2nd_ed/12/2046/2745.png
				{maxZoom: 15, attribution: '&copy; <a href="http://maps.nls.uk/copyright.html">National Library of Scotland</a>'},
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
		colourStops: {
			7: 'red',
			6: '#ed7552',
			5: '#ed7552',
			4: '#fab884',
			3: '#ffffbf',
			2: '#c0ccbe',
			1: '#849eb9',
			0: '#4575b5'
		}
	};
	
	
	
	// Functions
	return {
		
		// Main function
		initialise: function (config, baseUrl)
		{
			// Obtain the configuration and add to settings
			$.each (config, function (key, value) {
				_settings[key] = value;
			});
			
			// Parse out the intervals in each field into an array, for use as colour stops
			$.each (_settings.fields, function (field, value) {
				_settings.fields[field].intervals = value.intervals.split(', ').reverse();
			});
			
			// Obtain the base URL
			_baseUrl = baseUrl;
			
			// Create the map
			populationspast.createMap ();
			
			// Add the data via AJAX requests
			populationspast.getData ();
			
			// Register to refresh data on map move
			_map.on ('moveend', function (e) {
				populationspast.getData ();
			});
			
			// Register to refresh data on any form field change
			$('form#field :input').on('change', function() {
				populationspast.getData ();
			});
		},
		
		
		// Function to create the map
		createMap: function ()
		{
			// Add the tile layers
			var tileLayers = [];		// Background tile layers
			var baseLayers = {};		// Labels
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
			_map = L.map('map', {
				center: [_settings.defaultLatitude, _settings.defaultLongitude],
				zoom: _settings.defaultZoom,
				layers: tileLayers[0]	// Documentation suggests tileLayers is all that is needed, but that shows all together
			});
			
			// Set the zoom and determine whether the map is zoomed out too far, and set the mouse cursor
			_currentZoom = _map.getZoom();
			_zoomedOut = (_settings.defaultZoom <= _settings.zoomedOut);
			_map.on('zoomend', function() {
				_currentZoom = _map.getZoom();
				_zoomedOut = (_currentZoom <= _settings.zoomedOut);
			});
			
			// Set mouse cursor based on zoom status
			$('#map').css('cursor', (_zoomedOut ? 'zoom-in' : 'auto'));
			
			// Zoom in on single click if zoomed out
			 _map.on ('click', function (e) {
				if (_zoomedOut) {
					_map.setZoomAround (e.latlng, (_settings.zoomedOut + 1));
				}
			});
			
			// Add the base (background) layer switcher
			L.control.layers(baseLayers, null).addTo(_map);
			
			// Add geocoder control
			populationspast.geocoder ();
			
			// Add hash support
			new L.Hash (_map, baseLayersById);
			
			// Add full screen control
			_map.addControl(new L.Control.Fullscreen({pseudoFullscreen: true}));
			
			// Add geolocation control
			L.control.locate().addTo(_map);
		},
		
		
		// Wrapper function to add a geocoder control
		geocoder: function ()
		{
			// Attach the autocomplete library behaviour to the location control
			autocomplete.addTo ('#geocoder input', {
				sourceUrl: _settings.geocoderApiBaseUrl + '?key=' + _settings.geocoderApiKey + '&bounded=1&bbox=' + _settings.autocompleteBbox,
				select: function (event, ui) {
					var bbox = ui.item.feature.properties.bbox.split(',');
					_map.fitBounds([ [bbox[1], bbox[0]], [bbox[3], bbox[2]] ]);
					event.preventDefault();
				}
			});
		},
		
		
		// Function to add data to the map via an AJAX API call
		getData: function ()
		{
			// Start API data parameters
			var apiData = {};
			
			// Supply the bbox and zoom
			apiData.bbox = _map.getBounds().toBBoxString();
			apiData.zoom = _currentZoom;
			
			// Set the field, based on the radiobutton value
			_field = $('form#field input[type="radio"]:checked').val();
			apiData.field = _field;
			
			// Set the year, based on the slider value
			var yearIndex = $('form input#year').val();
			apiData.year = _settings.datasets[yearIndex];
			
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
					
					// Show API-level error if one occured
					// #!# This is done here because the API still returns Status code 200
					if (data.error) {
						populationspast.removeLayer ();
						vex.dialog.alert ('Error: ' + data.error);
						return {};
					}
					
					// Show the data successfully
					populationspast.showCurrentData(data);
				}
			});
		},
		
		
		// Function to show the data for a layer
		showCurrentData: function (data)
		{
			// If this layer already exists, remove it so that it can be redrawn
			populationspast.removeLayer ();
			
			// Define the data layer
			_layer = L.geoJson(data, {
				onEachFeature: populationspast.popup,
				style: populationspast.setStyle,
				interactive: (!_zoomedOut),
			});
			
			// Add to the map
			_layer.addTo(_map);
			
		},
		
		
		// Helper function to enable fallback to JSON-P for older browsers like IE9; see: https://stackoverflow.com/a/1641582
		browserSupportsCors: function ()
		{
			return ('withCredentials' in new XMLHttpRequest ());
		},
		
		
		// Function to remove the data layer
		removeLayer: function ()
		{
			// Remove the layer, checking first to ensure it exists
			if (_layer) {
				_map.removeLayer (_layer);
			}
		},
		
		
		// Function to set the feature style
		setStyle: function (feature)
		{
			// Base the colour on the specified colour field
			var style = {
				fillColor: populationspast.getColour (feature.properties[_field], _field),
				weight: (_zoomedOut ? 0 : 1),
				fillOpacity: 0.7
			};
			
			// Return the style
			return style;
		},
		
		
		// Assign colour from lookup table
		getColour: function (value, field)
		{
			// Loop through each colour until found
			var interval;
			for (var i = 0; i < _settings.fields[field].intervals.length; i++) {	// NB $.each doesn't seem to work - it doesn't seem to reset the array pointer for each iteration
				interval = _settings.fields[field].intervals[i];
				if (value >= interval) {
					return _settings.colourStops[i];
				}
			}
			
			// Fall back to final colour in the list
			return _settings.colourStops[0];
		},
		
		
		// Popup wrapper
		popup: function (feature, layer)
		{
			// Disable popups if zoomed out
			if (_zoomedOut) {return;}
			
			// Create the popup
			var popupHtml = populationspast.popupHtml (feature /*, dataset */);
			layer.bindPopup(popupHtml, {autoPan: false});
		},
		
		
		// Function to define popup content
		popupHtml: function (feature /*, dataset */)
		{
			// Start with the title
			var html = '<p><strong>Fertility rates for ' + feature.properties['SUBDIST'] + ', ' + feature.properties['REGDIST'] + /* ' in ' + _settings.datasets[dataset].name + */ ':</strong></p>';
			
			// Add table
			html += '<table id="chart" class="lines compressed">';
			$.each (feature.properties, function (key, value) {
				if (typeof value == 'string') {
					value = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
				}
				html += '<tr class="' + key + '"><td>' + _settings.fields[key].label + ':</td><td><strong>' + value + '</strong></td></tr>';
			});
			html += '</table>';
			
			// Return the HTML
			return html;
		}
		
	}
	
} (jQuery));
