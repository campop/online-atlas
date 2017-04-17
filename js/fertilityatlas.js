// Fertility atlas application code

/*jslint browser: true, white: true, single: true, for: true */
/*global alert, console, window, $, jQuery, L, autocomplete */

var fertilityatlas = (function ($) {
	
	'use strict';
	
	// Internal class properties
	var _map = null;
	
	// Settings
	var _settings = {
		
		// Default map view
		defaultLatitude: 53,
		defaultLongitude: -2,
		defaultZoom: 7,
		
		// Tileservers
		tileUrls: {
			'mapnik': [
				'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',	// E.g. http://a.tile.openstreetmap.org/16/32752/21788.png
				{maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'},
				'OpenStreetMap style'
			],
			'osopendata': [
				'https://{s}.os.openstreetmap.org/sv/{z}/{x}/{y}.png',	// E.g. http://a.os.openstreetmap.org/sv/18/128676/81699.png
				{maxZoom: 19, attribution: 'Contains Ordnance Survey data &copy; Crown copyright and database right 2010'},
				'OS Open Data'
			]
		},
		
		// Geocoder
		geocoderApiBaseUrl: 'https://api.cyclestreets.net/v2/geocoder',
		geocoderApiKey: 'YOUR_API_KEY',		// Obtain at https://www.cyclestreets.net/api/apply/
		autocompleteBbox: '-6.6577,49.9370,1.7797,57.6924',
		
		// Data; created using e.g.: ogr2ogr -f GeoJSON -s_srs EPSG:3857 -t_srs EPSG:4326 ../data/1911.geojson RSD_1911_MLS.shp
		datasets: {
			year1881: {
				name: '1881',
				source: 'data/1881.geojson'
			},
			year1891: {
				name: '1891',
				source: 'data/1891.geojson'
			},
			year1901: {
				name: '1901',
				source: 'data/1901.geojson'
			},
			year1911: {
				name: '1911',
				source: 'data/1911.geojson'
			}
		}
	};
	
	
	
	return {
		
		// Main function
		initialise: function (config)
		{
			// Obtain the configuration and add to settings
			$.each (config, function (key, value) {
				_settings[key] = value;
			});
			
			// Create the map
			fertilityatlas.createMap ();
			
			// Set the dataset
			var dataset = 'year1891';
			
			// Add the data to the map
			fertilityatlas.addData (dataset);
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
			
			// Add the base (background) layer switcher
			L.control.layers(baseLayers, null).addTo(_map);
			
			// Add geocoder control
			fertilityatlas.geocoder ();
			
			// Add hash support
			new L.Hash (_map, baseLayersById);
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
		
		
		// Function to load the data to the map
		addData: function (dataset)
		{
			// Define the URL
			var url = _settings.datasets[dataset].source;
			
			// Load GeoJSON and add to the map
			$.getJSON(url, function(data) {
				var popupHtml;
				var geojsonLayer = L.geoJson(data, {
					onEachFeature: fertilityatlas.popup
				}).addTo(_map);
			});
		},
		
		
		// Popup wrapper
		popup: function (feature, layer)
		{
			var popupHtml = fertilityatlas.popupHtml (feature /*, dataset */);
			layer.bindPopup(popupHtml);
		},
		
		
		// Function to define popup content
		popupHtml: function (feature /*, dataset */)
		{
			// Start with the title
			var html = '<p><strong>Data for this area' + /* ' in ' + _settings.datasets[dataset].name + */ ':</strong></p>';
			
			// Add table
			html += '<table>';
			$.each (feature.properties, function (key, value) {
				if (typeof value == 'string') {
					value = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
				}
				html += '<tr><td>' + key + ':</td><td><strong>' + value + '</strong></td></tr>';
			});
			html += '</table>';
			
			// Return the HTML
			return html;
		}
		
	}
	
} (jQuery));