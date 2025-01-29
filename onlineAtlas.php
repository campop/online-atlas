<?php

# Class to create the online atlas
class onlineAtlas extends frontControllerApplication
{
	# Class properties
	private $availableGeneralFields = array ('REGCNTY', 'REGDIST', 'SUBDIST', 'PARISH', 'TOWN', 'year', 'POP', 'ACRES');	// Specified in sort order for export
	
	# Function to assign defaults additional to the general application defaults
	public function defaults ()
	{
		# Specify available arguments as defaults or as NULL (to represent a required argument)
		$defaults = array (
			'applicationName' => 'Online atlas',
			'div' => 'onlineatlas',
			'useDatabase' => false,
			'administrators' => true,
			'geocoderApiKey' => NULL,
			'defaultLocation' => array (
				'latitude' => 53.615,
				'longitude' => -1.53,
				'zoom' => 5.8,
			),
			'years' => NULL,	// Must supply an array of datasets
			'areaNameField' => 'SUBDIST',
			'areaNameFallbackField' => 'REGDIST',
			'downloadFilenameBase' => 'onlineatlas',	// Or false to disable
			'pdfLink' => false,
			'pdfBaseUrl' => '%baseUrl/resources/',		// %baseUrl supported
			'downloadInitialNotice' => false,		// Must not contain double-quotes
			'bodyClass' => '',
			'disableTabs' => true,
			'authLinkVisibility' => false,
			'ogPreview' => '/images/preview.png',
			'firstRunMessageHtml' => false,
			'aboutFile' => false,
			'defaultYear' => false,
			'defaultField' => NULL,
			'defaultVariations' => array (),
			'datasetsAttribution' => 'Campop',
			'intervalsMode' => false,
			'valueUnknown' => NULL,	// For all decimal fields, special value which represents unknown data
			'valueUnknownString' => 'Unknown',
			'colourUnknown' => '#c8c8c8',
			'variations' => array (),	// As variation-label => array (field => label), variation-label...
			'expandableHeadings' => false,
			'enableFullDescriptions' => true,
			'fields' => array (
				// NB General fields (general=true), several of which are likely to be present, are: REGCNTY, REGDIST, SUBDIST, year
				'year' => array (
					'label' => 'Year',
					'description' => 'Year',
					'intervals' => '',
					'general' => true,
				),
				'FIELD' => array (
					'label' => 'Some field',
					'description' => 'Description of this field',
					'intervals' => '0, 4, 5, 6, 7, 8, 9',
				),
				// etc.
			),
			'nullField' => '_',		// ID for 'field' which just shows the map background, i.e. no data
			'colourStopsIntervalsConsistent' => true,	// Whether the number of colour stops is required to be consistent with the intervals; if not, the first N colours will be used
			'colourStops' => array (	// Colour scales can be created at http://www.colorbrewer.org/
				'#4575b5',	// Blue - least
				'#849eb9',
				'#c0ccbe',
				'#ffffbf',	// Yellow
				'#fab884',
				'#ed7552',
				'red'		// Red - most
			),
		);
		
		# Return the defaults
		return $defaults;
	}
	
