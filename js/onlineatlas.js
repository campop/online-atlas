// Online atlas application code

/*jslint browser: true, white: true, single: true, for: true */
/*global alert, console, window, Cookies, $, jQuery, L, autocomplete, vex */

const onlineatlas = (function ($) {
	
	'use strict';
	
	// Internal class properties
	let _baseUrl;
	const _mapUis = {};
	let _variationIds = {};
	let _title = false;
	
	// Settings
	const _settings = {
		
		// Default map view
		defaultLocation: {
			latitude: 53.035,
			longitude: -1.082,
			zoom: 7
		},
		
		// Max/min zoom
		maxZoom: 13,	// Zoomed in
		minZoom: 5,		// Zoomed out
		sideBySideMinZoom: 7,
		
		// Max bounds
		maxBounds: [[47, -14], [62, 12]],	// South, West ; North, East
		
		// Tileservers; historical map sources are listed at: http://wiki.openstreetmap.org/wiki/National_Library_of_Scotland
		defaultTileLayer: 'bartholomew',
		tileUrls: {
			'bartholomew': [
				'https://geo.nls.uk/mapdata2/bartholomew/great_britain/{z}/{x}/{y}.png',	// E.g. http://geo.nls.uk/mapdata2/bartholomew/great_britain/12/2046/2745.png
				{maxZoom: 15, attribution: '&copy; <a href="http://maps.nls.uk/copyright.html">National Library of Scotland</a>', 'backgroundColour': '#a2c3ba'},
				'NLS - Bartholomew Half Inch, 1897-1907'
			],
			'os1inch': [
				'https://geo.nls.uk/maps/os/1inch_2nd_ed/{z}/{x}/{y}.png',	// E.g. https://geo.nls.uk/maps/os/1inch_2nd_ed/15/16395/10793.png
				{maxZoom: 15, attribution: '&copy; <a href="https://maps.nls.uk/copyright.html">National Library of Scotland</a>', backgroundColour: '#f0f1e4', key: '/images/mapkeys/os1inch.jpg'},
				'NLS - OS One Inch, 1885-1900'
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
		datasets: [],	// Will be supplied
		defaultDataset: false,
		
		// Fields and their labels
		fields: {},		// Will be supplied
		defaultField: '',		// Will be supplied
		nullField: '',
		expandableHeadings: false,
		variations: {},	// Will be supplied
		variationsFlattened: {},	// Will be supplied
		defaultVariations: {},		// Will be supplied
		
		// Full descriptions
		enableFullDescriptions: true,
		
		// Map geometry colours; colour scales can be created at http://www.colorbrewer.org/
		colourStops: [],		// Will be supplied
		colourUnknown: false,	// Will be supplied
		valueUnknownString: false,	// Will be supplied
		intervalsMode: false,
		
		// Null data values
		nullDataMessage: '[Data not available]',
		
		// Zoomed out mode
		zoomedOut: false,
		
		// Close zoom mode
		closeZoom: false,
		closeField: false,
		farField: false,
		
		// Export mode enabled
		export: true,
		pdfLink: false,
		pdfBaseUrl: '%baseUrl/resources/',		// %baseUrl supported
		
		// Welcome message
		firstRunMessageHtml: ''
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
			
			// Create a list of normalised variation form IDs, e.g. 'Some field' becomes 'Somefield', or 'Gender' stays as 'Gender'
			// #!# Needs to be supplied from server-side to ensure consistency; see equivalent function in onlineAtlas.php
			if (!$.isEmptyObject (_settings.variations)) {
				_variationIds = onlineatlas.normaliseVariationIds ();
			};
			
			// If a URL path is supplied, set the initial form value on first load (so is not applicable to a second side-by-side map)
			onlineatlas.defaultsFromUrl ();
			
			// Create the map panel and associated controls
			_mapUis[0] = onlineatlas.createMapUi (0);
			
			// Create mobile navigation
			onlineatlas.createMobileNavigation ();
			
			// Add support for side-by-side comparison
			onlineatlas.sideBySide ();
		},
		
		
		// Function to create a list of normalised variation form IDs, e.g. 'Some field' becomes 'Somefield', or 'Gender' stays as 'Gender'
		normaliseVariationIds: function ()
		{
			// Normalise each
			const variationIds = {};
			$.each (_settings.variations, function (variationLabel, variationOptions) {
				variationIds[variationLabel] = onlineatlas.ucfirst (variationLabel.toLowerCase().replace (/\W/g, ''));	// See: https://stackoverflow.com/a/9364527/
			});
			
			// Return the IDs
			return variationIds;
		},
		
		
		// Function to set defaults from the URL
		defaultsFromUrl: function ()
		{
			// Obtain the URL path
			let path = window.location.pathname;
			
			// Remove the baseUrl
			path = path.slice (_baseUrl.length);
			
			// Trim starting/trailing slash
			path = path.replace (/^\/|\/$/g, '');
			
			// Extract the URL into parts
			const urlParts = path.split ('/');
			
			// Check if field is present and valid
			if (!urlParts[0]) {return false;}
			const field = onlineatlas.fieldPresent (urlParts[0]);
			if (!field) {return false;}
			
			// Check the year is also present and valid
			if (!urlParts[1]) {return false;}
			const year = parseInt (urlParts[1]);
			if ($.inArray (year, _settings.datasets) == -1) {return false;}	// https://api.jquery.com/jQuery.inArray/
			
			// If variations are enabled, check variation is present and valid
			let variations = false;
			if (!$.isEmptyObject (_settings.variations)) {
				variations = onlineatlas.variationsPresent (urlParts.slice (2));	// Omit field and year
				if (variations === false) {return false;}
			}
			
			// Set the default field and year
			_settings.defaultField = field;
			_settings.defaultDataset = year;
			if (!$.isEmptyObject (_settings.variations)) {
				_settings.defaultVariations = variations;	// Override code-supplied default
			}
		},
		
		
		// Determine if the field is present, on a case-insensitive basis
		fieldPresent: function (fieldFromUrl /* expected to be lower-case */)
		{
			// Attempt to match the field by casting both the supplied field and each field in the supported fields to lower case
			let fieldFound = false;
			$.each (_settings.fields, function (field, value) {
				if (fieldFromUrl == field.toLowerCase ()) {
					fieldFound = field;
					return;		// Break out of loop; can't use 'return' with $.each to return from the whole function
				}
			});
			
			// Return the result, either the field as found, or false
			return fieldFound;
		},
		
		
		// Determine if the variation(s) are present
		variationsPresent: function (variationsFromUrl)
		{
			// Check the expected number of variation parameters are present in the URL
			const totalVariationsExpected = Object.keys (_settings.variations).length;
			if (variationsFromUrl.length != totalVariationsExpected) {return false;}
			
			// Attempt to match all variations; the URL order is assumed to match the settings order
			const variationsFound = {};
			let i = 0;
			$.each (_settings.variations, function (variationLabel, variationOptions) {
				const variationFromUrl = variationsFromUrl[i];
				$.each (variationOptions, function (variation, label) {
					if (variationFromUrl == variation.toLowerCase ()) {
						variationsFound[variationLabel] = variation;
						return;		// Break out of loop; can't use 'return' with $.each to return from the whole function
					}
				});
				i++;
			});
			
			// Return false if some not present
			if (Object.keys (variationsFound).length != totalVariationsExpected) {return false;}
			
			// Return found variations
			return variationsFound;
		},
		
		
		// Create mobile navigation
		createMobileNavigation: function ()
		{
			// Add hamburger menu
			$('#map0').append ('<div id="nav-mobile"></div>');
			
			// Create a close button
			if ($('#nav-mobile').is(':visible')) {
				$('#onlineatlas nav').prepend ('<p id="navclose" class="closebutton"><a href="#">&#10006;</a></p>');
				$('#onlineatlas nav #navclose').click (function (e) {
					$('#onlineatlas nav').hide ('slide', {direction: 'right'}, 250);
					e.preventDefault ();
				});
			}
			
			// Toggle visibility clickable
			$('#nav-mobile').click(function () {
				if ($('#onlineatlas nav').is(':visible')) {
					$('#onlineatlas nav').hide ('slide', {direction: 'right'}, 250);
				} else {
					$('#onlineatlas nav').animate ({width:'toggle'}, 250);
				}
			});
			
			// Open menu by default on mobile
			if ($('#nav-mobile').is(':visible')) {
				$('#nav-mobile').click ();
			}
			
			// Disable title tooltips
			$('#nav-mobile').click(function () {
				if ($('#onlineatlas nav').is(':visible')) {
					$('.radiobuttons .field').removeAttr ('title');
				}
			});
			
			/*
			// Enable implicit click/touch on map as close menu
			if ($('#nav-mobile').is(':visible')) {
				if (!$('#onlineatlas nav').is(':visible')) {
					$('.map').click(function () {
						$('#onlineatlas nav').hide ('slide', {direction: 'right'}, 250);
					});
				};
			}
			*/
			
			// Enable closing menu on slide right
			if ($('#nav-mobile').is(':visible')) {
				$('#onlineatlas nav').on('swiperight', function () {
					$('#onlineatlas nav').hide ('slide', {direction: 'right'}, 250);
				});
				
				// Exempt range control from swiperight behaviour; see: https://stackoverflow.com/a/48006174/
				$('input[type=range], .yearrangecontrol').on('mousedown touchstart', function(e) {
					e.stopPropagation();
				});
			}
			
			// Minimise legend on mobile by default
			if ($('#nav-mobile').is(':visible')) {
				$('#legenddetail').after ('<p id="legendshow"><a href="#">Show details &raquo;</a></p>');
				$('.legend').prepend ('<p id="legendclose" class="closebutton"><a href="#">&#10006;</a></p>');
				$('#legenddetail').hide ();
				$('#legendclose a').hide ();
				$('#legendshow a').click (function (e) {
					$('#legenddetail').show ();
					$('#legendshow a').hide ();
					$('#legendclose a').show ();
					e.preventDefault ();
				});
				$('#legendclose a').click (function (e) {
					$('#legenddetail').hide ();
					$('#legendshow a').show ();
					$('#legendclose a').hide ();
					e.preventDefault ();
				});
			}
		},
		
		
		// Function to add support for side-by-side comparison
		sideBySide: function ()
		{
			// Add checkbox controls to enable and syncronise side-by-side maps
			$('#mapcontainers').prepend (onlineatlas.createSidebysideCheckboxes ());
			
			// Create side-by-side sync handler
			onlineatlas.syncHandling ();
			
			// Handle toggle
			$('#compare').on ('click', function () {
				
				// Side-by-side mode; this adds a second map on the right (mapcontainer1), but retains the original map (mapcontainer0) on the left though resizes it
				// This routine creates the second map and clones in values from the first map, when side-by-side is enabled the first time (only)
				// The field selection control changes, on both maps, from a radiobutton to a drop-down, to save space
				if ( $(this).is(':checked') ) {
					
					// Set main style class
					$('#mapcontainers').addClass('sidebyside');
					
					// Load the second map UI if not already loaded, cloning the form values
					if (!$('#mapcontainer1').length) {
						_mapUis[1] = onlineatlas.createMapUi (1, true);
					}
					
					// Show the second map
					$('#mapcontainer1').show ();
					
					// Prevent far-out zoom, as a workaround for side-by-side interacting with maxBounds, which causes looping in Chrome and memory issues in Firefox
					_mapUis[0].map.setMinZoom (_settings.sideBySideMinZoom);
					_mapUis[1].map.setMinZoom (_settings.sideBySideMinZoom);
					
					// Show the syncronisation button
					$('#syncronisebutton').show ();
					
					// Syncronise initially; see: https://github.com/jieter/Leaflet.Sync
					$('#syncronisebutton input').click ();
					
				// Normal, single map mode
				} else {
					$('#mapcontainers').removeClass('sidebyside');
					
					// Hide the second map
					$('#mapcontainer1').hide ();
					
					// Hide the syncronisation button
					$('#syncronisebutton').hide ();
					
					// Reset the min zoom level
					_mapUis[0].map.setMinZoom (_settings.minZoom);
					
					// Unsyncronise the map positions
					_mapUis[0].map.unsync (_mapUis[1].map);
					_mapUis[1].map.unsync (_mapUis[0].map);
					
					// Trigger change event (without actually changing the value) on the field selector, to ensure the main map is redrawn, to prevent the right side of the map being empty
					// #!# Ideally this should use a new map change custom event, to be more explicit about the purpose
					$('#' + _mapUis[0].navDivId + ' form input[name="field"]').trigger ('change');
				}
			});
		},
		
		
		// Function to create checkbox for side-by-side mode
		createSidebysideCheckboxes: function ()
		{
			let html = '<p id="comparebox">';
			html += '<span id="syncronisebutton"><label><img src="/images/icons/arrow_refresh.png" alt="" class="icon" /> Keep map positions in sync &nbsp;<input id="syncronise" name="syncronise" type="checkbox"></label></span> ';
			html += '<span id="comparebutton"><label><img src="/images/icons/application_tile_horizontal.png" alt="" class="icon" /> Compare side-by-side &nbsp;<input id="compare" name="compare" type="checkbox"></label></span>';
			html += '</p>';
			return html;
		},
		
		
		// Function to enable sync handling
		syncHandling: function ()
		{
			// Create handlers for syncing
			$('#syncronise').on ('click', function () {
				if ( $(this).is (':checked') ) {
					_mapUis[0].map.sync (_mapUis[1].map);		// Enable sync
					_mapUis[1].map.sync (_mapUis[0].map);
				} else {
					_mapUis[0].map.unsync (_mapUis[1].map);		// Disable syncing
					_mapUis[1].map.unsync (_mapUis[0].map);
				}
			});
		},
		
		
		// Main function to create a map panel
		createMapUi: function (mapUiIndex, cloneFormValues)
		{
			// Create a map UI collection object
			const mapUi = {};
			
			// Create a div for this map UI within the mapcontainers section div
			mapUi.index = mapUiIndex;
			mapUi.containerDivId = 'mapcontainer' + mapUi.index;
			$('#mapcontainers').append ('<div id="' + mapUi.containerDivId + '" class="mapcontainer"></div>');
			
			// Create the map
			mapUi.mapDivId = 'map' + mapUi.index;
			onlineatlas.createMap (mapUi);
			
			// Create the nav panel
			onlineatlas.createNav (mapUi);
			
			// Create the location overlay pane
			onlineatlas.createLocationsOverlayPane (mapUi.map);
			
			// Show first-run welcome message if the user is new to the site
			onlineatlas.welcomeFirstRun ();
			
			// Determine the active field (i.e. layer) value, by reading the radiobutton value; NB the select value is not a used value but is instead proxied to the radiobutton set
			mapUi.field = _settings.defaultField;	// E.g. TMFR, TFR, etc.; may get changed by cloneFormValues below
			$('#' + mapUi.navDivId + ' form input[name="field"]').on ('change', function () {
				mapUi.field = $('#' + mapUi.navDivId + ' form input[name="field"]:checked').val ();
			});
			
			// For each variation (if any), create a handler for changes
			if (!$.isEmptyObject (_settings.variations)) {
				mapUi.variations = {};
				$.each (_settings.variations, function (variationLabel, variationOptions) {
					
					// Initial value
					const fieldname = _variationIds[variationLabel].toLowerCase();
					mapUi.variations[fieldname] = _settings.defaultVariations[variationLabel];	// E.g. F, M, etc.
					
					// Changes, which simply read off the field name/value pairs
					$('#' + mapUi.navDivId + ' form input[name="' + fieldname + '"]').on ('change', function (e) {
						mapUi.variations[this.name] = this.value;
					});
				});
			}
			
			// Create the legend for the current field, and update on changes
			onlineatlas.createLegend (mapUi);
			$('#' + mapUi.navDivId + ' form input[name="field"]').on ('change', function() {
				onlineatlas.setLegend (mapUi);
			});
			
			// Register a summary box control
			onlineatlas.summaryControl (mapUi);
			$('#' + mapUi.navDivId + ' form input[name="field"]').on ('change', function() {
				mapUi.summary.update (mapUi.field, null, mapUi.currentZoom);
			});
			mapUi.map.on ('zoomend', function () {
				if (mapUi.zoomedOut) {
					mapUi.summary.update (mapUi.field, null, mapUi.currentZoom);	// Feature as null resets the status
				}
			});
			
			// Clone form values; this must be done before the first getData call
			if (cloneFormValues) {
				onlineatlas.cloneFormValues ('#' + _mapUis[0].navDivId + ' form', '#' + mapUi.navDivId + ' form');		// Copy the form values (year, field, variations) from the left map (0) to the new right-hand map (1)
			}
			
			// Add the data via AJAX requests
			onlineatlas.getData (mapUi);
			
			// Register to refresh data on map move
			mapUi.map.on ('moveend', function (e) {
				onlineatlas.getData (mapUi);
			});
			
			// Register to refresh data on any form field change
			$('#' + mapUi.navDivId + ' form :input').not ('[name*="_proxy"]').on ('change', function () {		// _proxy excluded
				onlineatlas.getData (mapUi);
			});
			
			// Add tooltips to the forms
			onlineatlas.tooltips ();
			
			// Register a dialog dialog box handler, giving a link to more information
			onlineatlas.moreDetails ();
			
			// Return the mapUi handle
			return mapUi;
		},
		
		
		// Generic function to clone form values from one form to another of the same structure
		cloneFormValues: function (form0QuerySelector, form1QuerySelector)
		{
			// General inputs with simple scalar values (e.g. not checkbox/button)
			$(form0QuerySelector).find ('input:not([type=radio], [type=checkbox], [type=button])').each (function (index, input) {
				$(form1QuerySelector).find ('input[name="' + input.name + '"]').val (input.value).trigger ('change');
				$(form1QuerySelector).find ('input[name="' + input.name + '"]').trigger ('input');	// Necessary to ensure range highlight function gets an event
			});
			
			// Radiobuttons
			$(form0QuerySelector).find ('input[type="radio"]:checked').each (function (index, radio) {
				$(form1QuerySelector).find ('input[type="radio"][name="' + radio.name + '"][value="' + radio.value + '"]').prop ('checked', true).trigger ('change');
				$(form1QuerySelector).find ('input[type="radio"][name="' + radio.name + '"][value="' + radio.value + '"]').trigger ('input');	// Necessary to ensure proxy highlight function gets an event
			});
			
			// #!# Other types can be added; NB if adding <select>, make sure _proxy is excluded
		},
		
		
		// Function to create the map and attach this to the mapUi
		createMap: function (mapUi)
		{
			// Create a div for this map within the map UI container
			$('#' + mapUi.containerDivId).append ('<div id="' + mapUi.mapDivId + '" class="map"></div>');
			
			// Add the tile layers
			const tileLayers = [];		// Background tile layers
			const baseLayers = {};		// Labels, by name
			const baseLayersById = {};	// Layers, by id
			$.each (_settings.tileUrls, function (tileLayerId, tileLayerAttributes) {
				const layer = L.tileLayer(tileLayerAttributes[0], tileLayerAttributes[1]);
				tileLayers.push (layer);
				const name = tileLayerAttributes[2];
				baseLayers[name] = layer;
				baseLayersById[tileLayerId] = layer;
			});
			
			// Parse any hash in the URL to obtain any default position
			const urlParameters = onlineatlas.getUrlParameters ();
			const defaultLocation = (urlParameters.defaultLocation || _settings.defaultLocation);
			const defaultTileLayer = (urlParameters.defaultTileLayer || _settings.defaultTileLayer);
			
			// Create the map
			const map = L.map (mapUi.mapDivId, {
				center: [defaultLocation.latitude, defaultLocation.longitude],
				zoom: defaultLocation.zoom,
				layers: baseLayersById[defaultTileLayer],	// Documentation suggests tileLayers is all that is needed, but that shows all together
				maxZoom: _settings.maxZoom,
				minZoom: _settings.minZoom,
				maxBounds: _settings.maxBounds
			}).setActiveArea ('activearea', /* keepCenter = */ true);	// Adjust the active area to make the visible centre (i.e. minus the sidebar, in single map mode) be the centre for zoom/similar operations
			map.attributionControl.setPrefix ('');
			
			// Prevent page jumping when using +/- buttons; see: https://stackoverflow.com/questions/57184529/
			map.getContainer().focus = function () {};
			
			// Set a class corresponding to the map tile layer, so that the background can be styled with CSS
			onlineatlas.setMapBackgroundColour (tileLayers[0].options);
			map.on('baselayerchange', function(e) {
				onlineatlas.setMapBackgroundColour (baseLayers[e.name].options);
			});
			
			// Add static GeoJSON overlay to filter out non-GB locations
			onlineatlas.addCountryOverlay (mapUi);
			
			// Set the zoom and determine whether the map is zoomed out too far, set the mouse cursor
			onlineatlas.manageZoomedOut (mapUi, map);
			map.on ('zoomend', function () {
				onlineatlas.manageZoomedOut (mapUi, map);
			});
			
			// Zoom in on single click if zoomed out, if enabled
			if (_settings.zoomedOut) {
				map.on ('click', function (e) {
					if (mapUi.zoomedOut) {
						map.setZoomAround (e.latlng, (_settings.zoomedOut + 1));
					}
				});
			}
			
			// Add the base (background) layer switcher
			L.control.layers(baseLayers, null, {position: 'bottomright'}).addTo(map);
			
			// Add geocoder control
			onlineatlas.createGeocoder (mapUi);
			
			// Add hash support
			if (mapUi.index == 0) {		// If more than one map on the page, apply only to the first one
				new L.Hash (map, baseLayersById);
			}
			
			// Add full screen control
			map.addControl(new L.Control.Fullscreen({pseudoFullscreen: true}));
			
			// Add geolocation control
			L.control.locate({
				icon: 'fa fa-location-arrow',
				locateOptions: {maxZoom: 12}
			}).addTo(map);
			
			// Attach the map to the mapUi
			mapUi.map = map;
		},
		
		
		// Function to parse the URL parameters
		getUrlParameters: function ()
		{
			// Start a list of parameters
			const urlParameters = {};
			
			// Get the location from the URL
			urlParameters.defaultLocation = null;
			urlParameters.defaultTileLayer = null;
			if (window.location.hash) {
				const hashParts = window.location.hash.match (/^#([0-9]{1,2})\/([\-.0-9]+)\/([\-.0-9]+)\/([a-z0-9]+)$/);	// E.g. #17/51.51137/-0.10498/bartholomew
				if (hashParts) {
					urlParameters.defaultLocation = {
						latitude: hashParts[2],
						longitude: hashParts[3],
						zoom: hashParts[1]
					};
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
			const backgroundColour = (tileLayerOptions.backgroundColour ? tileLayerOptions.backgroundColour : '');
			$('.leaflet-container').css ('background-color', backgroundColour);
		},
		
		
		// Manage behaviour when zoomed-out
		manageZoomedOut: function (mapUi, map)
		{
			// Determine if zoomed out
			mapUi.currentZoom = map.getZoom ();
			mapUi.zoomedOut = (_settings.zoomedOut ? (mapUi.currentZoom <= _settings.zoomedOut) : false);
			
			// Set mouse cursor based on zoom status
			$('#' + mapUi.mapDivId).css ('cursor', (mapUi.zoomedOut ? 'zoom-in' : 'auto'));
		},
		
		
		// Wrapper function to add a geocoder control
		createGeocoder: function (mapUi)
		{
			// Create a div for the geocoder within the map container
			const geocoderDivId = 'geocoder' + mapUi.index;
			$('#' + mapUi.containerDivId).prepend ('<div id="' + geocoderDivId + '" class="geocoder"></div>');
			
			// Create the input form within the geocoder container
			$('#' + geocoderDivId).append ('<input type="text" name="location" autocomplete="off" placeholder="Search locations and move map" tabindex="1" />');
			
			// Attach the autocomplete library behaviour to the location control
			autocomplete.addTo ('#' + geocoderDivId + ' input', {
				sourceUrl: _settings.geocoderApiBaseUrl + '?key=' + _settings.geocoderApiKey + '&bounded=1&fields=name,near,type,bbox&bbox=' + _settings.autocompleteBbox,
				appendTo: '#' + geocoderDivId,
				select: function (event, ui) {
					const bbox = ui.item.feature.properties.bbox.split(',');
					mapUi.map.fitBounds([ [bbox[1], bbox[0]], [bbox[3], bbox[2]] ]);
					event.preventDefault();
				}
			});
		},
		
		
		// Function to create the navigation panel
		createNav: function (mapUi)
		{
			// Affix the legend
			const navigationpanel = L.control({position: 'topright'});
			
			// Define its contents
			const navigationpanelDivClass = 'navigationpanel' + mapUi.index;
			navigationpanel.onAdd = function () {
				const panelDiv = L.DomUtil.create ('div', 'navigationpanel ' + navigationpanelDivClass);
				L.DomEvent.disableClickPropagation (panelDiv);		// Prevent drag/click propagating to the map; see: https://stackoverflow.com/a/37629102/
				L.DomEvent.on (panelDiv, 'mousewheel', L.DomEvent.stopPropagation);		// Prevent scroll wheel changes propagating to the map, as this panel may be scrollable; see: https://gis.stackexchange.com/a/154592
				return panelDiv;
			};
			
			// Add to the map
			navigationpanel.addTo (mapUi.map);
			
			// Create a div for the nav within the map container
			mapUi.navDivId = 'nav' + mapUi.index;
			$('.' + navigationpanelDivClass).prepend ('<nav id="' + mapUi.navDivId + '"></nav>');
			
			// Create a form within the nav
			$('#' + mapUi.navDivId).append ('<form></form>');
			
			// Create a CSV export link
			if (_settings.export) {
				const exportDivId = 'export' + mapUi.index;
				$('#' + mapUi.navDivId + ' form').prepend ('<p id="' + exportDivId + '" class="export"><a class="exportcsv" href="#" title="Export the current view (as shown on the map) as raw data in CSV format">Exports: <img src="/images/icons/page_excel.png" alt="" /></a> <a class="exportgeojson" href="#" title="Export the current view (as shown on the map) as raw data in GeoJSON format (for GIS)"><img src="/images/icons/page_code.png" alt="" /></a></p>');
			}
			
			// Create a PDF export link
			if (_settings.pdfLink) {
				const exportPdfDivId = 'pdf' + mapUi.index;
				$('#' + mapUi.navDivId + ' form').prepend ('<p id="' + exportPdfDivId + '" class="export"><a class="pdfmap noautoicon" href="#" title="Download a PDF of this data">Download: <img src="/images/icons/page_white_acrobat.png" alt="" /></a></p>');
			}
			
			// Create the year range control by creating a space (with known height); this is not yet populated as the year range control needs to know the calculated box sizing after scrollbars have appeared
			$('#' + mapUi.navDivId + ' form').append ('<h3>Year:</h3>');
			$('#' + mapUi.navDivId + ' form').append ('<div class="yearrangecontrol"></div>');
			
			// Build the field controls
			const fieldControls = onlineatlas.buildFieldControls (mapUi.navDivId, mapUi.index);
			
			// Add the (small nav) select after the year
			$('#' + mapUi.navDivId + ' form').append (fieldControls.selectHtml);
			
			// Add variations controls
			const variationsControlsHtml = onlineatlas.buildVariationsControls ();
			$('#' + mapUi.navDivId + ' form').append (variationsControlsHtml);
			
			// Create the year control within the form
			$('#' + mapUi.navDivId + ' form').append (fieldControls.radiobuttonsHtml);
			
			// Populate the year range control, now that the box sizing will be stable since all elements are now present
			mapUi.yearDivId = 'year' + mapUi.index;
			onlineatlas.addYearRangeControl (mapUi.navDivId, mapUi.yearDivId, _settings.defaultDataset);
			
			// Register a slide menu handler, if groupings are present
			if (_settings.expandableHeadings && onlineatlas.hasGroups) {
				$('.mapcontainer nav#' + mapUi.navDivId + ' form div.radiobuttons h4').click (function (event) {
					
					// Fold out menu
					$(this).next('div').slideToggle();
					
					// Rotate arrow
					if ($('i', this).css('transform') == 'none') {
						$('i', this).css('transform', 'rotate(90deg)');
					} else {
						$('i', this).css('transform', 'none');
					}
					
					// Firefox: Prevent closing straight after opening; not sure why this is needed
					event.preventDefault();
				});
				
				// Expand the heading containing the default field if required
				if (_settings.defaultField) {
					if (_settings.fields[_settings.defaultField].grouping) {
						const radiobuttonId = 'field' + mapUi.index + '_' + onlineatlas.htmlspecialchars (_settings.defaultField);
						$('#' + radiobuttonId).parent().parent().slideToggle();
						$('#' + radiobuttonId).parent().parent().prev('h4').find('i').css('transform', 'rotate(90deg)');
					}
				}
			}
			
			// Register a handler to dim out options which are not available for the selected year
			onlineatlas.dimUnavailableHandler (mapUi);
			$('#' + mapUi.navDivId + ' form input[name="year"]').on('change', function() {
				onlineatlas.dimUnavailableHandler (mapUi);
			});
		},
		
		
		// Function to build variations controls
		buildVariationsControls: function ()
		{
			// End if no variations
			if ($.isEmptyObject (_settings.variations)) {return;}
			
			// Start the HTML
			let html = '';
			
			// Add control for each variation
			$.each (_settings.variations, function (variationLabel, variationOptions) {
				html += '<h3>' + onlineatlas.htmlspecialchars (variationLabel) + ':</h3>';
				html += '<p id="variations">';
				$.each (variationOptions, function (variation, label) {
					html += '<span>';
					html += '<label>';
					html += '<input type="radio" name="' + _variationIds[variationLabel].toLowerCase() + '" value="' + variation + '"' + (variation == _settings.defaultVariations[variationLabel] ? ' checked="checked"' : '') + ' />';
					html += ' ' + onlineatlas.htmlspecialchars (label);
					html += '</label>';
					html += '</span>';
				});
				html += '</p>';
			});
			
			// Return the HTML
			return html;
		},
		
		
		// Function to build the field controls - the radiobutton, and its select (which proxies to the radiobutton)
		buildFieldControls: function (mapUiNavDivId, mapUiIndex)
		{
			// Group the fields
			const fieldGroups = onlineatlas.groupFields (_settings.fields);
			
			// Define the introduction HTML
			const introductionHtml = '<h3>Show:</h3>';
			
			// Build radiobutton and select list options; both are created up-front, and the relevant one hidden according when changing to/from side-by-side mode
			let radiobuttonsHtml = '';
			let selectHtml = '';
			let hasGroups = false;
			$.each (fieldGroups, function (i, fieldGroup) {
				
				// Determine the heading, if any
				const heading = (fieldGroup.name.match(/^_[0-9]+$/) ? false : fieldGroup.name);	// Virtual fields use _<number>, as per virtualGroupingIndex below
				
				// Add heading for this group if required
				if (heading) {
					radiobuttonsHtml += '<h4>' + onlineatlas.htmlspecialchars (heading);
					if (_settings.expandableHeadings) {
						radiobuttonsHtml += ' <i class="fa fa-chevron-circle-right iconrotate"></i>';
					} else {
						radiobuttonsHtml += ':';
					}
					radiobuttonsHtml += '</h4>';
					radiobuttonsHtml += '<div class="fieldgroup">';
					selectHtml += '<optgroup label="' + onlineatlas.htmlspecialchars (heading) + ':">';
					hasGroups = true;
				}
				
				// Add each field
				$.each (fieldGroup.fields, function (j, id) {
					const field = _settings.fields[id];
					
					// Skip general fields, like year
					if (field.general) {return /* i.e. continue */;}
					
					// Determine if this is the null field, if enabled
					const isNullField = (_settings.nullField && (id == _settings.nullField));
					
					// Construct the radiobutton list (for full mode)
					const fieldId = 'field' + mapUiIndex + '_' + onlineatlas.htmlspecialchars (id);
					radiobuttonsHtml += '<div class="field" title="' + onlineatlas.htmlspecialchars (field.description) + '">';
					radiobuttonsHtml += '<input type="radio" name="field" value="' + onlineatlas.htmlspecialchars (id) + '" id="' + fieldId + '"' + (id == _settings.defaultField ? ' checked="checked"' : '') + ' />';
					radiobuttonsHtml += '<label for="' + fieldId + '">';
					radiobuttonsHtml += onlineatlas.htmlspecialchars (field.label);
					if (_settings.enableFullDescriptions) {
						if (!isNullField) {
							radiobuttonsHtml += ' <a class="moredetails" data-field="' + id + '" href="#" title="Click to read FULL DESCRIPTION for:\n' + onlineatlas.htmlspecialchars ((field.description ? field.description : field.label)) + '">(?)</a>';
						}
					}
					radiobuttonsHtml += '</label>';
					radiobuttonsHtml += '</div>';
					
					// Select widget (for side-by-side mode)
					selectHtml += '<option value="' + onlineatlas.htmlspecialchars (id) + '"' + (id == _settings.defaultField ? ' selected="selected"' : '') + '>' + onlineatlas.htmlspecialchars (field.label) + '</option>';
				});
				
				// End heading container for this group
				if (heading) {
					radiobuttonsHtml += '</div>';	// .fieldgroup
					selectHtml += '</optgroup>';
				}
			});
			
			// Add a container for the radiobuttons
			radiobuttonsHtml = '<div class="radiobuttons' + (_settings.expandableHeadings ? ' expandable' : '') + '">' + introductionHtml + radiobuttonsHtml + '</div>';
			
			// Assemble the select widget
			selectHtml = '<div class="select">' + introductionHtml + '<select name="field_proxy" id="field' + mapUiIndex + '">' + selectHtml + '</select>' + '</div>';
			
			// Proxy changed select value to radiobutton value, and explicitly trigger change to the value
			$('#' + mapUiNavDivId).on ('change', 'form select[name="field_proxy"]', function () {		// Late-binding, as doesn't yet exist
				const value = $(this).val();
				$('#' + mapUiNavDivId + ' form input[name="field"][type="radio"][value="' + value + '"]').prop ('checked', true).trigger ('change');
			});
			
			// Copy changed radiobutton to select value, to keep the radiobutton in sync
			$('#' + mapUiNavDivId).on ('input', 'form input[name="field"][type="radio"]', function () {		// Late-binding, as doesn't yet exist
				const value = $(this).val();
				$('#' + mapUiNavDivId + ' form select[name="field_proxy"]').val (value);	// No .trigger(change), to avoid loop
			});
			
			// Return the two controls
			return {
				radiobuttonsHtml: radiobuttonsHtml,
				selectHtml: selectHtml,
				hasGroups: hasGroups
			};
		},
		
		
		// Function to provide a handler to dim out options which are not available for the selected year
		dimUnavailableHandler: function (mapUi)
		{
			// Obtain the year value
			const yearIndex = $('#' + mapUi.navDivId + ' #' + mapUi.yearDivId).val();
			const yearValue = _settings.datasets[yearIndex];
			
			// Loop through each field, and determine the years which are unavailable
			$.each (_settings.fields, function (fieldKey, field) {
				if (field.unavailable) {
					
					// Determine the paths of each control that should be made unavailable
					const fieldId = 'field' + mapUi.index + '_' + onlineatlas.htmlspecialchars (fieldKey);		// E.g. field0_P
					const pathsList = [
						'#' + mapUi.navDivId + ' form input[type="radio"]#' + fieldId,
						'#' + mapUi.navDivId + ' form label[for="' + fieldId + '"]',
						'#' + mapUi.navDivId + ' form select[id="field' + mapUi.index + '"]',
						'#' + mapUi.navDivId + ' form option[value="' + fieldKey + '"]'
					];
					const paths = pathsList.join (', ');
					
					// Dim out options
					// #!# This should actually make buttons unselectable, etc.
					// #!# No support yet for variations
					if ($.inArray (yearValue, field.unavailable) != -1) {	// https://api.jquery.com/jQuery.inArray/
						$(paths).addClass ('unavailable');
						//$('input#' + fieldId).prop('title', '[Not available for this year]');
					} else {
						$(paths).removeClass ('unavailable');
						//$('input#' + fieldId).removeAttr('title');
					}
				}
			});
		},
		
		
		// Function to create a year range control, including labels
		addYearRangeControl: function (navDivId, yearDivId, initialYear)
		{
			// Determine the default value
			if (!initialYear) {initialYear = _settings.datasets[1];}	// Second by default
			const initialIndexValue = _settings.datasets.indexOf (initialYear);
			
			// Determine whether to use small labels
			// This explicitly does not use width, as that creates complexities of having to redraw the control for side-by-side mode
			const smallLabelThreshold = 7;		// Determined by observation
			const totalLabels = _settings.datasets.length;
			const rangeClass = (totalLabels > smallLabelThreshold ? ' smalllabels' : '');
			
			// Define the width of the browser's rendering of a range handle, which we have to adjust for since it does NOT extend beyond the edge; see: https://css-tricks.com/sliding-nightmare-understanding-range-input/
			const thumbRangeShadowDomWidth = 16;	// Chrome is 16px; Firefox is 20px
			
			// Construct a visible list and datalist (so that ticks are created) for the year control
			let listHtml = '<ul class="rangelabels' + rangeClass + '">';
			const datalistId = navDivId + 'ticks';
			let datalistHtml = '<datalist id="' + datalistId + '">';
			$.each (_settings.datasets, function (index, year) {
				listHtml += '<li style="width: calc(100% / ' + totalLabels + ');" data-index="' + index + '">' + year + '</li>';
				datalistHtml += '<option>' + index + '</option>';
			});
			listHtml += '</ul>';
			datalistHtml += '</datalist>';
			
			// Combine the range slider and the associated datalist
			// Ticks have no styling support currently, though the technique here could be used: https://css-tricks.com/why-do-we-have-repeating-linear-gradient-anyway/
			let html = '<input type="range" name="year" id="' + yearDivId + '" min="0" max="' + (_settings.datasets.length - 1) + '" step="1" value="' + initialIndexValue + '" style="width: calc(100%' +  ' - (100% / ' + totalLabels + ') + ' + thumbRangeShadowDomWidth + 'px);" list="' + datalistId + '" />';
			html += listHtml;
			html += datalistHtml;
			
			// Add the control to the HTML
			$('#' + navDivId + ' form .yearrangecontrol').html (html);
			
			// Set label (list item) highlight initially and when the value is changed
			$('#' + navDivId + ' ul.rangelabels li:nth-child(' + (parseInt (initialIndexValue) + 1) + ')').addClass ('selected');
			$('#' + navDivId + ' form .yearrangecontrol input').on ('input', function () {
				const selectedIndex = $('#' + yearDivId).val ();
				$('#' + navDivId + ' ul.rangelabels li').removeClass ('selected');	// Clear any existing
				$('#' + navDivId + ' ul.rangelabels li:nth-child(' + (parseInt (selectedIndex) + 1) + ')').addClass ('selected');
			});
			
			// Set value if the label is clicked on
			$('#' + navDivId + ' form .yearrangecontrol ul.rangelabels li').on ('click', function () {
				$('#' + navDivId + ' form .yearrangecontrol input').val (this.dataset.index);
				$('#' + navDivId + ' form .yearrangecontrol input').trigger ('input');	// Ensure highlight function gets an event
				$('#' + navDivId + ' form .yearrangecontrol input').trigger ('change');	// Ensure API call gets made
			});
		},
		
		
		// Function to create ordered group clusterings
		groupFields: function (fields)
		{
			// Group fields, either by explicit grouping (which will have fold-out headings) or virtual grouping (which not have headings)
			const groupings = {};
			let virtualGroupingIndex = 0;
			let orderingIndex = 0;
			$.each (fields, function (id, field) {
				let grouping;
				if (field.grouping) {
					grouping = field.grouping;
				} else {
					grouping = '_' + virtualGroupingIndex;	// E.g. _0, _1, etc.
					virtualGroupingIndex++;
				}
				if (!groupings[grouping]) {		// Initialise container if not already present
					groupings[grouping] = {ordering: orderingIndex, fields: []};
					orderingIndex++;
				}
				groupings[grouping]['fields'].push (id);
			});
			
			// Order the groupings
			const fieldGroups = [];
			$.each (groupings, function (name, grouping) {
				fieldGroups[grouping.ordering] = {name: name, fields: grouping.fields};
			});
			
			// Return the field groups
			return fieldGroups;
		},
		
		
		// Function to create a location overlay pane; see: http://leafletjs.com/examples/map-panes/
		createLocationsOverlayPane: function (map)
		{
			// Create a pane
			map.createPane('labels');
			map.getPane('labels').style.zIndex = 650;
			map.getPane('labels').style.pointerEvents = 'none';
			
			// Create a labels layer; see: https://carto.com/location-data-services/basemaps/
			//const locationLabels = L.tileLayer('http://tiles.oobrien.com/shine_labels_cdrc/{z}/{x}/{y}.png', {
			const locationLabels = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_only_labels/{z}/{x}/{y}.png', {
				attribution: '&copy; OpenStreetMap, &copy; CartoDB',
				pane: 'labels'
			});
			
			// Add to the map
			locationLabels.addTo(map);
		},
		
		
		// Function to create a country overlay
		addCountryOverlay: function (mapUi)
		{
			// Get the GeoJSON data
			fetch (_baseUrl + '/overlay.geojson')
				.then (function (response) { return response.json (); })
				.then (function (geojson) {
					
					// Set the overlay
					mapUi.map.createPane ('overlay');	// See: https://leafletjs.com/examples/map-panes/
					mapUi.map.getPane ('overlay').style.zIndex = 700;	// Names layer is 650
					const overlayOptions = {
						style: {
							color: 'transparent',	// Line colour
							fillColor: '#a5c2ba',
							fillOpacity: 1
						},
						pane: 'overlay',
						interactive: false
					};
					const overlay = L.geoJSON (geojson, overlayOptions).addTo (mapUi.map);
					overlay.bringToFront ();
			});
		},
		
		
		// Function to show a welcome message on first run
		welcomeFirstRun: function ()
		{
			// End if no welcome message
			if (!_settings.firstRunMessageHtml) {return;}
			
			// End if cookie already set
			const name = 'welcome';
			if (Cookies.get (name)) {return;}
			
			// Set the cookie
			Cookies.set (name, '1', {expires: 14});
			
			// Show the dialog
			vex.dialog.alert ({unsafeMessage: _settings.firstRunMessageHtml});
		},
		
		
		// Handler for a more details popup layer
		moreDetails: function ()
		{
			// Create popup when link clicked on
			$('.moredetails').click (function (e) {
				
				// Obtain the field
				const field = $(this).attr('data-field');
				
				// Obtain the content; see: https://stackoverflow.com/a/14744011/ and https://stackoverflow.com/a/25183183/
				const templateHtml = $('template#aboutfields')[0].content;
				let dialogBoxContentHtml = $(templateHtml).find('h3.' + field).nextUntil('h3, h2').addBack().map(function() {
					return this.outerHTML;
				}).get().join('');
				if (!dialogBoxContentHtml) {
					dialogBoxContentHtml = '<p><em>Sorry, no further details for this field available yet.</em></p>';
				}
				
				// Wrap in a div
				dialogBoxContentHtml = '<div id="moredetailsboxcontent">' + dialogBoxContentHtml + '</div>';
				
				// Create the dialog box
				onlineatlas.dialogBox ('#moredetails', field, dialogBoxContentHtml);
				
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
			const apiData = {};
			
			// Supply the bbox and zoom
			apiData.bbox = mapUi.map.getBounds().toBBoxString();
			apiData.zoom = mapUi.currentZoom;
			
			// Set the field, based on the layer radiobutton/dropdown value
			apiData.field = mapUi.field;
			
			// Set the year, based on the slider value
			const yearIndex = $('#' + mapUi.yearDivId).val();
			apiData.year = _settings.datasets[yearIndex];
			
			// Append the variation, if supported
			if (!$.isEmptyObject (_settings.variations)) {
				$.each (_settings.variations, function (variationLabel, variationOptions) {
					const fieldname = _variationIds[variationLabel].toLowerCase ();
					apiData[fieldname] = mapUi.variations[fieldname];
				});
			}
			
			// Update the URL
			if (mapUi.index == 0) {		// Apply to left only in side-by-side
				onlineatlas.updateUrl (apiData);
			}
			
			// Update the export link with the new parameters
			if (_settings.export) {
				const requestSerialised = $.param (apiData);
				const csvExportUrl = _baseUrl + '/data.csv?' + requestSerialised;
				$('#' + mapUi.navDivId + ' p.export a.exportcsv').attr('href', csvExportUrl);
				const geojsonExportUrl = _baseUrl + '/data.geojson?' + requestSerialised;
				$('#' + mapUi.navDivId + ' p.export a.exportgeojson').attr('href', geojsonExportUrl);
			}
			
			// Update the PDF link with the new parameters
			if (_settings.pdfLink) {
				let variationsSlug = '';
				if (!$.isEmptyObject (_settings.variations)) {
					const variationsComponents = [];
					$.each (_settings.variations, function (variationLabel, variationOptions) {
						const fieldname = _variationIds[variationLabel].toLowerCase();
						variationsComponents.push (mapUi.variations[fieldname].toLowerCase());
					});
					variationsSlug = variationsComponents.join ('_') + '_';
				}
				const pdfMapUrl = _settings.pdfBaseUrl.replace ('%baseUrl', _baseUrl) + apiData.field.toLowerCase() + '_' + variationsSlug + apiData.year + '.pdf';	// E.g. /resources/bld_m_a_1851.pdf
				$('#' + mapUi.navDivId + ' p.export a.pdfmap').attr('href', pdfMapUrl);
			}
			
			// Start spinner, initially adding it to the page
			if (!$('#' + mapUi.containerDivId + ' #loading').length) {
				$('#' + mapUi.containerDivId).append('<img id="loading" src="' + _baseUrl + '/images/spinner.svg" />');
			}
			$('#' + mapUi.containerDivId + ' #loading').show();
			
			// Fetch data
			$.ajax ({
				url: _baseUrl + '/api/locations',
				dataType: (onlineatlas.browserSupportsCors () ? 'json' : 'jsonp'),		// Fall back to JSON-P for IE9
				crossDomain: true,	// Needed for IE<=9; see: https://stackoverflow.com/a/12644252/
				data: apiData,
				error: function (jqXHR, error, exception) {
					
					// Show error, unless deliberately aborted
					if (jqXHR.statusText != 'abort') {
						const errorData = $.parseJSON(jqXHR.responseText);
						alert ('Error: ' + errorData.error);
					}
				},
				success: function (data, textStatus, jqXHR) {
					
					// Remove spinner
					$('#' + mapUi.containerDivId + ' #loading').hide();
					
					// Show API-level error if one occured
					// #!# This is done here because the API still returns Status code 200
					if (data.error) {
						onlineatlas.removeLayer (mapUi);
						vex.dialog.alert ('Error: ' + data.error);
						return {};
					}
					
					// Show the data successfully
					onlineatlas.showCurrentData (mapUi, data);
				}
			});
		},
		
		
		// Function to update the URL, to provide persistency when a link is circulated
		// Format is /<baseUrl>/<layerId>/<year>/#<mapHashWithStyle> ; side-by-side is not supported
		updateUrl: function (parameters)
		{
			// End if not supported, e.g. IE9
			if (!history.pushState) {return;}
			
			// Construct the URL slug
			const field = parameters.field;
			const year = parameters.year;
			let urlSlug = '/' + field.toLowerCase() + '/' + year + '/';
			if (Object.keys (_settings.variations).length) {
				$.each (_settings.variations, function (variationLabel, variationOptions) {
					urlSlug += parameters[variationLabel.toLowerCase ()].toLowerCase () + '/';	// E.g. 'female/'
				});
			}
			
			// Construct the URL
			let url = _baseUrl;	// Absolute URL
			url += urlSlug;
			url += window.location.hash;
			
			// Construct the page title, based on the enabled layers
			if (!_title) {_title = document.title;}		// Obtain and cache the original page title
			let title = _title;
			title += ': ' + _settings.fields[field].label + ', ' + year;
			
			// Push the URL state
			history.pushState (urlSlug, title, url);
			document.title = title;		// Workaround for poor browser support; see: https://stackoverflow.com/questions/13955520/
		},
		
		
		// Function to show the data for a layer
		showCurrentData: function (mapUi, data)
		{
			// If this layer already exists, remove it so that it can be redrawn
			onlineatlas.removeLayer (mapUi);
			
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
							const thisLayer = e.target;
							thisLayer.setStyle({
								weight: 4
							});
							if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
								thisLayer.bringToFront();
							}
							
							// Update the summary box
							mapUi.summary.update (mapUi.field, thisLayer.feature, mapUi.currentZoom);
						},
						
						// Reset highlighting
						// NB this has to be inlined, and cannot be refactored to a 'resetHighlight' method, as the field is needed as a parameter
						mouseout: function (e) {
							
							// Reset the style
							const thisLayer = e.target;
							thisLayer.setStyle({
								weight: (mapUi.zoomedOut ? 0 : 1)
							});
							
							// Update the summary box
							mapUi.summary.update (mapUi.field, null, mapUi.currentZoom);
						}
					});
					
					// Enable popups (if close enough)
					if (!mapUi.zoomedOut) {
						const popupHtml = onlineatlas.popupHtml (feature);
						layer.bindPopup(popupHtml, {autoPan: false});
					}
				},
				
				// Style: base the colour on the specified colour field
				style: function (feature) {
					if (feature.properties[mapUi.field] == null) {
						return {
							color: '#333',
							dashArray: '5, 5',
							fillColor: 'white',
							weight: (mapUi.zoomedOut ? 0 : 1),
							fillOpacity: 0.25
						};
					} else {
						return {
							color: '#777',
							fillColor: onlineatlas.getColour (feature.properties[mapUi.field], mapUi.field),
							weight: (mapUi.zoomedOut ? 0 : 1),
							fillOpacity: 0.85
						};
					}
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
			// If the field has a colour set, just return that
			if (_settings.fields[field].hasOwnProperty ('colour')) {
				return _settings.fields[field].colour;
			}
			
			// Create a simpler variable for the intervals field
			const intervals = _settings.fields[field].intervals;
			
			// For a wildcard, return either the wildcard colour if there is a value, or the unknown value if not
			/* Example structure - note that the second value (NULL) is ignored, but NULL will then be styled in the legend as a dashed transparent box
				'intervalsWildcard' => 'Town (by name)',
				'intervals' => array (
					'Town (by name)'	=> 'blue',
					'Other areas'		=> NULL,
				),
			*/
			if (_settings.fields[field].hasOwnProperty ('intervalsWildcard')) {
				return (value ? intervals[_settings.fields[field].intervalsWildcard] : _settings.colourUnknown);
			}
			
			// If the intervals is an array, i.e. standard list of colour stops, loop until found
			if (intervals[0]) {		// Simple, quick check
				
				// Compare as float, except in intervals mode
				if (!_settings.intervalsMode) {
					value = parseFloat (value);
				}
				
				// Last interval
				const lastInterval = intervals.length - 1;
				
				// Loop through until found
				let interval;
				let colourStop;
				let matches;
				let i;
				for (i = 0; i < intervals.length; i++) {
					interval = intervals[i];
					colourStop = _settings.colourStops[i];
					
					// Check for the value being explicitly unknown
					if (_settings.valueUnknownString) {
						if (value == _settings.valueUnknownString) {
							return _settings.colourUnknown;
						}
					}
					
					// In intervals mode, match exact value
					if (_settings.intervalsMode) {
						if (value == interval) {
							return colourStop;
						}
					} else {
						
						// Exact value, e.g. '0'
						matches = interval.match (/^([.0-9]+)$/);
						if (matches) {
							if (value == parseFloat(matches[1])) {
								return colourStop;
							}
						}
						
						// Up-to range, e.g. '<10'
						matches = interval.match (/^<([.0-9]+)$/);
						if (matches) {
							if (value < parseFloat(matches[1])) {
								return colourStop;
							}
						}
						
						// Range, e.g. '5-10' or '5 - <10'
						matches = interval.match (/^([.0-9]+)(-| - <)([.0-9]+)$/);
						if (matches) {
							if ((value >= parseFloat(matches[1])) && (value < parseFloat(matches[3]))) {	// 10 treated as matching in 10-20, not 5-10
								return colourStop;
							}
							
							// Deal with last, where (e.g.) 90-100 is implied to include 100
							if (i == lastInterval) {
								if (value == parseFloat(matches[2])) {
									return colourStop;
								}
							}
						}
						
						// Excess value, e.g. '100+' or '≥100'
						matches = interval.match (/^([.0-9]+)\+$/);
						if (matches) {
							if (value >= parseFloat(matches[1])) {
								return colourStop;
							}
						}
						matches = interval.match (/^≥([.0-9]+)$/);
						if (matches) {
							if (value >= parseFloat(matches[1])) {
								return colourStop;
							}
						}
					}
				}
				
				// Unknown/other, if other checks have not matched
				console.log ('Unmatched value in layer ' + field + ': ' + value);
				return _settings.colourUnknown;
				
			// For pure key-value pair definition objects, read the value off
			} else {
				return intervals[value];
			}
		},
		
		
		// Function to define popup content
		popupHtml: function (feature /*, dataset */)
		{
			// Determine list of areas present in the data, to be shown in the title in hierarchical order
			const availableAreaFields = ['PARISH', 'SUBDIST', 'REGDIST', 'REGCNTY'];	// More specific first, so that listing is e.g. "Kingston, Surrey, London"
			const areaHierarchy = [];
			$.each (availableAreaFields, function (index, areaField) {
				if (feature.properties[areaField]) {
					areaHierarchy.push (feature.properties[areaField]);
				}
			});
			
			// Start with the title
			let html = '<p><strong>Displayed data for ' + areaHierarchy.join (', ') + /* ' in ' + _settings.datasets[dataset].name + */ ':</strong></p>';
			
			// Add table
			html += '<table id="chart" class="lines compressed">';
			$.each (feature.properties, function (field, value) {
				if (typeof value == 'string') {
					value = onlineatlas.htmlspecialchars (value);
				} else if (value == null) {
					value = '<span class="faded">' + _settings['nullDataMessage'] + '</span>';
				}
				html += '<tr class="' + field + '"><td>' + onlineatlas.htmlspecialchars (_settings.fields[field].label) + ':</td><td><strong>' + value + '</strong></td></tr>';
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
		
		
		// Function to make first character upper-case; see: https://stackoverflow.com/a/1026087/
		ucfirst: function (string)
		{
			return string.charAt(0).toUpperCase() + string.slice(1);
		},
		
		
		// Function to define summary box content
		summaryHtml: function (field, feature, currentZoom)
		{
			// If the field is the null field, show nothing
			if (_settings.nullField) {
				if (field == _settings.nullField) {
					return '';
				}
			}
			
			// Determine the field to use, and a suffix
			let geographicField = _settings.farField;
			if (_settings.closeZoom && _settings.closeField) {
				if (currentZoom >= _settings.closeZoom) {
					geographicField = _settings.closeField;
				}
			}
			
			// If there is no name for the geographic field, set a generic label
			if (feature.properties[geographicField] == null) {
				feature.properties[geographicField] = '[Unknown place name]';
			}
			
			// Set the value, rewriting NULL to the specified message
			let value = '<strong>' + feature.properties[field] + '</strong>';
			if (feature.properties[field] == null) {
				value = _settings['nullDataMessage'];
			}
			
			// Assemble the HTML
			const html = '<p>' + onlineatlas.htmlspecialchars (feature.properties[geographicField]) + ', in ' + feature.properties.year + ': ' + value + '</p>';
			
			// Return the HTML
			return html;
		},
		
		
		// Function to create and update the legend
		createLegend: function (mapUi)
		{
			// Affix the legend
			const legend = L.control({position: 'bottomleft'});
			
			// Define its contents
			legend.onAdd = function () {
				const panelDiv = L.DomUtil.create ('div', 'info legend');
				L.DomEvent.disableClickPropagation (panelDiv);		// Prevent drag/click propagating to the map; see: https://stackoverflow.com/a/37629102/
				return panelDiv;
			};
			
			// Add to the map
			legend.addTo(mapUi.map);
			
			// Set the initial value
			onlineatlas.setLegend (mapUi);
		},
		
		
		// Function to set the legend contents
		setLegend: function (mapUi)
		{
			// Handle null field
			if (_settings.nullField) {
				if (mapUi.field == _settings.nullField) {
					$('#' + mapUi.mapDivId + ' .legend').html ('');
					$('#' + mapUi.mapDivId + ' .legend').hide ();
					return;
				}
			}
			
			// Show if hidden
			$('#' + mapUi.mapDivId + ' .legend').show ();
			
			// If the intervals is an array, i.e. standard list of colour stops, loop until found
			let labelsRows = [];
			const intervals = _settings.fields[mapUi.field].intervals;
			if (intervals[0]) {		// Simple, quick check
				
				// Loop through each colour until found
				$.each (intervals, function (i, label) {
					labelsRows.push ('<tr><td>' + '<i style="background-color: ' + _settings.colourStops[i] + '; border-color: ' + _settings.colourStops[i] + ';"></i>' + '</td><td>' + onlineatlas.htmlspecialchars (label.replace('-', ' - ')) + '</td></tr>');
				});
				labelsRows.push ('<tr><td>' + '<i style="background-color: ' + _settings.colourUnknown + '; border: 1px dashed gray;"></i>' + '</td><td>' + onlineatlas.htmlspecialchars (_settings.valueUnknownString) + '</td></tr>');
				labelsRows = labelsRows.reverse();	// Legends should be shown highest first
			} else {
				$.each (intervals, function (key, colour) {
					labelsRows.push ('<tr><td>' + '<i style="background: ' + colour + ';' + (colour == null ? ' border: 1px dashed gray;' : '') + '"></i>' + '</td><td>' + onlineatlas.htmlspecialchars (onlineatlas.ucfirst (key)) + '</td></tr>');
				});
			}
			
			// Compile the HTML
			let html = '<h4>' + onlineatlas.htmlspecialchars (_settings.fields[mapUi.field].label) + '</h4>';
			html += '<div id="legenddetail">';
			html += '<p>' + (_settings.fields[mapUi.field].descriptionLegendHtml ? _settings.fields[mapUi.field].descriptionLegendHtml : onlineatlas.htmlspecialchars (_settings.fields[mapUi.field].description)) + '</p>';
			if (!_settings.fields[mapUi.field].hasOwnProperty ('static')) {
				html += '<table>' + labelsRows.join ('\n') + '</table>';
			}
			html += '</div>';
			
			// Add tooltips if <abbr> present in legend extended description
			if (_settings.fields[mapUi.field].descriptionLegendHtml && (_settings.fields[mapUi.field].descriptionLegendHtml.indexOf ('<abbr>') >= 0)) {
				$('body').tooltip ({
					selector: '.legend p abbr',		// Late binding equivalent; see: https://stackoverflow.com/a/10420203/
					track: true
				});
			}
			
			// Set the HTML
			$('#' + mapUi.mapDivId + ' .legend').html (html);
		},
		
		
		// Function to create a summary box
		summaryControl: function (mapUi)
		{
			// Create the control
			mapUi.summary = L.control({position: 'topleft'});
			
			// Define its contents
			const map = mapUi.map;
			mapUi.summary.onAdd = function () {
			    this._div = L.DomUtil.create('div', 'info summary'); // create a div with a classes 'info' and 'summary'
				L.DomEvent.disableClickPropagation (this._div);		// Prevent drag/click propagating to the map; see: https://stackoverflow.com/a/37629102/
			    this.update(mapUi.field, null, mapUi.currentZoom);
			    return this._div;
			};
			
			// Register a method to update the control based on feature properties passed
			mapUi.summary.update = function (field, feature, currentZoom) {
				let html = '<h4>' + onlineatlas.htmlspecialchars (_settings.fields[field].label) + '</h4>';
				if (_settings.fields[field].hasOwnProperty ('static')) {
					html += '';
				} else {
					html += (feature ?
						onlineatlas.summaryHtml (field, feature, currentZoom)
						: 'Hover over an area to view details.');
				}
				this._div.innerHTML = html;
			};
			
			// Add to the map
			mapUi.summary.addTo(map);
		},
		
		
		// Function to add tooltips, using the title value
		tooltips: function ()
		{
			// Use jQuery tooltips; see: https://jqueryui.com/tooltip/
			$('form .radiobuttons, .export').tooltip ({
				track: true
			});
			$('form .radiobuttons a.moredetails').tooltip ({
				track: true,
				classes: {'ui-tooltip': 'moredetails'},
				content: function(callback) {
					callback ($(this).prop('title').replace('\n', '<br />'));
					return true;	// Avoid nested tooltips being left visible
				}
			});
		}
	};
	
} (jQuery));
