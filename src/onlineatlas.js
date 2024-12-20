// Online atlas application code

/*jslint browser: true, white: true, single: true, for: true */
/*global alert, console, window, Cookies, $, jQuery, maplibregl, syncMaps, autocomplete, vex */

const onlineatlas = (function ($) {
	
	'use strict';
	
	
	// Internal class properties
	let _baseUrl;
	const _mapUis = {};
	const _manualAttribution = null;
	const _backgroundMapStyles = {};
	const _backgroundStylesInternalPrefix = 'background-';
	let _variationIds = {};
	let _title = false;
	let _popup;
	
	
	// Settings
	const _settings = {
		
		// Default map view
		// #!# This is being restated - should use the PHP side and not duplicate it
		defaultLocation: {
			latitude: 53.615,
			longitude: -1.53,
			zoom: 5.8
		},
		
		// Max/min zoom
		maxZoom: 13,	// Zoomed in
		minZoom: 5,		// Zoomed out
		
		// Max bounds
		maxBounds: [[-14, 47], [12, 62]],	// South, West ; North, East
		
		// Tileservers; historical map sources are listed at: http://wiki.openstreetmap.org/wiki/National_Library_of_Scotland
		defaultTileLayer: 'bartholomew',
		tileUrls: {
			bartholomew: {
				tiles: 'https://mapseries-tilesets.s3.amazonaws.com/bartholomew_great_britain/{z}/{x}/{y}.png',	// E.g. https://mapseries-tilesets.s3.amazonaws.com/bartholomew_great_britain/12/2052/1344.png
				label: 'NLS - Bartholomew Half Inch, 1897-1907',
				maxZoom: 15,
				attribution: '&copy; <a href="http://maps.nls.uk/copyright.html">National Library of Scotland</a>',
				backgroundColour: '#a2c3ba'
			},
			os1inch: {
				tiles: 'https://mapseries-tilesets.s3.amazonaws.com/1inch_2nd_ed/{z}/{x}/{y}.png',	// E.g. https://mapseries-tilesets.s3.amazonaws.com/1inch_2nd_ed/15/16395/10793.png
				label: 'NLS - OS One Inch, 1885-1900',
				maxZoom: 15,
				attribution: '&copy; <a href="https://maps.nls.uk/copyright.html">National Library of Scotland</a>',
				backgroundColour: '#f0f1e4',
				key: '/images/mapkeys/os1inch.jpg'
			},
			mapnik: {
				tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',	// E.g. https://tile.openstreetmap.org/16/32752/21788.png
				label: 'OpenStreetMap style (modern)',
				maxZoom: 19,
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
			},
			osopendata: {
				tiles: 'https://os.openstreetmap.org/sv/{z}/{x}/{y}.png',	// E.g. https://os.openstreetmap.org/sv/18/128676/81699.png
				label: 'OS Open Data (modern)',
				maxZoom: 19,
				attribution: 'Contains Ordnance Survey data &copy; Crown copyright and database right 2010'
			}
		},
		
		// Geocoder
		geocoderApiBaseUrl: 'https://api.cyclestreets.net/v2/geocoder',
		geocoderApiKey: 'YOUR_API_KEY',		// Obtain at https://www.cyclestreets.net/api/apply/
		autocompleteBbox: '-6.6577,49.9370,1.7797,57.6924',
		
		// Dataset years
		years: [],	// Will be supplied
		defaultYear: false,
		
		// Fields and their labels
		fields: {},		// Will be supplied
		defaultField: '',		// Will be supplied
		nullField: '',
		availableGeneralFields: [],	// Will be supplied
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
		
		// Area names
		areaNameField: false,
		areaNameFallbackField: false,
		
		// Export mode enabled
		export: true,
		pdfLink: false,
		pdfBaseUrl: '%baseUrl/resources/',		// %baseUrl supported
		
		// Welcome message
		firstRunMessageHtml: '',
		
		// Number rounding
		popupsRoundingDP: 2
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
				if (typeof value.intervals == 'string' && value.intervals.length > 0) {		// Intervals = '' indicates no intervals
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
			onlineatlas.createMapUi (0);
			
			// Show first-run welcome message if the user is new to the site
			onlineatlas.welcomeFirstRun ();
			
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
			if ($.inArray (year, _settings.years) == -1) {return false;}	// https://api.jquery.com/jQuery.inArray/
			
			// If variations are enabled, check variation is present and valid
			let variations = false;
			if (!$.isEmptyObject (_settings.variations)) {
				variations = onlineatlas.variationsPresent (urlParts.slice (2));	// Omit field and year
				if (variations === false) {return false;}
			}
			
			// Set the default field and year
			_settings.defaultField = field;
			_settings.defaultYear = year;
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
			$('#nav-mobile').click (function (e) {
				if ($('#onlineatlas nav').is(':visible')) {
					$('#onlineatlas nav').hide ('slide', {direction: 'right'}, 250);
				} else {
					$('#onlineatlas nav').animate ({width:'toggle'}, 250);
				}
				e.stopPropagation ();
			});
			
			// Open menu by default on mobile
			if ($('#nav-mobile').is(':visible')) {
				$('#nav-mobile').click ();
			}
			
			// Disable title tooltips
			$('#nav-mobile').click (function (e) {
				if ($('#onlineatlas nav').is(':visible')) {
					$('.radiobuttons .field').removeAttr ('title');
				}
				e.stopPropagation ();
			});
			
			/*
			// Enable implicit click/touch on map as close menu
			if ($('#nav-mobile').is (':visible')) {
				$('#onlineatlas .map').click (function (e) {		// #!# Use of .activearea is a poor dependency, but using .map causes autoclose, presumably due to a .trigger('click') somewhere
					if ($('#onlineatlas nav').is (':visible')) {
						$('#onlineatlas nav').hide ('slide', {direction: 'right'}, 250);
						e.preventDefault ();
					}
				});
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
				
				// Add mobile class to legend, so that state can be handled in CSS
				$('.legend').addClass ('mobile');
				
				// Set minimised by default
				$('.legend').addClass ('minimised');
				
				// Add the X and Show details controls
				$('.legend').prepend ('<p id="legendclose" class="closebutton"><a href="#">&#10006;</a></p>');
				$('.legend').append ('<p id="legendshow"><a href="#">Show details &raquo;</a></p>');
				
				// When the show details link is clicked, show the detail, hide the link and show the X
				$('#legendshow a').click (function (e) {
					$('.legend').removeClass ('minimised');
					e.preventDefault ();
				});
				
				// When the close button is clicked, hide the detail, show the link and hide the X
				$('#legendclose a').click (function (e) {
					$('.legend').addClass ('minimised');
					e.preventDefault ();
				});
			}
		},
		
		
		// Function to add support for side-by-side comparison
		sideBySide: function ()
		{
			// Add checkbox controls to enable and syncronise side-by-side maps
			$('#mapcontainers').prepend (onlineatlas.createSidebysideCheckbox ());
			
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
						onlineatlas.createMapUi (1, true, true);
					}
					
					// Show the second map
					$('#mapcontainer1').show ();
					
				// Revert to normal, single map mode
				} else {
					$('#mapcontainer1').hide ();
					$('#mapcontainers').removeClass('sidebyside');
				}
			});
		},
		
		
		// Function to create checkbox for side-by-side mode
		createSidebysideCheckbox: function ()
		{
			let html = '<p id="comparebox">';
			html += '<span id="comparebutton"><label><img src="/images/icons/application_tile_horizontal.png" alt="" class="icon" /> Compare side-by-side &nbsp;<input id="compare" name="compare" type="checkbox"></label></span>';
			html += '</p>';
			return html;
		},
		
		
		// Main function to create a map panel
		createMapUi: function (mapUiIndex, cloneFormValues, enableSync)
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
			
			// Set up the layers when the map load is ready
			mapUi.map.on ('load', function () {
				
				// Initialise the data layers on map load and on style change
				mapUi.sourceId = [];
				_settings.years.forEach (function (year) {
					onlineatlas.initialiseDataLayer (mapUi, year);
				});
				$(document).on ('style-changed-' + mapUiIndex, function () {
					_settings.years.forEach (function (year) {
						onlineatlas.initialiseDataLayer (mapUi, year);
					});
				});
				
				// Create the nav UI
				onlineatlas.createNav (mapUi);
				
				// Create the locations overlay pane; this is done after the data layer loading so that these appear on top
				onlineatlas.createLocationsOverlayPane (mapUi.map);
				
				// Add static GeoJSON overlay to filter out non-GB locations; this is done ater the locations overlay to avoid floating place names
				onlineatlas.addCountryOverlay (mapUi.map);
				
				// Determine the active field (i.e. layer) value, by reading the radiobutton value; NB the select value is not a used value but is instead proxied to the radiobutton set
				mapUi.field = _settings.defaultField;	// E.g. TMFR, TFR, etc.; may get changed by cloneFormValues below
				$('#' + mapUi.navDivId + ' form input[name="field"]').on ('change', function () {
					mapUi.field = $('#' + mapUi.navDivId + ' form input[name="field"]:checked').val ();
				});
				
				// Determine the active year index
				mapUi.year = _settings.years[ $('#' + mapUi.yearDivId).val () ];
				$('#' + mapUi.yearDivId).on ('change', function () {
					mapUi.year = _settings.years[ $('#' + mapUi.yearDivId).val () ];
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
					onlineatlas.updateSummary (mapUi.index, mapUi.field, mapUi.year, null);
				});
				mapUi.map.on ('zoomend', function () {
					onlineatlas.updateSummary (mapUi.index, mapUi.field, mapUi.year, null);	// Feature as null resets the status
				});
				
				// Clone form values; this must be done before the first call to get data
				if (cloneFormValues) {
					onlineatlas.cloneFormValues ('#' + _mapUis[0].navDivId + ' form', '#' + mapUi.navDivId + ' form');		// Copy the form values (year, field, variations) from the left map (0) to the new right-hand map (1)
				}
				
				// Initial view
				_settings.years.forEach (function (year) {
					onlineatlas.showData (mapUi, year);
				});
				$(document).on ('style-changed-' + mapUiIndex, function () {
					_settings.years.forEach (function (year) {
						onlineatlas.showData (mapUi, year);
					});
				});
				
				// Register to refresh data on any form field change
				$('#' + mapUi.navDivId + ' form :input').not ('[name*="_proxy"]').on ('change', function () {		// _proxy excluded
					_settings.years.forEach (function (year) {
						onlineatlas.showData (mapUi, year);
					});
				});
				
				// Add tooltips to the forms
				onlineatlas.tooltips ();
				
				// Register a dialog dialog box handler, giving a link to more information
				onlineatlas.moreDetails ();
				
				// Mobile navigation adjustments
				onlineatlas.createMobileNavigation ();
				
				// Register the mapUi handle
				_mapUis[mapUiIndex] = mapUi;
				
				// Run callback if supplied
				if (enableSync) {
					syncMaps (_mapUis[0].map, _mapUis[1].map);		// #!# Cannot currently unsync using this plugin, so such functionality is no longer present; see: https://github.com/mapbox/mapbox-gl-sync-move/issues/16
				}
			});
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
			$.each (_settings.tileUrls, function (tileLayerId, tileLayerAttributes) {
				_backgroundMapStyles[_backgroundStylesInternalPrefix + tileLayerId] = onlineatlas.defineRasterTilesLayer (tileLayerAttributes, _backgroundStylesInternalPrefix + tileLayerId);
			});
			
			// Parse any hash in the URL to obtain any default position
			const urlParameters = onlineatlas.getUrlParameters ();
			const defaultLocation = (urlParameters.defaultLocation || _settings.defaultLocation);
			const defaultTileLayer = (urlParameters.defaultTileLayer || _settings.defaultTileLayer);
			
			// Create the map
			const map = new maplibregl.Map ({
				container: mapUi.mapDivId,
				style: _backgroundMapStyles[_backgroundStylesInternalPrefix + defaultTileLayer],
				center: [defaultLocation.longitude, defaultLocation.latitude],
				zoom: defaultLocation.zoom,
				maxZoom: _settings.maxZoom,
				minZoom: _settings.minZoom,
				maxBounds: _settings.maxBounds,
				hash: (mapUi.index == 0),	// If more than one map on the page, apply only to the first one
				attributionControl: false,	// Added manually below, in compact format
				boxZoom: true
			});
			
			// Add attribution control
			map.addControl (new maplibregl.AttributionControl ({compact: true}));
			
			// Enable zoom in/out buttons
			map.addControl (new maplibregl.NavigationControl (), 'top-left');
			
			// Set current zoom
			mapUi.currentZoom = map.getZoom ();
			map.on ('zoomend', function () {
				mapUi.currentZoom = map.getZoom ();
			});
			
			// Add the base (background) layer switcher
			onlineatlas.styleSwitcher (map, mapUi.index);
			
			// Add geocoder control
			onlineatlas.createGeocoder (mapUi);
			
			// Add full screen control
			map.addControl (new maplibregl.FullscreenControl (), 'top-left');
			
			// Add full screen controlAdd geolocation control
			map.addControl (new maplibregl.GeolocateControl ({fitBoundsOptions: {maxZoom: 12}}), 'top-left');
			
			// Attach the map to the mapUi
			mapUi.map = map;
		},
		
		
		// Function to define a raster tiles map layer, for background map tiles or for foreground tile-based layers
		defineRasterTilesLayer: function (tileLayerAttributes, id)
		{
			// Determine if this is a TMS (i.e. {-y}) tilesource; see: https://docs.mapbox.com/mapbox-gl-js/style-spec/#sources-raster-scheme
			var scheme = 'xyz';
			if (tileLayerAttributes.tiles.indexOf('{-y}') != -1) {
				tileLayerAttributes.tiles = tileLayerAttributes.tiles.replace ('{-y}', '{y}');
				scheme = 'tms';
			}
		
			// Expand {s} server to a,b,c if present
			if (tileLayerAttributes.tiles.indexOf('{s}') != -1) {
				tileLayerAttributes.tiles = [
					tileLayerAttributes.tiles.replace ('{s}', 'a'),
					tileLayerAttributes.tiles.replace ('{s}', 'b'),
					tileLayerAttributes.tiles.replace ('{s}', 'c')
				];
			}
			
			// Convert string (without {s}) to array
			if (typeof tileLayerAttributes.tiles === 'string') {
				tileLayerAttributes.tiles = [
					tileLayerAttributes.tiles
				];
			}
			
			// Register the definition
			var sources = {};
			sources[id] = {
				type: 'raster',
				scheme: scheme,
				tiles: tileLayerAttributes.tiles,
				tileSize: (tileLayerAttributes.tileSize ? tileLayerAttributes.tileSize : 256),	// NB Mapbox GL default is 512
				attribution: tileLayerAttributes.attribution
			};
			var layerDefinition = {
				version: 8,
				sources: sources,	// Defined separately so that the id can be specified as a key
				layers: [{
					id: id,
					type: 'raster',
					source: id,
					paint : {'raster-opacity' : 0.7}	// https://stackoverflow.com/a/48016804/180733
				}]
			};
			
			// Add background colour if required
			if (tileLayerAttributes.backgroundColour) {
				layerDefinition.layers.unshift ({		// Must be before the raster layer
					id: '_backgroundStylesInternalPrefix-backgroundColour',
					type: 'background',
					paint: {
						'background-color': tileLayerAttributes.backgroundColour
					}
				});
			}
			
			// Return the layer definition
			return layerDefinition;
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
				// #!# Need to reinstate support for map base inclusion in permalinks
				//const hashParts = window.location.hash.match (/^#([\-.0-9]+)\/([\-.0-9]+)\/([\-.0-9]+)\/([a-z0-9]+)$/);	// E.g. #17.4/51.51137/-0.10498/bartholomew
				const hashParts = window.location.hash.match (/^#([\-.0-9]+)\/([\-.0-9]+)\/([\-.0-9]+)$/);	// E.g. #17.4/51.51137/-0.10498
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
		
		
		// Function to add style (background layer) switching
		// https://www.mapbox.com/mapbox-gl-js/example/setstyle/
		// https://bl.ocks.org/ryanbaumann/7f9a353d0a1ae898ce4e30f336200483/96bea34be408290c161589dcebe26e8ccfa132d7
		styleSwitcher: function (map, mapIndex)
		{
			// Add style switcher UI control
			const containerId = 'styleswitcher' + mapIndex;
			onlineatlas.createControl (map, containerId, 'bottom-right', 'styleswitcher expandable');
			$('.styleswitcher').css ('backgroundImage', "url('" + _baseUrl + "/images/layers.png')");
			
			// Determine the container path
			const container = '#' + containerId;
			
			// Construct HTML for style switcher
			let styleSwitcherHtml = '<ul>';
			$.each (_backgroundMapStyles, function (styleId, style) {
				const unprefixedStyleId = styleId.replace (_backgroundStylesInternalPrefix, '');
				const name = (_settings.tileUrls[unprefixedStyleId].label ? _settings.tileUrls[unprefixedStyleId].label : layerviewer.ucfirst (unprefixedStyleId));
				styleSwitcherHtml += '<li><input id="' + unprefixedStyleId + mapIndex + '" type="radio" name="styleswitcher' + mapIndex + '" value="' + unprefixedStyleId + '"' + (unprefixedStyleId == _settings.defaultTileLayer ? ' checked="checked"' : '') + '>';
				styleSwitcherHtml += '<label for="' + unprefixedStyleId + mapIndex + '">' + name + '</label></li>';
			});
			styleSwitcherHtml += '</ul>';
			$(container).append (styleSwitcherHtml);
			
			// Function to switch to selected style
			const switchStyle = function (selectedStyle)
			{
				const tileLayerId = selectedStyle.target.value;
				const style = _backgroundMapStyles[_backgroundStylesInternalPrefix + tileLayerId];
				map.setStyle (style);
				
				// Set manual attribution if required
				//onlineatlas.handleManualAttribution (map, tileLayerId);
				
				// Save this style as a cookie
				Cookies.set ('mapstyle', tileLayerId);
				
				// Fire an event; see: https://javascript.info/dispatch-events
				onlineatlas.styleChanged (map, mapIndex);
			}
			
			// Enable for each input
			const inputs = $(container + ' ul input');
			let i;
			for (i = 0; i < inputs.length; i++) {
				inputs[i].onclick = switchStyle;
			}
		},
		
		
		// Function to handle attribution manually where required
		// Where a vector style is not a mapbox://... type, its URL will not be sufficient to set the attribution, so an attribution value must be set in the layer specification
		// This function when called always clears any existing attribution and then sets a customAttribution using map.addControl if needed
		handleManualAttribution: function (map, styleId)
		{
			// Clear anything if present, so that any change starts from no control
			if (_manualAttribution !== null) {
				map.removeControl (_manualAttribution);
				_manualAttribution = null;
			}
			
			// Set attribution
			if (_backgroundMapStylesManualAttributions[styleId]) {
				_manualAttribution = new mapboxgl.AttributionControl ({
					customAttribution: _backgroundMapStylesManualAttributions[styleId]
				});
				map.addControl (_manualAttribution);
			}
		},
		
		
		// Function to trigger style changed, checking whether it is actually loading; see: https://stackoverflow.com/a/47313389/180733
		// Cannot use _map.on(style.load) directly, as that does not fire when loading a raster after another raster: https://github.com/mapbox/mapbox-gl-js/issues/7579
		styleChanged: function (map, mapIndex)
		{
			// Delay for a short while in a loop until the style is loaded; see: https://stackoverflow.com/a/47313389/180733
			if (!map.isStyleLoaded()) {
				setTimeout (function () {
					onlineatlas.styleChanged (map, mapIndex);	// Done inside a function to avoid "Maximum Call Stack Size Exceeded"
				}, 250);
				return;
			}
			
			// Fire a custom event that client code can pick up when the style is changed
			var myEvent = new Event ('style-changed-' + mapIndex, {'bubbles': true});
			document.dispatchEvent (myEvent);
		},
		
		
		// Function to create a control in a corner
		// See: https://www.mapbox.com/mapbox-gl-js/api/#icontrol
		createControl: function (map, id, position, className)
		{
			function myControl() { }
			
			myControl.prototype.onAdd = function(map) {
				this._map = map;
				this._container = document.createElement('div');
				this._container.setAttribute ('id', id);
				this._container.className = 'maplibregl-ctrl-group maplibregl-ctrl local';
				if (className) {
					this._container.className += ' ' + className;
				}
				return this._container;
			};
			
			myControl.prototype.onRemove = function () {
				this._container.parentNode.removeChild(this._container);
				this._map = undefined;
			};
			
			// #!# Need to add icon and hover; partial example at: https://github.com/schulzsebastian/mapboxgl-legend/blob/master/index.js
			
			// Instiantiate and add the control
			map.addControl (new myControl (), position);
		},
		
		
		// Function to initalise the data layer for a dataset year
		initialiseDataLayer: function (mapUi, year)
		{
			// Initialise the data source
			const sourceLayer = 'data' + year;	// String prefix used, to avoid "source-layer: string expected, number found" error
			mapUi.sourceId[sourceLayer] = sourceLayer + '-' + mapUi.index;
			
			// Add vector source
			mapUi.map.addSource (mapUi.sourceId[sourceLayer], {
				type: 'vector',
				tiles: [
					window.location.origin + _baseUrl + `/datasets/data${year}/{z}/{x}/{y}.pbf`
				]
			});
			
			// Initialise the layer with this source
			const polygonLayerId = mapUi.sourceId[sourceLayer] + '-fill';	// Use same value for simplicity
			mapUi.map.addLayer ({
				id: polygonLayerId,
				source: mapUi.sourceId[sourceLayer],
				type: 'fill',
				layout: {visibility: 'none'},	// Will be enabled later, based on current year
				// filter will be set in showData to handle NULL values, as that has to specify the fieldname; see: https://docs.mapbox.com/mapbox-gl-js/example/cluster/
				paint: {
					'fill-color': '#666',	// Will be overwritten later when data shown, as this is layer-specific
					'fill-opacity': [
						'case',
						['boolean', ['feature-state', 'hover'], false],
						0.6,
						0.85
					]
				},
				'source-layer': sourceLayer
			});
			mapUi.map.addLayer ({
				id: mapUi.sourceId[sourceLayer] + '-outline',		// Use same value for simplicity
				source: mapUi.sourceId[sourceLayer],
				type: 'line',
				layout: {visibility: 'none'},	// Will be enabled later, based on current year
				paint: {
					'line-width': [
						'case',
						['boolean', ['feature-state', 'hover'], false],
						4,
						1
					],
					'line-color': [
						'case',
						['boolean', ['feature-state', 'hover'], false],
						'#555',
						'#777'
					]
					// line-dasharray will be overriden/set in showData, as it needs support for checking for NULL values, which is field-dependent
				},
				'source-layer': sourceLayer
			});
			
			// Set hover cursor
			onlineatlas.setHoverCursor (mapUi.map, polygonLayerId);
			
			// Create status indication on hover
			// See: https://github.com/mapbox/mapbox-gl-js/issues/5539#issuecomment-340311798 and https://gis.stackexchange.com/questions/451766/popup-on-hover-with-mapbox
			let lastFeatureId = null;
			mapUi.map.on ('mousemove', polygonLayerId, function (e) {
				
				// Check for feature change (for efficiency, to avoid repeated lookups as the mouse is slightly moved)
				const feature = e.features[0];
				if (feature.id !== lastFeatureId) {		// Relies on generateId being used, or --generate-ids in Tippecanoe
					
					// Reset feature-state of an existing feature if already set, to avoid creating multiple highlighted features; see: https://docs.mapbox.com/mapbox-gl-js/example/hover-styles/
					if (lastFeatureId !== null) {
						mapUi.map.setFeatureState ({id: lastFeatureId, source: mapUi.sourceId[sourceLayer], sourceLayer: sourceLayer}, {hover: false});
					}
					
					// Update the feature state
					lastFeatureId = feature.id;
					mapUi.map.setFeatureState ({id: lastFeatureId, source: mapUi.sourceId[sourceLayer], sourceLayer: sourceLayer}, {hover: true});
					
					/*
					// Get the centroid
					//const coordinates = onlineatlas.getCentre (feature.geometry);		// #!# Does not work, because the popup ends up in the way so the top half of a feature doesn't get mousemove - seems buggy
					const coordinates = e.lngLat;
					
					// Ensure that if the map is zoomed out such that multiple copies of the feature are visible, the popup appears over the copy being pointed to.
					while (Math.abs (e.lngLat.lng - coordinates[0]) > 180) {
						coordinates[0] += (e.lngLat.lng > coordinates[0] ? 360 : -360);
					}
					
					// Create a popup and set its co-ordinates based on the feature found
					const popupHtml = onlineatlas.popupHtml (feature, mapUi.field, mapUi.year);
					popup.setLngLat (coordinates).setHTML (popupHtml).addTo (mapUi.map);
					*/
					
					// Update the summary box
					onlineatlas.updateSummary (mapUi.index, mapUi.field, mapUi.year, feature);
				}
			});
			mapUi.map.on ('mouseleave', polygonLayerId, function (e) {
				if (lastFeatureId) {
					mapUi.map.setFeatureState ({id: lastFeatureId, source: mapUi.sourceId[sourceLayer], sourceLayer: sourceLayer}, {hover: false});
					lastFeatureId = null;
				}
				
				// Update the summary box
				onlineatlas.updateSummary (mapUi.index, mapUi.field, mapUi.year, null);
			});
			
			// Add popup on click
			_popup = new maplibregl.Popup ();
			mapUi.map.on ('click', polygonLayerId, function (e) {
				const feature = e.features[0];
				const coordinates = e.lngLat;
				const popupHtml = onlineatlas.popupHtml (feature, mapUi.field, mapUi.year);
				_popup.setLngLat (coordinates).setHTML (popupHtml).addTo (mapUi.map);
			});
		},
		
		
		// Function to set hover cursor on features in a layer
		setHoverCursor: function (map, layerReferenceId)
		{
			map.on ('mouseenter', layerReferenceId, () => {
				map.getCanvas ().style.cursor = 'pointer';
			});
			map.on ('mouseleave', layerReferenceId, () => {
				map.getCanvas ().style.cursor = '';
			});
		},
		
		
		// Helper function to get the centre-point of a geometry
		// Based on code by CycleStreets Ltd, GPL3; see: https://github.com/cyclestreets/Mapboxgljs.LayerViewer/blob/master/src/layerviewer.js#L5272
		getCentre: function (geometry)
		{
			// Determine the centre point
			var centre = {};
			switch (geometry.type) {
				
				case 'Point':
					centre = {
						lat: geometry.coordinates[1],
						lon: geometry.coordinates[0]
					};
					break;
					
				case 'LineString':
					var longitudes = [];
					var latitudes = [];
					geometry.coordinates.forEach (function (lonLat) {
						longitudes.push (lonLat[0]);
						latitudes.push (lonLat[1]);
					});
					centre = {
						lat: ((Math.max.apply (null, latitudes) + Math.min.apply (null, latitudes)) / 2),
						lon: ((Math.max.apply (null, longitudes) + Math.min.apply (null, longitudes)) / 2)
					};
					break;
					
				case 'MultiLineString':
				case 'Polygon':
					var longitudes = [];
					var latitudes = [];
					geometry.coordinates.forEach (function (line) {
						line.forEach (function (lonLat) {
							longitudes.push (lonLat[0]);
							latitudes.push (lonLat[1]);
						});
					});
					centre = {
						lat: ((Math.max.apply (null, latitudes) + Math.min.apply (null, latitudes)) / 2),
						lon: ((Math.max.apply (null, longitudes) + Math.min.apply (null, longitudes)) / 2)
					};
					break;
					
				case 'MultiPolygon':
					var longitudes = [];
					var latitudes = [];
					geometry.coordinates.forEach (function (polygon) {
						polygon.forEach (function (line) {
							line.forEach (function (lonLat) {
								longitudes.push (lonLat[0]);
								latitudes.push (lonLat[1]);
							});
						});
					});
					centre = {
						lat: ((Math.max.apply (null, latitudes) + Math.min.apply (null, latitudes)) / 2),
						lon: ((Math.max.apply (null, longitudes) + Math.min.apply (null, longitudes)) / 2)
					};
					break;
					
				case 'GeometryCollection':
					var longitudes = [];
					var latitudes = [];
					var centre;
					geometry.geometries.forEach (function (geometryItem) {
						centre = onlineatlas.getCentre (geometryItem);		// Iterate
						longitudes.push (centre.lon);
						latitudes.push (centre.lat);
					});
					centre = {
						lat: ((Math.max.apply (null, latitudes) + Math.min.apply (null, latitudes)) / 2),
						lon: ((Math.max.apply (null, longitudes) + Math.min.apply (null, longitudes)) / 2)
					};
					break;
					
				default:
					console.log ('Unsupported geometry type: ' + geometry.type, geometry);
			}
			
			// Return the centre
			return centre;
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
					const bbox = ui.item.feature.properties.bbox.split (',');
					mapUi.map.fitBounds (bbox);
					event.preventDefault ();
				}
			});
		},
		
		
		// Function to create the navigation panel
		createNav: function (mapUi)
		{
			// Create the panel, as a control
			const containerId = 'navigationpanel' + mapUi.index;
			onlineatlas.createControl (mapUi.map, containerId, 'top-right', 'navigationpanel ' + containerId);
			
			// Create a div for the nav within the map container
			mapUi.navDivId = 'nav' + mapUi.index;
			$('#' + containerId).prepend ('<nav id="' + mapUi.navDivId + '"></nav>');
			
			// Create a form within the nav
			$('#' + mapUi.navDivId).append ('<form></form>');
			
			// Create a CSV export link
			if (_settings.export) {
				const exportDivId = 'export' + mapUi.index;
				$('#' + mapUi.navDivId + ' form').prepend ('<p id="' + exportDivId + '" class="export">Exports: <a class="exportcsv" href="#" title="Export the data for the selected year in CSV format"><img src="/images/icons/page_excel.png" alt="" /></a> <a class="exportgeojson" href="#" title="Export the data for the selected year in GeoJSON format (for GIS)"><img src="/images/icons/page_code.png" alt="" /></a></p>');
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
			onlineatlas.addYearRangeControl (mapUi.navDivId, mapUi.yearDivId, _settings.defaultYear);
			
			// Register a slide menu handler, if groupings are present
			if (_settings.expandableHeadings && fieldControls.hasGroups) {
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
			const yearValue = _settings.years[yearIndex];
			
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
			if (!initialYear) {initialYear = _settings.years[1];}	// Second by default
			const initialIndexValue = _settings.years.indexOf (initialYear);
			
			// Determine whether to use small labels
			// This explicitly does not use width, as that creates complexities of having to redraw the control for side-by-side mode
			const smallLabelThreshold = 7;		// Determined by observation
			const totalLabels = _settings.years.length;
			const rangeClass = (totalLabels > smallLabelThreshold ? ' smalllabels' : '');
			
			// Define the width of the browser's rendering of a range handle, which we have to adjust for since it does NOT extend beyond the edge; see: https://css-tricks.com/sliding-nightmare-understanding-range-input/
			const thumbRangeShadowDomWidth = 16;	// Chrome is 16px; Firefox is 20px
			
			// Construct a visible list and datalist (so that ticks are created) for the year control
			let listHtml = '<ul class="rangelabels' + rangeClass + '">';
			const datalistId = navDivId + 'ticks';
			let datalistHtml = '<datalist id="' + datalistId + '">';
			$.each (_settings.years, function (index, year) {
				listHtml += '<li style="width: calc(100% / ' + totalLabels + ');" data-index="' + index + '">' + year + '</li>';
				datalistHtml += '<option value="' + index + '"></option>';
			});
			listHtml += '</ul>';
			datalistHtml += '</datalist>';
			
			// Combine the range slider and the associated datalist
			// Ticks have no styling support currently, though the technique here could be used: https://css-tricks.com/why-do-we-have-repeating-linear-gradient-anyway/
			let html = '<input type="range" name="year" id="' + yearDivId + '" min="0" max="' + (_settings.years.length - 1) + '" step="1" value="' + initialIndexValue + '" style="width: calc(100%' +  ' - (100% / ' + totalLabels + ') + ' + thumbRangeShadowDomWidth + 'px);" list="' + datalistId + '" />';
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
		
		
		// Function to create a location overlay pane; this is done after the data layer loading so that these appear on top
		createLocationsOverlayPane: function (map)
		{
			// Define the source and layer
			const layer = {
				id: 'locationsoverlay',
				type: 'raster',
				source: {
					type: 'raster',
					tiles: ['https://cartodb-basemaps-a.global.ssl.fastly.net/light_only_labels/{z}/{x}/{y}.png'],
					tileSize: 256,
					attribution: 'CartoDB'
				},
			};
			map.addLayer (layer);
		},
		
		
		// Function to create a country overlay, which is a negative polygon used to blank out surrounding areas
		addCountryOverlay: function (map)
		{
			// Get the GeoJSON data
			fetch (_baseUrl + '/overlay.geojson')
				.then (function (response) { return response.json (); })
				.then (function (geojson) {
					
					// Define and add the overlay
					const layer = {
						id: 'countryoverlay',
						type: 'fill',
						source: {
							'type': 'geojson',
							'data': geojson
						},
						paint: {
							'fill-color': '#a5c2ba',
							'fill-opacity': 1
						}
					};
					map.addLayer (layer);
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
			vex.defaultOptions.className = 'vex-theme-plain';
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
		
		
		// Function to show the map data
		showData: function (mapUi, year)
		{
			// Set the colouring
			const styleDefinition = onlineatlas.getColours (mapUi.field);
			mapUi.map.setPaintProperty (mapUi.sourceId['data' + year] + '-fill', 'fill-color', styleDefinition);
			
			// Set the line style for the outline, to deal with NULL values (shown as transparent with a dashed line)
			//mapUi.map.setPaintProperty (mapUi.sourceId['data' + year] + '-outline', 'line-dasharray', ['case', ['has', mapUi.field], ['literal', [3, 1]], ['literal', [1]]]);		// #!# Support pending; see: https://github.com/maplibre/maplibre-gl-js/issues/1235 and https://maplibre.org/maplibre-style-spec/layers/#line-dasharray
			
			// Set the visibility, based on match of the current year
			const visibility = (mapUi.year == year ? 'visible' : 'none');
			mapUi.map.setLayoutProperty (mapUi.sourceId['data' + year] + '-fill',    'visibility', visibility);
			mapUi.map.setLayoutProperty (mapUi.sourceId['data' + year] + '-outline', 'visibility', visibility);
			
			// Set the export values to the selected year
			if (mapUi.year == year) {
				$('#' + mapUi.navDivId + ' p.export a.exportcsv'    ).attr ('href', _baseUrl + '/datasets/data' + year + '.csv');
				$('#' + mapUi.navDivId + ' p.export a.exportgeojson').attr ('href', _baseUrl + '/datasets/data' + year + '.geojson');
			}
			
			// Set the URL
			onlineatlas.updateUrl (mapUi);
		},
		
		
		// Function to update the URL, to provide persistency when a link is circulated
		// Format is /<baseUrl>/<layerId>/<year>/#<mapHashWithStyle> ; side-by-side is not supported
		updateUrl: function (mapUi)
		{
			// End if not supported, e.g. IE9
			if (!history.pushState) {return;}
			
			// Construct the URL slug
			const field = mapUi.field;
			const year = mapUi.year;
			let urlSlug = '/' + field.toLowerCase() + '/' + year + '/';
			if (Object.keys (_settings.variations).length) {
				$.each (_settings.variations, function (variationLabel, variationOptions) {
					// #!# Not yet correct - variation is not yet in the mapUi
					urlSlug += mapUi[variationLabel.toLowerCase ()].toLowerCase () + '/';	// E.g. 'female/'
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
		
		
		// Helper function to enable fallback to JSON-P for older browsers like IE9; see: https://stackoverflow.com/a/1641582
		browserSupportsCors: function ()
		{
			return ('withCredentials' in new XMLHttpRequest ());
		},
		
		
		// Assign colour from lookup table
		getColours: function (field)
		{
			// Start a list of tokens
			let tokens = [];
			
			// Define value for NULL data
			const colourUnknown = _settings.colourUnknown || 'transparent';
			
			// If the field has a colour set, just return that
			if (_settings.fields[field].hasOwnProperty ('colour')) {
				tokens.push (_settings.fields[field].colour);
				return tokens;
			}
			
			// Create a simpler variable for the intervals field
			const intervals = _settings.fields[field].intervals;
			
			// If no intervals, return the string token of transparent
			if (intervals.length == '') {return 'transparent';}
			
			// For a wildcard, return either the wildcard colour if there is a value, or the unknown value if not
			/* Example structure - note that the second value (NULL) is ignored, but NULL will then be styled in the legend as a dashed transparent box
				'intervalsWildcard' => 'Town (by name)',
				'intervals' => array (
					'Town (by name)'	=> 'blue',
					'Other areas'		=> NULL,
				),
			*/
			if (_settings.fields[field].hasOwnProperty ('intervalsWildcard')) {
				tokens.push ('case');
				tokens.push (['to-boolean', ['get', field]]);
				tokens.push (intervals[_settings.fields[field].intervalsWildcard]);
				tokens.push (colourUnknown);
				return tokens;
			}
			
			// If the intervals is an array, i.e. standard list of colour stops, loop until found; see: https://docs.mapbox.com/style-spec/reference/expressions/#step and https://docs.mapbox.com/mapbox-gl-js/example/cluster/
			if (intervals[0]) {		// Simple, quick check
				
				// Create a step expression, based on the current field, starting with the zero value then the threshold,colour pairs
				tokens.push ('step');
				tokens.push (['get', field]);
				$.each (_settings.fields[field].intervals, function (index, label) {
					// #!# Is being cast to integer
					const value = (label.charAt (0) == '<' ? 0 : Number.parseFloat (label.match (/([\.0-9]+)/) [0]));	// Not /g so only first found
					const skipIfFirst = (index == 0 && value == 0);		// The zero (first) item should be skipped
					if (!skipIfFirst) {
						tokens.push (value);
					}
					tokens.push (_settings.colourStops[index]);
				});
				
				// Wrap the step expression within a check for NULL values, to show the unknown colour (default transparent); see: https://github.com/mapbox/mapbox-gl-js/issues/5761#issuecomment-2506485665
				tokens = [
					'case',
						['has', field],
							tokens,
						colourUnknown
				];
				
				// Return the result
				return tokens;
			}
			
			// Otherwise is key-value pairs; see: https://docs.mapbox.com/style-spec/reference/expressions/#case and https://docs.mapbox.com/mapbox-gl-js/example/cluster-html/
			tokens.push ('case');
			$.each (_settings.fields[field].intervals, function (value, colour) {
				tokens.push (['==', ['get', field], value]);
				tokens.push (colour);
			});
			tokens.push (colourUnknown);
			return tokens;
		},
		
		
		// Function to define popup content
		popupHtml: function (feature, currentField, currentYear)
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
			let html = '<p><strong>Displayed data for ' + areaHierarchy.join (', ') + ' in ' + currentYear + ':</strong></p>';
			
			// Add table
			html += '<table id="chart" class="lines compressed">';
			$.each (feature.properties, function (field, value) {
				
				// Show only general fields and the current data field
				if (!_settings.availableGeneralFields.includes (field) && (field != currentField)) {return; /* i.e. continue */}
				
				// Show the value, cleaned
				if (typeof value == 'string') {
					value = onlineatlas.htmlspecialchars (value);
					value = value.replaceAll ('/', ' / ');
				} else if (typeof value == 'number' && !Number.isInteger (value)) {	// i.e. if float
					value = onlineatlas.numberFormat (value, _settings.popupsRoundingDP);
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
		
		
		// Number formatting; see: http://phpjs.org/functions/number_format/
		numberFormat: function (number, decimals, dec_point, thousands_sep)
		{
			// End if not actually numeric
			if (number == null || !isFinite (number)) {
				return number;
			}
			
			// Strip all characters but numerical ones
			number = (number + '').replace(/[^0-9+\-Ee.]/g, '');
			var n = !isFinite(+number) ? 0 : +number;
			var prec = !isFinite(+decimals) ? 0 : Math.abs(decimals);
			var sep = (typeof thousands_sep === 'undefined') ? ',' : thousands_sep;
			var dec = (typeof dec_point === 'undefined') ? '.' : dec_point;
			var s = '';
			var toFixedFix = function (n, prec) {
				var k = Math.pow(10, prec);
				return '' + Math.round(n * k) / k;
			};
			// Fix for IE parseFloat(0.55).toFixed(0) = 0;
			s = (prec ? toFixedFix(n, prec) : '' + Math.round(n)).split('.');
			if (s[0].length > 3) {
				s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep);
			}
			if ((s[1] || '').length < prec) {
				s[1] = s[1] || '';
				s[1] += new Array(prec - s[1].length + 1).join('0');
			}
			return s.join(dec);
		},
		
		
		// Function to define summary box content
		summaryHtml: function (field, year, feature)
		{
			// If the field is the null field, show nothing
			if (_settings.nullField) {
				if (field == _settings.nullField) {
					return '';
				}
			}
			
			// Determine the area name
			let areaName = feature.properties[_settings.areaNameField] || feature.properties[_settings.areaNameFallbackField];
			
			// If there is no name for the geographic field, set a generic label
			if (areaName == null) {
				areaName = '[Unknown place name]';
			}
			
			// Split long unspaced placenames with slashes
			areaName = areaName.replaceAll ('/', ' / ');
			
			// Set the value, rewriting NULL to the specified message
			let value = '<strong>' + onlineatlas.numberFormat (feature.properties[field], _settings.popupsRoundingDP) + '</strong>';
			if (feature.properties[field] == null) {
				value = _settings['nullDataMessage'];
			}
			
			// Assemble the HTML
			const html = '<p>' + onlineatlas.htmlspecialchars (areaName) + ', in ' + year + ': ' + value + '</p>';
			
			// Return the HTML
			return html;
		},
		
		
		// Function to create and update the legend
		createLegend: function (mapUi)
		{
			// Create the control
			const containerId = 'legend' + mapUi.index;
			onlineatlas.createControl (mapUi.map, containerId, 'bottom-left', 'info legend');
			
			// Add a div to contain the legend
			$('#' + containerId).append ('<div id="legendcontainer"></div>');
			
			// Set the initial value
			onlineatlas.setLegend (mapUi);
		},
		
		
		// Function to set the legend contents
		setLegend: function (mapUi)
		{
			// Handle null field
			if (_settings.nullField) {
				if (mapUi.field == _settings.nullField) {
					$('#' + mapUi.mapDivId + ' .legend #legenddetail').html ('');
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
			$('#' + mapUi.mapDivId + ' .legend #legendcontainer').html (html);
		},
		
		
		// Function to create a summary box
		summaryControl: function (mapUi)
		{
			// Create the control
			const containerId = 'summary' + mapUi.index;
			onlineatlas.createControl (mapUi.map, containerId, 'top-left', 'info summary');
			
			// Set initial status
			this.updateSummary (mapUi.index, mapUi.field, mapUi.year, null);
		},
		
		
		// Function to set the summary box
		updateSummary: function (mapUiIndex, field, year, feature)
		{
			// Title
			let html = '<h4>' + onlineatlas.htmlspecialchars (_settings.fields[field].label) + '</h4>';
			
			// Status
			if (_settings.fields[field].hasOwnProperty ('static')) {
				html += '';
			} else {
				html += (feature ?
					onlineatlas.summaryHtml (field, year, feature)
					: 'Hover over an area to view details.');
			}
			
			// Set the value
			$('#summary' + mapUiIndex).html (html);
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