	# Function assign additional actions
	public function actions ()
	{
		# Specify additional actions
		$actions = array (
			'home' => array (
				'description' => false,
				'url' => '',
				'tab' => $this->settings['applicationName'],
				'icon' => 'map',
			),
			'import' => array (
				'description' => false,
				'url' => 'import/',
				'tab' => 'Import',
				'icon' => 'database_refresh',
				'administrator' => true,
			),
		);
		
		# Return the actions
		return $actions;
	}
	
	
	# Additional processing
	public function main ()
	{
		# Determine the application (repository) directory
		$backtrace = debug_backtrace (DEBUG_BACKTRACE_IGNORE_ARGS);
		$clientClassFile = $backtrace[0]['file'];
		$this->clientApplicationDirectory = dirname ($clientClassFile);		// Not slash-terminated
		
		# Flatten variations to create a list to which the main fields will be multiplexed
		$this->settings['variationsFlattened'] = application::array_key_combinations ($this->settings['variations']);
		
		# Set the fields after expansion to deal with variations, which represents the actual data fields
		$this->fieldsExpanded = $this->fieldsVariationsProcessed ();
		
		# Ensure the number of intervals in each field matches the number of colour stops
		if ($this->settings['colourStopsIntervalsConsistent']) {
			$totalColourStops = count ($this->settings['colourStops']);
			foreach ($this->fieldsExpanded as $fieldId => $field) {
				if ($field['intervals']) {
					if (is_string ($field['intervals'])) {	// Array type has its own colour set, defined associatively, so only string type needs to be checked
						$totalIntervals = count (explode (', ', $field['intervals']));
						if ($totalIntervals != $totalColourStops) {
							echo "\n<p class=\"error\">Setup error: the number of intervals defined for the <em>{$fieldId}</em> field ({$totalIntervals}) does not match the number of colour stops defined ({$totalColourStops}).</p>";
							return false;
						}
					}
				}
			}
		}
		
	}
	
	
	# Function to return the fields, having processed variations
	private function fieldsVariationsProcessed ()
	{
		# If there are no variations (as flattened), return fields as-is
		if (!$this->settings['variationsFlattened']) {
			return $this->settings['fields'];
		}
		
		# Loop through each field
		$fields = array ();
		foreach ($this->settings['fields'] as $fieldId => $field) {
			
			# Determine if the field is a data field, or a general/null field, or a static field
			$isDataField = (!isSet ($field['general']) && $fieldId != $this->settings['nullField'] && !isSet ($field['static']));
			
			# If a general/null field, copy the data without change
			if (!$isDataField) {
				$fields[$fieldId] = $field;
				continue;
			}
			
			# For data fields, turn the single field into each variation, e.g. A with variations F, M, B becomes A_F, A_M, A_B
			foreach ($this->settings['variationsFlattened'] as $variationSuffix => $variationLabel) {
				$newFieldId = $fieldId . '_' . $variationSuffix;
				$fields[$newFieldId] = $field;
				
				# If the field has unavailability data, pick out the relevant index if present, else remove
				if ($field['unavailable']) {
					if (application::isMultidimensionalArray ($field['unavailable'])) {		// i.e. an array of arrays, e.g. array (_F => array (dataset1, dataset2, ...), _M => ..., ...)
						if (isSet ($field['unavailable'][$variationSuffix])) {
							$fields[$newFieldId]['unavailable'] = $field['unavailable'][$variationSuffix];
						} else {
							unset ($fields[$newFieldId]['unavailable']);
						}
					} else {
						// Will be a single-dimensional array of datasets, so retain as-is
					}
				}
			}
		}
		
		# Return the fields
		return $fields;
	}
	
	
	# Open Graph tags
	private function ogTags ()
	{
		# Return empty string if not enabled
		if (!$this->settings['ogPreview']) {return '';}
		
		# Return the assembled HTML
		return $html = '
			<!-- OpenGraph/Twitter attributes -->
			<meta property="og:type" content="website" />
			<meta name="twitter:card" content="summary_large_image" />
			<meta property="og:site_name" content="' . htmlspecialchars ($this->settings['applicationName']) . '" />
			<meta property="og:title" content="' . htmlspecialchars ($this->settings['applicationName']) . '" />
			<meta property="og:image" content="' . $_SERVER['_SITE_URL'] . $this->settings['ogPreview'] . '" />
			<meta property="og:url" content="' . $_SERVER['_SITE_URL'] . '/" />
		';
	}
	
	
	
