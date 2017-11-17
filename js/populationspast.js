// Populationspast application code

/*jslint browser: true, white: true, single: true, for: true */
/*global alert, console, window, $, jQuery, L, autocomplete, vex */

var populationspast = (function ($) {
	
	'use strict';
	
	// Internal class properties
	var _baseUrl;
	var _mapUis = {};
	var _secondMapLoaded = false;
	
	// Settings
	var _settings = {
		
		// Default map view
		defaultLocation: {
			latitude: 53.035,
			longitude: -1.082,
			zoom: 7,
		},
		
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
		defaultField: '',		// Will be supplied
		
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
			_mapUis[0] = populationspast.mapUi (0);
			
			// Add support for side-by-side comparison
			populationspast.sideBySide ();
		},
		
		
		// Function to add support for side-by-side comparison
		sideBySide: function ()
		{
			// Add checkbox controls to enable and syncronise side-by-side maps
			var checkboxesHtml = '<p id="comparebox">';
			checkboxesHtml += '<span id="syncronisebutton"><label for="syncronise"><img src="/images/icons/arrow_refresh.png" alt="" class="icon" /> Keep map positions in sync &nbsp;</label><input id="syncronise" name="syncronise" type="checkbox" checked="checked"></span> ';
			checkboxesHtml += '<span id="comparebutton"><label for="compare"><img src="/images/icons/application_tile_horizontal.png" alt="" class="icon" /> Compare side-by-side &nbsp;</label><input id="compare" name="compare" type="checkbox"></span>';
			checkboxesHtml += '</p>';
			$('#mapcontainers').prepend (checkboxesHtml);
			
			// Determine whether to syncronise maps
			var syncroniseMaps = true;
			
			// Handle toggle
			$('#compare').on('click', function() {
				
				// Side-by-side mode
				if ( $(this).is(':checked') ) {
					$('#mapcontainers').addClass('sidebyside');
					
					// Load the second map UI if not already loaded
					if (!_secondMapLoaded) {
						_mapUis[1] = populationspast.mapUi (1);
						_secondMapLoaded = true;
					}
					
					// Show the second map
					$('#mapcontainer1').show ();
					
					// Show the syncronisation button
					$('#syncronisebutton').show ();
					
					// By default, syncronise the map positions
					_mapUis[0].map.sync (_mapUis[1].map);
					_mapUis[1].map.sync (_mapUis[0].map);
					
					$('#syncronise').on('click', function() {
						if ( $(this).is(':checked') ) {
							_mapUis[0].map.sync (_mapUis[1].map);
							_mapUis[1].map.sync (_mapUis[0].map);
						} else {
							_mapUis[0].map.unsync (_mapUis[1].map);
							_mapUis[1].map.unsync (_mapUis[0].map);
						}
					});
					
				// Normal, single map mode
				} else {
					$('#mapcontainers').removeClass('sidebyside');
					
					// Hide the second map
					$('#mapcontainer1').hide ();
					
					// Hide the syncronisation button
					$('#syncronisebutton').hide ();
					
					// Unsyncronise the map positions
					_mapUis[0].map.unsync (_mapUis[1].map);
					_mapUis[1].map.unsync (_mapUis[0].map);
				}
			});
		},
		
		
		// Main function to create a map panel
		mapUi: function (mapUiIndex)
		{
			// Create a map UI collection object
			var mapUi = {};
			
			// Create a div for this map UI within the mapcontainers section div
			mapUi.index = mapUiIndex;
			mapUi.containerDivId = 'mapcontainer' + mapUi.index
			$('#mapcontainers').append ('<div id="' + mapUi.containerDivId + '" class="mapcontainer"></div>');
			
			// Create the map
			mapUi.mapDivId = 'map' + mapUi.index;
			populationspast.createMap (mapUi);
			
			// Create the nav panel
			populationspast.createNav (mapUi);
			
			// Create the location overlay pane
			populationspast.createLocationsOverlayPane (mapUi.map);
			
			// Show first-run welcome message if the user is new to the site
			populationspast.welcomeFirstRun ();
			
			// Determine the active field, and create a handler for changes
			mapUi.field = _settings.defaultField;	// E.g. TMFR, TFR, etc.
			$('#' + mapUi.navDivId + ' form input[type="radio"], #' + mapUi.navDivId + ' form select').on('change', function() {
				mapUi.field = populationspast.getField (mapUi.navDivId);
			});
			// Create the legend for the current field, and update on changes
			populationspast.createLegend (mapUi);
			$('#' + mapUi.navDivId + ' form input[type="radio"], #' + mapUi.navDivId + ' form select').on('change', function() {
				populationspast.setLegend (mapUi);
			});
			
			// Register an summary box control
			populationspast.summaryControl (mapUi);
			$('#' + mapUi.navDivId + ' form input[type="radio"], #' + mapUi.navDivId + ' form select').on('change', function() {
				mapUi.summary.update (mapUi.field, null);
			});
			
			// Add the data via AJAX requests
			populationspast.getData (mapUi);
			
			// Register to refresh data on map move
			mapUi.map.on ('moveend', function (e) {
				populationspast.getData (mapUi);
			});
			
			// Register to refresh data on any form field change
			$('#' + mapUi.navDivId + ' form :input').on('change', function() {
				populationspast.getData (mapUi);
			});
			
			// Add tooltips to the forms
			populationspast.tooltips ();
			
			// Register a dialog dialog box handler, giving a link more information
			populationspast.moreDetails (mapUi.field);
			
			// Return the mapUi handle
			return mapUi;
		},
		
		
		// Function to determine the field from the form value
		getField: function (navDivId)
		{
			// Switch between radiobuttons (full mode) and select (side-by-side mode)
			if ( $('#' + navDivId + ' select').is(':visible') ) {
				return $('#' + navDivId + ' form select').val();
			} else {
				return $('#' + navDivId + ' form input[type="radio"]:checked').val();
			}
		},
		
		
		// Function to create the map and attach this to the mapUi
		createMap: function (mapUi)
		{
			// Create a div for this map within the map UI container
			$('#' + mapUi.containerDivId).append ('<div id="' + mapUi.mapDivId + '" class="map"></div>');
			
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
			
			// Parse any hash in the URL to obtain any default position
			var urlParameters = populationspast.getUrlParameters ();
			var defaultLocation = (urlParameters.defaultLocation || _settings.defaultLocation);
			var defaultTileLayer = (urlParameters.defaultTileLayer || _settings.defaultTileLayer);
			
			// Create the map
			var map = L.map (mapUi.mapDivId, {
				center: [defaultLocation.latitude, defaultLocation.longitude],
				zoom: defaultLocation.zoom,
				layers: baseLayersById[defaultTileLayer]	// Documentation suggests tileLayers is all that is needed, but that shows all together
			}).setActiveArea('activearea');
			
			// Set a class corresponding to the map tile layer, so that the background can be styled with CSS
			populationspast.setMapBackgroundColour (tileLayers[0].options);
			map.on('baselayerchange', function(e) {
				populationspast.setMapBackgroundColour (baseLayers[e.name].options);
			});
			
			// Set the zoom and determine whether the map is zoomed out too far, and set the mouse cursor
			mapUi.currentZoom = map.getZoom();
			mapUi.zoomedOut = (_settings.defaultZoom <= _settings.zoomedOut);
			map.on('zoomend', function() {
				mapUi.currentZoom = map.getZoom();
				mapUi.zoomedOut = (mapUi.currentZoom <= _settings.zoomedOut);
			});
			
			// Set mouse cursor based on zoom status
			$('#map').css('cursor', (mapUi.zoomedOut ? 'zoom-in' : 'auto'));
			
			// Zoom in on single click if zoomed out
			 map.on ('click', function (e) {
				if (mapUi.zoomedOut) {
					map.setZoomAround (e.latlng, (_settings.zoomedOut + 1));
				}
			});
			
			// Add the base (background) layer switcher
			L.control.layers(baseLayers, null, {position: 'bottomright'}).addTo(map);
			
			// Add geocoder control
			populationspast.createGeocoder (mapUi);
			
			// Add hash support
			if (mapUi.index == 0) {		// If more than one map on the page, apply only to the first one
				new L.Hash (map, baseLayersById);
			}
			
			// Add full screen control
			map.addControl(new L.Control.Fullscreen({pseudoFullscreen: true}));
			
			// Add geolocation control
			L.control.locate().addTo(map);
			
			// Attach the map to the mapUi
			mapUi.map = map;
		},
		
		
		// Function to parse the URL parameters
		getUrlParameters: function ()
		{
			// Start a list of parameters
			var urlParameters = {};
			
			// Get the location from the URL
			urlParameters.defaultLocation = null;
			urlParameters.defaultTileLayer = null;
			if (window.location.hash) {
				var hashParts = window.location.hash.match (/^#([0-9]{1,2})\/([-.0-9]+)\/([-.0-9]+)\/([a-z0-9]+)$/);	// E.g. #17/51.51137/-0.10498/bartholomew
				if (hashParts) {
					urlParameters.defaultLocation = {
						latitude: hashParts[2],
						longitude: hashParts[3],
						zoom: hashParts[1]
					}
					urlParameters.defaultTileLayer = hashParts[4];
				}
			}
			
			// Return the parameters
			return urlParameters;
		},
		
		
		// Function to set the map background colour for a layer
		setMapBackgroundColour: function (tileLayerOptions)
		{
			// Set, using jQuery, if specified, or clear
			var backgroundColour = (tileLayerOptions.backgroundColour ? tileLayerOptions.backgroundColour : '');
			$('.leaflet-container').css ('background-color', backgroundColour);
		},
		
		
		// Wrapper function to add a geocoder control
		createGeocoder: function (mapUi)
		{
			// Create a div for the geocoder within the map container
			var geocoderDivId = 'geocoder' + mapUi.index;
			$('#' + mapUi.containerDivId).prepend ('<div id="' + geocoderDivId + '" class="geocoder"></div>');
			
			// Create the input form within the geocoder container
			$('#' + geocoderDivId).append ('<input type="text" name="location" autocomplete="off" placeholder="Search locations and move map" tabindex="1" />');
			
			// Attach the autocomplete library behaviour to the location control
			autocomplete.addTo ('#' + geocoderDivId + ' input', {
				sourceUrl: _settings.geocoderApiBaseUrl + '?key=' + _settings.geocoderApiKey + '&bounded=1&bbox=' + _settings.autocompleteBbox,
				select: function (event, ui) {
					var bbox = ui.item.feature.properties.bbox.split(',');
					mapUi.map.fitBounds([ [bbox[1], bbox[0]], [bbox[3], bbox[2]] ]);
					event.preventDefault();
				}
			});
		},
		
		
		// Function to create the navigation panel
		createNav: function (mapUi)
		{
			// Remove any current content, e.g. due to redrawing
			mapUi.navDivId = 'nav' + mapUi.index;
			$('#' + mapUi.navDivId).remove();
			
			// Create a div for the nav within the map container
			$('#' + mapUi.containerDivId).prepend ('<nav id="' + mapUi.navDivId + '"></nav>');
			
			// Create a form within the nav
			$('#' + mapUi.navDivId).append ('<form></form>');
			
			// Create the year control within the form
			$('#' + mapUi.navDivId + ' form').append ('<h3>Year:</h3>');
			mapUi.yearDivId = 'year' + mapUi.index;
			$('#' + mapUi.navDivId + ' form').append (Math.min.apply(null, _settings.datasets) + ' <input id="' + mapUi.yearDivId + '" type="range" list="years" min="0" max="' + (_settings.datasets.length - 1) + '" step="1" /> ' + Math.max.apply (null, _settings.datasets));
			
			// Build radiobutton and select list options; both are created up-front, and the relevant one hidden according when changing to/from side-by-side mode
			var radiobuttonsHtml = '';
			var selectHtml = '';
			var fieldname;
			$.each (_settings.fields, function (id, field) {
				
				// Skip general fields, like year
				if (field.general) {return /* i.e. continue */;}
				
				// Construct the radiobutton list (for full mode)
				fieldname = 'field' + mapUi.index + '_' + populationspast.htmlspecialchars (id);
				radiobuttonsHtml += '<div title="' + populationspast.htmlspecialchars (field.description) + '">';
				radiobuttonsHtml += '<input type="radio" name="field" value="' + populationspast.htmlspecialchars (id) + '" id="' + fieldname + '"' + (id == _settings.defaultField ? ' checked="checked"' : '') + ' />';
				radiobuttonsHtml += '<label for="' + fieldname + '">';
				radiobuttonsHtml += populationspast.htmlspecialchars (field.label);
				radiobuttonsHtml += ' <a class="moredetails" data-field="' + id + '" href="#">[?]</a>';
				radiobuttonsHtml += '</label>';
				radiobuttonsHtml += '</div>';
				
				// Select widget (for side-by-side mode)
				selectHtml += '<option value="' + populationspast.htmlspecialchars (id) + '">' + populationspast.htmlspecialchars (field.label) + '</option>';
			});
			
			// Add a container for the radiobuttons
			radiobuttonsHtml = '<div class="radiobuttons">' + radiobuttonsHtml + '</div>';
			
			// Assemble the select widget
			selectHtml = '<select name="field">' + selectHtml + '</select>';
			
			// Create the year control within the form
			$('#' + mapUi.navDivId + ' form').append ('<h3>Show:</h3>');
			$('#' + mapUi.navDivId + ' form').append (radiobuttonsHtml);
			$('#' + mapUi.navDivId + ' form').append (selectHtml);
		},
		
		
		// Function to create a location overlay pane; see: http://leafletjs.com/examples/map-panes/
		createLocationsOverlayPane: function (map)
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
		moreDetails: function (field)
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
				populationspast.dialogBox ('#moredetails', field, dialogBoxContentHtml);
				
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
		getData: function (mapUi)
		{
			// Start API data parameters
			var apiData = {};
			
			// Supply the bbox and zoom
			apiData.bbox = mapUi.map.getBounds().toBBoxString();
			apiData.zoom = mapUi.currentZoom;
			
			// Set the field, based on the radiobutton value
			apiData.field = mapUi.field;
			
			// Set the year, based on the slider value
			var yearIndex = $('#' + mapUi.yearDivId).val();
			apiData.year = _settings.datasets[yearIndex];
			
			// Start spinner, initially adding it to the page
			if (!$('#' + mapUi.containerDivId + ' #loading').length) {
				$('#' + mapUi.containerDivId).append('<img id="loading" src="' + _baseUrl + '/images/spinner.svg" />');
			}
			$('#' + mapUi.containerDivId + ' #loading').show();
			
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
					$('#' + mapUi.containerDivId + ' #loading').hide();
					
					// Show API-level error if one occured
					// #!# This is done here because the API still returns Status code 200
					if (data.error) {
						populationspast.removeLayer (mapUi);
						vex.dialog.alert ('Error: ' + data.error);
						return {};
					}
					
					// Show the data successfully
					populationspast.showCurrentData (mapUi, data);
				}
			});
		},
		
		
		// Function to show the data for a layer
		showCurrentData: function (mapUi, data)
		{
			// If this layer already exists, remove it so that it can be redrawn
			populationspast.removeLayer (mapUi);
			
			// Define the data layer
			mapUi.dataLayer = L.geoJson (data, {
				
				// Handle each feature (popups, highlighting, and setting summary box data)
				// NB this has to be inlined, and cannot be refactored to a 'onEachFeature' method, as the field is needed as a parameter
				onEachFeature: function (feature, layer) {
					
					// Highlight features on hover; see: http://leafletjs.com/examples/choropleth/
					layer.on({
						
						// Highlight feature
						// NB this has to be inlined, and cannot be refactored to a 'highlightFeature' method, as the field is needed as a parameter
						mouseover: function (e) {
							
							// Set the style for this feature
							var layer = e.target;
							layer.setStyle({
								weight: 4
							});
							if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
								layer.bringToFront();
							}
							
							// Update the summary box
							mapUi.summary.update (mapUi.field, layer.feature);
						},
						
						// Reset highlighting
						// NB this has to be inlined, and cannot be refactored to a 'resetHighlight' method, as the field is needed as a parameter
						mouseout: function (e) {
							
							// Reset the style
							mapUi.dataLayer.resetStyle (e.target);
							
							// Update the summary box
							mapUi.summary.update (mapUi.field, null);
						}
					});
					
					// Enable popups (if close enough)
					if (!mapUi.zoomedOut) {
						var popupHtml = populationspast.popupHtml (feature);
						layer.bindPopup(popupHtml, {autoPan: false});
					}
				},
				
				// Style: base the colour on the specified colour field
				// NB this has to be inlined, and cannot be refactored to a 'setStyle' method, as the field is needed as a parameter
				style: function (feature) {
					return {
						fillColor: populationspast.getColour (feature.properties[mapUi.field], mapUi.field),
						weight: (mapUi.zoomedOut ? 0 : 1),
						fillOpacity: 0.7
					};
				},
						
				// Interactivity
				interactive: (!mapUi.zoomedOut)
			});
			
			// Add to the map
			mapUi.dataLayer.addTo(mapUi.map);
			
		},
		
		
		// Helper function to enable fallback to JSON-P for older browsers like IE9; see: https://stackoverflow.com/a/1641582
		browserSupportsCors: function ()
		{
			return ('withCredentials' in new XMLHttpRequest ());
		},
		
		
		// Function to remove the data layer
		removeLayer: function (mapUi)
		{
			// Remove the layer, checking first to ensure it exists
			if (mapUi.dataLayer) {
				mapUi.map.removeLayer (mapUi.dataLayer);
			}
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
			// #!# Sometimes get: "Uncaught TypeError: Cannot read property 'replace' of undefined"
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
		createLegend: function (mapUi)
		{
			// Affix the legend
			var legend = L.control({position: 'bottomleft'});
			
			// Define its contents
			legend.onAdd = function () {
				return L.DomUtil.create ('div', 'info legend');
			};
			
			// Add to the map
			legend.addTo(mapUi.map);
			
			// Set the initial value
			populationspast.setLegend (mapUi);
		},
		
		
		// Function to set the legend contents
		setLegend: function (mapUi)
		{
			// If the intervals is an array, i.e. standard list of colour stops, loop until found
			var labels = [];
			var intervals = _settings.fields[mapUi.field].intervals;
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
			var html = '<h4>' + populationspast.htmlspecialchars (_settings.fields[mapUi.field].label) + '</h4>';
			html += '<p>' + populationspast.htmlspecialchars (_settings.fields[mapUi.field].description) + '</p>';
			html += labels.join ('<br />');
			
			// Set the HTML
			$('#' + mapUi.mapDivId + ' .legend').html (html);
		},
		
		
		// Function to create a summary box
		summaryControl: function (mapUi)
		{
			// Create the control
			mapUi.summary = L.control();
			
			// Define its contents
			var map = mapUi.map;
			mapUi.summary.onAdd = function (map) {
			    this._div = L.DomUtil.create('div', 'info summary'); // create a div with a classes 'info' and 'summary'
			    this.update(mapUi.field, null);
			    return this._div;
			};
			
			// Register a method to update the control based on feature properties passed
			mapUi.summary.update = function (field, feature) {
				var html = '<h4>' + populationspast.htmlspecialchars (_settings.fields[field].label) + '</h4>';
				html += (feature ?
					populationspast.summaryHtml (field, feature)
					: 'Hover over an area to view details.');
				this._div.innerHTML = html;
			};
			
			// Add to the map
			mapUi.summary.addTo(map);
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
