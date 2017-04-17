// Fertility atlas application code

/*jslint browser: true, white: true, single: true, for: true */
/*global alert, console, window, $, jQuery, L */

var fertilityatlas = (function ($) {
	
	'use strict';
	
	// Internal class properties
	var _map = null;
	
	// Settings
	var _settings = {
		
		defaultLatitude: 53,
		defaultLongitude: -2,
		defaultZoom: 7
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
			_map = L.map('map').setView([_settings.defaultLatitude, _settings.defaultLongitude], _settings.defaultZoom);
			
			// Add tile layer
			var mapnik = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
			});
			mapnik.addTo(_map);
			
			// Define the data
			var url = 'data/1911.geojson';	// Data created using: ogr2ogr -f GeoJSON -s_srs EPSG:3857 -t_srs EPSG:4326 ../1911.geojson RSD_1911_MLS.shp
				
			// Load GeoJSON and add to the map
			$.getJSON(url, function(data) {
				var geojsonLayer = L.geoJson(data, {
					onEachFeature: function(feature, layer) {
						
						// Create table of properties for popup
						var popupContent = '<table>';
						$.each (feature.properties, function (key, value) {
							if (typeof value == 'string') {
								value = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
							}
							popupContent += '<tr><td>' + key + ':</td><td><strong>' + value + '</strong></td></tr>';
						});
						popupContent += '</table>';
						
						// Create popup
						layer.bindPopup(popupContent);
						
					}
				}).addTo(_map);
			});
		}
		
	}
	
} (jQuery));