	# Welcome screen
	public function home ($additionalCss = false)
	{
		# Start the HTML
		$html = '
			
			<!-- Main stylesheet -->
			<link rel="stylesheet" href="' . $this->baseUrl . '/css/styles.css" type="text/css">
			
			<script src="' . $this->baseUrl . '/js/lib/jquery/dist/jquery.min.js"></script>
			<script src="https://code.jquery.com/ui/1.12.1/jquery-ui.min.js"></script>
			<link rel="stylesheet" href="https://code.jquery.com/ui/1.12.1/themes/base/jquery-ui.css" type="text/css">
			<script src="' . $this->baseUrl . '/js/lib/@benmajor/jquery-touch-events/src/jquery.mobile-events.min.js"></script>
			
			<script src="' . $this->baseUrl . '/js/lib/maplibre-gl/dist/maplibre-gl.js"></script>
			<link rel="stylesheet" href="' . $this->baseUrl . '/js/lib/maplibre-gl/dist/maplibre-gl.css" />
			
			<script type="text/javascript" src="' . $this->baseUrl . '/src/geocoder.js"></script>
			
			<!-- Cookie support -->
			<script src="' . $this->baseUrl . '/js/lib/js-cookie/dist/js.cookie.min.js"></script>
			
			<!-- Vex dialogs; see: http://github.hubspot.com/vex/ -->
			<script src="' . $this->baseUrl . '/js/lib/vex-js/dist/js/vex.combined.min.js"></script>
			<link rel="stylesheet" href="' . $this->baseUrl . '/js/lib/vex-js/dist/css/vex.css" />
			<link rel="stylesheet" href="' . $this->baseUrl . '/js/lib/vex-js/dist/css/vex-theme-plain.css" />
			
			<!-- Icons -->
			<link rel="stylesheet" href="' . $this->baseUrl . '/js/lib/font-awesome/css/font-awesome.min.css">
			
			<!-- Side-by-side sync -->
			<script>const module = {};</script>
			<script src="' . $this->baseUrl . '/js/lib/@mapbox/mapbox-gl-sync-move/index.js"></script>
			
			<script type="text/javascript" src="' . $this->baseUrl . '/src/onlineatlas.js"></script>
			<script type="text/javascript">
				
				var config = {
					defaultLocation: ' . json_encode ($this->settings['defaultLocation']) . ',
					geocoderApiKey: \'' . $this->settings['geocoderApiKey'] . '\',
					areaNameField: ' . ($this->settings['areaNameField'] ? "'{$this->settings['areaNameField']}'" : 'false') . ',
					areaNameFallbackField: ' . ($this->settings['areaNameFallbackField'] ? "'{$this->settings['areaNameFallbackField']}'" : 'false') . ',
					availableGeneralFields: ' . json_encode ($this->availableGeneralFields) . ',
					years: ' . json_encode ($this->settings['years']) . ',
					defaultYear: ' . ($this->settings['defaultYear'] ? (is_numeric ($this->settings['defaultYear']) ? $this->settings['defaultYear'] : "'{$this->settings['defaultYear']}'") : 'false') . ',
					defaultField: \'' . $this->settings['defaultField'] . '\',
					expandableHeadings: ' . ($this->settings['expandableHeadings'] ? 'true' : 'false') . ',
					defaultVariations: ' . json_encode ($this->settings['defaultVariations']) . ',
					variations: ' . json_encode ($this->settings['variations']) . ',
					variationsFlattened: ' . json_encode ($this->settings['variationsFlattened']) . ',
					fields: ' . json_encode ($this->settings['fields'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . ',
					colourStops: ' . json_encode ($this->settings['colourStops']) . ',
					intervalsMode: ' . ($this->settings['intervalsMode'] ? 'true' : 'false') . ',
					valueUnknown: ' . ((is_bool ($this->settings['valueUnknown']) || is_null ($this->settings['valueUnknown']) || is_numeric ($this->settings['valueUnknown'])) ? $this->settings['valueUnknown'] : "'{$this->settings['valueUnknown']}'") . ',
					valueUnknownString: ' . ($this->settings['valueUnknownString'] ? "'{$this->settings['valueUnknownString']}'" : 'false') . ',
					colourUnknown: ' . ($this->settings['colourUnknown'] ? "'{$this->settings['colourUnknown']}'" : 'false') . ',
					export: ' . ($this->settings['downloadFilenameBase'] ? 'true' : 'false') . ',
					pdfLink: ' . ($this->settings['pdfLink'] ? 'true' : 'false') . ',
					pdfBaseUrl: \'' . $this->settings['pdfBaseUrl'] . '\',
					firstRunMessageHtml: \'' . $this->settings['firstRunMessageHtml'] . '\',
					nullField: ' . ($this->settings['nullField'] ? "'{$this->settings['nullField']}'" : 'false') . ',
					enableFullDescriptions: ' . ($this->settings['enableFullDescriptions'] ? 'true' : 'false') . '
				}
				
				$(function() {
					onlineatlas.initialise (config, \'' . $this->baseUrl . '\');
				});
				
			</script>
			
			<div id="mapcontainers"></div>
		';
		
		# Add additional CSS if required
		if ($additionalCss) {
			$html .= "\n" . '<style type="text/css">';
			$html .= "\n" . $additionalCss;
			$html .= "\n" . '</style>';
		}
		
		# Add text for more details on each field into the page, if required
		if ($this->settings['aboutFile']) {
			$html .= "\n<template id=\"aboutfields\">";		// Avoids content being duplicated from actual page
			$html .= "\n" . file_get_contents ($this->settings['aboutFile']);
			$html .= "\n</template>";
		}
		
		# Add Open Graph tags
		#!# These are probably not recognised within <body> content, but here for now
		$html .= $this->ogTags ();
		
		# Show the HTML
		echo $html;
	}
	
	
	# Function to import the data files, clearing any existing import
	public function import ()
	{
		# Define the import types
		$importTypes = array (
			'full' => 'Full import'
		);
		
		# Create the list of import files
		$importFiles = array ();
		foreach ($this->settings['years'] as $dataset) {
			$importFiles[] = sprintf ('dataset_%s', $dataset);
		}
		
		# Define the introduction HTML
		$fileCreationInstructionsHtml  = "\n\t" . '<p>Create the shapefile, and zip up the contents of the folder.</p>';
		
		# Run the import UI (which will output HTML), which runs the callback doImport below
		$html = $this->importUi ($importFiles, $importTypes, $fileCreationInstructionsHtml, 'zip', $echoHtml = false);
		
		# Show the HTML
		echo $html;
	}
	
	
	# Function to do the actual import
	public function doImport ($exportFiles, $importType_ignored, &$html, $date)
	{
		# Start the HTML
		$html = '';
		
		# Enable high memory due to GeoJSON size in json_decode
		ini_set ('memory_limit', '1000M');
		
		# Ensure the temp directory is writable
		$exportsTmpDir = "{$this->applicationRoot}/exports-tmp";
		if (!is_writable ($exportsTmpDir)) {
			$html = "\n<p class=\"warning\">ERROR: the temporary directory {$exportsTmpDir}/ does not exist or is not writable. Please ensure that the client code defines a post-update-cmd in composer.json to set writability of this directory by the webserver.</p>";
			return false;
		}
		
		# Loop through each file
		foreach ($exportFiles as $dataset => $file) {
			
			# Extract the year
			preg_match ('/([0-9]{4})/', $dataset, $matches);
			$year = $matches[1];
			
			# Remove existing data file if present
			$outputDirectory = $this->extendedApplicationRoot . '/datasets/';
			$geojsonFile = "data{$year}.geojson";
			$geojsonFilename = "{$outputDirectory}/{$geojsonFile}";
			if (is_file ($geojsonFilename)) {
				unlink ($geojsonFilename);
			}
			
			# Unzip the shapefile
			$path = pathinfo ($file);
			$tempDir = "{$exportsTmpDir}/{$path['filename']}/";
			$command = "unzip {$file} -d {$tempDir}";		// http://stackoverflow.com/questions/8107886/create-folder-for-zip-file-and-extract-to-it
			exec ($command, $output);
			// application::dumpData ($output);
			
			# Convert to GeoJSON, to be used both for vector conversion and as an export file
			$currentDirectory = getcwd ();
			chdir ($tempDir);
			$command = "ogr2ogr -f GeoJSON -lco COORDINATE_PRECISION=4 -lco RFC7946=YES -lco WRITE_NAME=NO -lco DESCRIPTION=\"{$this->settings['downloadInitialNotice']}\" -t_srs EPSG:4326 {$geojsonFilename} *.shp";	// E.g.: ogr2ogr -f GeoJSON -s_srs EPSG:3857 -t_srs EPSG:4326 1911.geojson RSD_1911.shp
			exec ($command, $output);
			// application::dumpData ($output);
			chdir ($currentDirectory);	// Change back
			
			# Convert to CSV
			if ($this->settings['downloadFilenameBase']) {
				$csvFile = "data{$year}.csv";
				$csvFilename = "{$outputDirectory}/{$csvFile}";
				$command = "ogr2ogr -f 'CSV' {$csvFilename} {$geojsonFilename} -dialect sqlite -sql 'SELECT AsGeoJSON(geometry) AS location, * FROM data{$year}'";
				exec ($command, $output);
				if ($this->settings['downloadInitialNotice']) {
					file_put_contents ($csvFilename, $this->settings['downloadInitialNotice'] . "\n\n" . file_get_contents ($csvFilename));
				}
			}
			
			# Remove the unpacked shapefile files and containing directory
			array_map ('unlink', array_filter (glob ("{$tempDir}/*.*" ), 'is_file'));	// http://php.net/unlink#109971
			array_map ('unlink', array_filter (glob ("{$tempDir}/.*.*"), 'is_file'));	// E.g. .esri.gz file
			rmdir ($tempDir);
			
			# Convert the GeoJSON to vector tiles
			if (!$this->geojsonToVectorTiles ($geojsonFile, $year, $outputDirectory, $errorHtml /* returned by reference */)) {
				$html = "\n<p class=\"warning\">{$errorHtml}</p>";
				return false;
			}
			
			# Remove the GeoJSON file after use, if exporting functionality is not enabled
			if (!$this->settings['downloadFilenameBase']) {
				unlink ($geojsonFilename);
			}
		}
		
		# Return success
		return true;
	}
	
	
	# Function to convert GeoJSON to MVT vector tiles
	private function geojsonToVectorTiles ($geojsonFile, $year, $outputDirectory, &$errorHtml = false)
	{
		# Work in the output directory
		$currentDirectory = getcwd ();
		chdir ($outputDirectory);
		
		# Read the file and decode to GeoJSON
		$string = file_get_contents ($geojsonFile);
		$geojson = json_decode ($string, true);
		
		# Check for JSON decoding failures; e.g. error 5 is a UTF-8 encoding failure, and the problematic line can be found using `grep -axv '.*' file.geojson`
		if (is_null ($geojson)) {
			$error = json_last_error ();
			$errorHtml = "ERROR: JSON decoding of {$geojsonFile} failed with <a href=\"https://www.php.net/json-last-error/#106644\" target=\"_blank\">JSON error #{$error}</a>.";
			return false;
		}
		
		# Filter features and create a filtered file
		$geojson = $this->filterGeojsonProperties ($geojson, $year);
		file_put_contents ($geojsonFile, json_encode ($geojson));
		
		# Convert to MVT
		$command = "tippecanoe --name='Data for {$year}' --description='Data for {$year}' --no-tile-size-limit --output-to-directory=data{$year}/ --attribution='{$this->settings['datasetsAttribution']}' --maximum-zoom=11 --minimum-zoom=0 --detect-shared-borders --generate-ids --base-zoom=0 --force " . $geojsonFile;
		exec ($command, $output);
		//application::dumpData ($output);
		
		# Revert directory
		chdir ($currentDirectory);
		
		# Return success
		return true;
	}
	
	
	# Function to amend the GeoJSON data
	private function filterGeojsonProperties ($geojson, $year)
	{
		# Process each feature
		foreach ($geojson['features'] as $index => $feature) {
			
			# If present, replace CEN_1851, CEN_1861, etc. with CEN
			$fieldname = 'CEN_' . $year;
			if (isSet ($feature['properties'][$fieldname])) {
				$feature['properties']['CEN'] = $feature['properties'][$fieldname];
				unset ($feature['properties'][$fieldname]);
			}
			
			# Handle division-by-zero errors in the data
			foreach ($feature['properties'] as $key => $value) {
				if ($value === '#DIV/0!') {		// Have to use exact equality comparator, as otherwise (float) 0 matches string '#DIV/0!'
					$feature['properties'][$key] = NULL;
				}
			}
			
			# Filter properties for supported fields only
			$feature['properties'] = application::arrayFields ($feature['properties'], array_keys ($this->fieldsExpanded));
			
			# Write back the new feature to the collection
			$geojson['features'][$index] = $feature;
		}
		
		# Return the GeoJSON
		return $geojson;
	}
}

?>
