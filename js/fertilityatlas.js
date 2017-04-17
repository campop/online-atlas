// Fertility atlas application code

/*jslint browser: true, white: true, single: true, for: true */
/*global alert, console, window, $, jQuery, L */

var fertilityatlas = (function ($) {
	
	'use strict';
	
	// Internal class properties
	var _settings = {
		
		defaultLatitude: 53,
		defaultLongitude: -2,
		defaultZoom: 7
	};
	
	
	
	return {
		
		// Main function
		initialise: function ()
		{
			// Create the map
			var map = L.map('map').setView([_settings.defaultLatitude, _settings.defaultLongitude], _settings.defaultZoom);
			
			// Add tile layer
			var mapnik = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
			}).addTo(map);
			
			// Define the data
			var url = 'data/1911.geojson';	// Data created using: ogr2ogr -f GeoJSON -s_srs EPSG:3857 -t_srs EPSG:4326 ../1911.geojson RSD_1911_MLS.shp
				
			// Load GeoJSON and add to the map
			$.getJSON(url, function(data) {
				var geojsonLayer = L.geoJson(data).addTo(map);
			});
		}
		
	}
	
} (jQuery));