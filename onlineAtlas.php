<?php

# Class to create the online atlas

require_once ('frontControllerApplication.php');
class onlineAtlas extends frontControllerApplication
{
	# Class properties
	private $availableGeneralFields = array ('REGCNTY', 'REGDIST', 'SUBDIST', 'PARISH', 'year', 'POP', 'ACRES');	// Specified in sort order for export
	
	# Function to assign defaults additional to the general application defaults
	public function defaults ()
	{
		# Specify available arguments as defaults or as NULL (to represent a required argument)
		$defaults = array (
			'applicationName' => 'Online atlas',
			'pageHeader' => 'Online atlas',
			'hostname' => 'localhost',
			'database' => 'onlineatlas',
			'username' => 'onlineatlas',
			'password' => NULL,
			'table' => 'data',
			'databaseStrictWhere' => true,
			'nativeTypes' => true,
			'administrators' => true,
			'geocoderApiKey' => NULL,
			// 'importsSectionsMode' => true,
			'datasets' => NULL,	// Must supply an array of datasets
			'closeDatasets' => array (),
			'closeName' => false,
			'closeZoom' => false,
			'closeField' => false,
			'farField' => NULL,
			'closeModeSimplifyFar' => false,
			'zoomedOut' => 8,	// Level at which the interface shows only overviews without detail to keep data size down, or false to disable
			'apiUsername' => true,
			'apiJsonPretty' => false,
			'downloadFilenameBase' => 'onlineatlas',	// Or false to disable
			'downloadInitialNotice' => false,
			'useTemplating' => true,
			'bodyClass' => '',
			'disableTabs' => true,
			'authLinkVisibility' => false,
			'h1' => '',
			'div' => false,
			'ogPreview' => '/images/preview.png',
			'firstRunMessageHtml' => false,
			'defaultField' => NULL,
			'intervalsMode' => false,
			'valueUnknown' => false,	// For all decimal fields, special value which represents unknown data
			'valueUnknownString' => 'Unknown',
			'colourUnknown' => '#c8c8c8',
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
			'about' => array (
				'description' => false,
				'url' => 'about/',
				'tab' => 'About the Atlas',
			),
			'resources' => array (
				'description' => false,
				'url' => 'resources/',
				'tab' => 'Resources',
			),
			'acknowledgements' => array (
				'description' => false,
				'url' => 'acknowledgements/',
				'tab' => 'Acknowledgements',
			),
			'contacts' => array (
				'description' => false,
				'url' => 'contacts/',
				'tab' => 'Contacts',
			),
			'exportcsv' => array (
				'description' => false,
				'url' => 'data.csv',
				'export' => true,
				'enableIf' => $this->settings['downloadFilenameBase'],
			),
			'exportgeojson' => array (
				'description' => false,
				'url' => 'data.geojson',
				'export' => true,
				'enableIf' => $this->settings['downloadFilenameBase'],
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
	
	
	# Database structure definition
	public function databaseStructure ()
	{
		# Get the domain-specific fields
		$specificFields = $this->databaseStructureSpecificFields ();
		
		# Define the base SQL
		$sql = "
			CREATE TABLE administrators (
			  username varchar(255) COLLATE utf8_unicode_ci NOT NULL COMMENT 'Username',
			  active enum('','Yes','No') COLLATE utf8_unicode_ci NOT NULL DEFAULT 'Yes' COMMENT 'Currently active?',
			  PRIMARY KEY (username)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='System administrators';
			
			CREATE TABLE `data` (
			  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'Automatic key' PRIMARY KEY,
			  `year` INT(4) NOT NULL COMMENT 'Year',
			  " . ($this->settings['closeDatasets'] ? "`close` INT(1) NULL COMMENT 'Close'," : '') . "
			  
			  {$specificFields}
			  
			  `geometry` GEOMETRY NOT NULL COMMENT 'Geometry',
			  INDEX(`year`)
			  " . ($this->settings['closeDatasets'] ? ", INDEX(`close`)" : '') . "
			) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='Data';
		";
		
		# Return the SQL
		return $sql;
	}
	
	
	# Database structure, which the implementation should override
	public function databaseStructureSpecificFields ()
	{
		# Return the SQL
		return $sql = "
			  /* Domain-specific fields to be added here */
			  
		";
	}
	
	
	# Additional processing
	public function main ()
	{
		# Set the body class and action
		$this->template['bodyClass'] = $this->settings['bodyClass'];
		$this->template['action'] = $this->action;
		
		# Set the SSO block
		$this->template['sso'] = pureContent::ssoLinks ('Raven');
		
		# Set Open Graph tags
		$this->template['ogTags'] = $this->ogTags ();
		
		# Set the admin
		$this->template['userIsAdministrator'] = $this->userIsAdministrator;
		
		# Set the default title
		$this->template['title'] = $this->settings['applicationName'];
		$this->template['pageHeader'] = $this->settings['pageHeader'];
		
		# Ensure the number of intervals in each field matches the number of colour stops
		if ($this->settings['colourStopsIntervalsConsistent']) {
			if ($this->action != 'api') {
				$totalColourStops = count ($this->settings['colourStops']);
				foreach ($this->settings['fields'] as $fieldId => $field) {
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
	public function home ($aboutPath = false)
	{
		# Start the HTML
		$html = '
			
			<!-- Main stylesheet -->
			<link rel="stylesheet" href="' . $this->baseUrl . '/css/styles.css?5" type="text/css">
			
			<script src="https://code.jquery.com/jquery-3.3.1.min.js"></script>
			<script src="https://code.jquery.com/ui/1.12.1/jquery-ui.min.js"></script>
			<link rel="stylesheet" href="https://code.jquery.com/ui/1.12.1/themes/base/jquery-ui.css" type="text/css">
			<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-touch-events/1.0.9/jquery.mobile-events.js"></script>
			
			<link rel="stylesheet" href="https://unpkg.com/leaflet@1.3.1/dist/leaflet.css" />
			<script src="https://unpkg.com/leaflet@1.3.1/dist/leaflet.js"></script>
			
			<script type="text/javascript" src="' . $this->baseUrl . '/js/lib/geocoder/geocoder.js"></script>
			
			<!--<script type="text/javascript" src="' . $this->baseUrl . '/js/lib/leaflet-fullHash/leaflet-fullHash.js"></script>-->
			<script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/leaflet-hash/0.2.1/leaflet-hash.min.js"></script>
			
			<!-- Leaflet-active-area; see: https://github.com/Mappy/Leaflet-active-area -->
			<script src="' . $this->baseUrl . '/js/lib/Leaflet-active-area/src/leaflet.activearea.js" charset="utf-8"></script>
			
			<!-- Cookie support -->
			<script src="' . $this->baseUrl . '/js/lib/js-cookie/js.cookie.min.js"></script>
			
			<!-- Vex dialogs; see: http://github.hubspot.com/vex/ -->
			<script src="https://cdnjs.cloudflare.com/ajax/libs/vex-js/4.0.1/js/vex.combined.min.js"></script>
			<script>vex.defaultOptions.className = \'vex-theme-plain\'</script>
			<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/vex-js/4.0.1/css/vex.min.css" />
			<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/vex-js/4.0.1/css/vex-theme-plain.min.css" />
			
			<!-- Full screen control; see: https://github.com/Leaflet/Leaflet.fullscreen -->
			<script src="https://api.mapbox.com/mapbox.js/plugins/leaflet-fullscreen/v1.0.1/Leaflet.fullscreen.min.js"></script>
			<link href="https://api.mapbox.com/mapbox.js/plugins/leaflet-fullscreen/v1.0.1/leaflet.fullscreen.css" rel="stylesheet" />
			
			<!-- Geolocation control; see: https://github.com/domoritz/leaflet-locatecontrol -->
			<script src="' . $this->baseUrl . '/js/lib/leaflet-locatecontrol/dist/L.Control.Locate.min.js" charset="utf-8"></script>
			<link rel="stylesheet" href="' . $this->baseUrl . '/js/lib/leaflet-locatecontrol/dist/L.Control.Locate.min.css" />
			<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css">
			
			<!-- Side-by-side sync -->
			<script src="' . $this->baseUrl . '/js/lib/Leaflet.Sync/L.Map.Sync.js" charset="utf-8"></script>
			
			<!-- IE9 polyfill -->
			<!--[if lte IE 9]>
				<script src="https://cdnjs.cloudflare.com/ajax/libs/placeholders/4.0.1/placeholders.min.js"></script>
			<![endif]-->
			
			<script type="text/javascript" src="' . $this->baseUrl . '/js/lib/leaflet-ajax/dist/leaflet.ajax.min.js"></script>
			
			<script type="text/javascript" src="' . $this->baseUrl . '/js/onlineatlas.js?5"></script>
			<script type="text/javascript">
				
				var config = {
					geocoderApiKey: \'' . $this->settings['geocoderApiKey'] . '\',
					zoomedOut: ' . ($this->settings['zoomedOut'] ? $this->settings['zoomedOut'] : 'false') . ',
					closeZoom: ' . ($this->settings['closeZoom'] ? $this->settings['closeZoom'] : 'false') . ',
					closeField: ' . ($this->settings['closeField'] ? "'{$this->settings['closeField']}'" : 'false') . ',
					farField: ' . ($this->settings['farField'] ? "'{$this->settings['farField']}'" : 'false') . ',
					datasets: ' . json_encode ($this->settings['datasets']) . ',
					defaultField: \'' . $this->settings['defaultField'] . '\',
					fields: ' . json_encode ($this->settings['fields'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . ',
					colourStops: ' . json_encode ($this->settings['colourStops']) . ',
					intervalsMode: ' . ($this->settings['intervalsMode'] ? 'true' : 'false') . ',
					valueUnknownString: ' . ($this->settings['valueUnknownString'] ? "'{$this->settings['valueUnknownString']}'" : 'false') . ',
					colourUnknown: ' . ($this->settings['colourUnknown'] ? "'{$this->settings['colourUnknown']}'" : 'false') . ',
					export: ' . ($this->settings['downloadFilenameBase'] ? 'true' : 'false') . ',
					firstRunMessageHtml: \'' . $this->settings['firstRunMessageHtml'] . '\',
					nullField: ' . ($this->settings['nullField'] ? "'{$this->settings['nullField']}'" : 'false') . '
				}
				
				$(function() {
					onlineatlas.initialise (config, \'' . $this->baseUrl . '\');
				});
				
			</script>
			
			<div id="mapcontainers"></div>
		';
		
		# Add text for more details on each field into the page
		$html .= "\n<div id=\"aboutfields\">";
		$file = ($aboutPath ? $aboutPath : $this->applicationRoot) . '/about.html';
		$html .= file_get_contents ($file);
		$html .= "\n</div>";
		
		# Templatise
		$this->template['contentHtml'] = $html;
		$html = $this->templatise ();
		
		# Show the HTML
		echo $html;
	}
	
	
	# Function to get the fields used by the popups
	private function getFieldHeadings ()
	{
		# Get the dataset fields
		$fields = $this->databaseConnection->getHeadings ($this->settings['database'], $this->settings['table']);
		
		# Add each year
		foreach ($this->settings['datasets'] as $dataset) {
			$fields['CEN_' . $dataset] = '#';
		}
		
		# Return the fields
		return $fields;
	}
	
	
	# About page
	public function about ($path = false)
	{
		# Add the stylesheet
		$html = '<link rel="stylesheet" href="' . $this->baseUrl . '/css/styles.css" />';
		
		# Load and show the HTML
		$file = ($path ? $path : $this->applicationRoot) . '/about.html';
		$html .= file_get_contents ($file);
		
		# Templatise
		$this->template['contentHtml'] = $html;
		$html = $this->templatise ();
		
		# Show the HTML
		echo $html;
	}
	
	
	# Resources page
	public function resources ($path = false)
	{
		# Add the stylesheet
		$html = '<link rel="stylesheet" href="' . $this->baseUrl . '/css/styles.css" />';
		
		# Load and show the HTML
		$file = ($path ? $path : $this->applicationRoot) . '/resources.html';
		$html .= file_get_contents ($file);
		
		# Templatise
		$this->template['contentHtml'] = $html;
		$html = $this->templatise ();
		
		# Show the HTML
		echo $html;
	}
	
	
	# Acknowledgements page
	public function acknowledgements ($path = false)
	{
		# Add the stylesheet
		$html = '<link rel="stylesheet" href="' . $this->baseUrl . '/css/styles.css" />';
		
		# Load and show the HTML
		$file = ($path ? $path : $this->applicationRoot) . '/acknowledgements.html';
		$html .= file_get_contents ($file);
		
		# Templatise
		$this->template['contentHtml'] = $html;
		$html = $this->templatise ();
		
		# Show the HTML
		echo $html;
	}
	
	
	# Contact page
	public function contacts ($path = false)
	{
		# Add the stylesheet
		$html = '<link rel="stylesheet" href="' . $this->baseUrl . '/css/styles.css" />';
		
		# Load and show the HTML
		$file = ($path ? $path : $this->applicationRoot) . '/contacts.html';
		$html .= file_get_contents ($file);
		
		# Add the feedback form
		$this->template['feedbackform'] = parent::feedback (NULL, NULL, $echoHtml = false);
		
		# Templatise
		$this->template['contentHtml'] = $html;
		$html = $this->templatise ();
		
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
		
		# If there are datasets for close in, merge those in
		$datasets = $this->settings['datasets'];
		if ($this->settings['closeDatasets']) {
			foreach ($this->settings['closeDatasets'] as $dataset) {
				$datasets[] = $dataset . $this->settings['closeName'];
			}
			natsort ($datasets);
		}
		
		# Create the list of import files
		$importFiles = array ();
		foreach ($datasets as $dataset) {
			$importFiles[] = sprintf ('dataset_%s', $dataset);
		}
		
		# Define the introduction HTML
		$fileCreationInstructionsHtml  = "\n\t" . '<p>Create the shapefile, and zip up the contents of the folder.</p>';
		
		# Run the import UI (which will output HTML)
		$html = $this->importUi ($importFiles, $importTypes, $fileCreationInstructionsHtml, 'zip', $echoHtml = false);
		
		# Templatise
		$this->template['contentHtml'] = $html;
		$html = $this->templatise ();
		
		# Show the HTML
		echo $html;
	}
	
	
	# Function to do the actual import
	public function doImport ($exportFiles, $importType, &$html, $date)
	{
		# Start the HTML
		$html = '';
		
		# Enable high memory due to GeoJSON size in json_decode
		ini_set ('memory_limit','400M');
		
		# Ensure the temp directory is writable
		$exportsTmpDir = "{$this->applicationRoot}/exports-tmp";
		if (!is_writable ($exportsTmpDir)) {
			$html = "\n<p class=\"warning\">ERROR: the temporary directory {$exportsTmpDir}/ does not exist or is not writable.</p>";
			return false;
		}
		
		# Truncate the table for the first file; requires the DROP privilege
		if (!$this->databaseConnection->truncate ($this->settings['database'], $this->settings['table'])) {
			$html = "\n<p class=\"warning\">ERROR: truncation of old data failed.</p>";
			return false;
		}
		
		# Loop through each file
		foreach ($exportFiles as $dataset => $file) {
			
			# If support for close datasets is enabled, extract from the filename
			$close = false;
			if ($this->settings['closeDatasets']) {
				if (preg_match ("/^(.+)({$this->settings['closeName']})$/", $dataset, $matches)) {
					$close = true;
					$dataset = $matches[1];
				}
			}
			
			# Extract the year
			preg_match ('/([0-9]{4})/', $dataset, $matches);
			$year = $matches[1];
			
			# Remove existing data file if present
			$geojson = "{$exportsTmpDir}/{$year}.geojson";
			if (is_file ($geojson)) {
				unlink ($geojson);
			}
			
			# Unzip the shapefile
			$path = pathinfo ($file);
			$tempDir = "{$exportsTmpDir}/{$path['filename']}/";
			$command = "unzip {$file} -d {$tempDir}";		// http://stackoverflow.com/questions/8107886/create-folder-for-zip-file-and-extract-to-it
			exec ($command, $output);
			// application::dumpData ($output);
			
			# In close mode, simplify far-out items if required
			#!# This should be moved to the API output stage when ST_Simplify is available
			$simplify = '';
			if ($this->settings['closeDatasets']) {
				if ($this->settings['closeModeSimplifyFar']) {
					if (!$close) {
						$simplify = '-simplify ' . $this->settings['closeModeSimplifyFar'];
					}
				}
			}
			
			# Convert to GeoJSON
			$currentDirectory = getcwd ();
			chdir ($tempDir);
			$command = "ogr2ogr -f GeoJSON -lco COORDINATE_PRECISION=4 -t_srs EPSG:4326 {$simplify} {$geojson} *.shp";	// E.g.: ogr2ogr -f GeoJSON -s_srs EPSG:3857 -t_srs EPSG:4326 1911.geojson RSD_1911.shp
			exec ($command, $output);
			// application::dumpData ($output);
			chdir ($currentDirectory);	// Change back
			
			# Remove the shapefile files and containing directory
			array_map ('unlink', glob ("{$tempDir}/*.*"));	// http://php.net/unlink#109971
			rmdir ($tempDir);
			
			# Import the GeoJSON contents into the database
			$this->importGeojson ($geojson, $year, $close);
			
			# Remove the GeoJSON file after use
			unlink ($geojson);
		}
		
		# Set the update date
		$tableComment = 'Dataset last updated: ' . DateTime::createFromFormat ('Ymd H:i:s', $date . ' 12:00:00')->format ('jS F Y');
		$this->databaseConnection->setTableComment ($this->settings['database'], $this->settings['table'], $tableComment);
		
		# Return success
		return true;
	}
	
	
	# Function to import contents of a GeoJSON file into the database
	private function importGeojson ($geojsonFilename, $year, $close)
	{
		# Read the file and decode to GeoJSON
		$string = file_get_contents ($geojsonFilename);
		$geojson = json_decode ($string, true);
		
		# Load conversion library
		require_once ('lib/geojson2spatialHelper.class.php');
		
		# Assemble as a set of inserts
		$inserts = array ();
		foreach ($geojson['features'] as $index => $feature) {
			
			# Start an insert with fixed properties
			$insert = array (
				'id'	=> NULL,	// Auto-assign
				'year'	=> $year,
			);
			
			# If present, replace CEN_1851, CEN_1861, etc. with CEN
			$fieldname = 'CEN_' . $year;
			if (isSet ($feature['properties'][$fieldname])) {
				$feature['properties']['CEN'] = $feature['properties'][$fieldname];
				unset ($feature['properties'][$fieldname]);
			}
			
			# Filter properties for supported fields only
			$properties = application::arrayFields ($feature['properties'], array_keys ($this->settings['fields']));
			
			# Add the properties
			$insert += $properties;
			
			# If support for close datasets is enabled, set the value
			if ($this->settings['closeDatasets']) {
				$insert['close'] = ($close ? 1 : NULL);
			}
			
			# Add the geometry
			$insert['geometry'] = "GeomFromText('" . geojson2spatial::geojsonGeometry2wkt ($feature['geometry']) . "')";
			
			# Register the insert
			$inserts[] = $insert;
		}
		
		# Insert the data, showing any error
		if (!$this->databaseConnection->insertMany ($this->settings['database'], $this->settings['table'], $inserts, $chunking = 500)) {
			echo "\n<p class=\"warning\">ERROR:</p>";
			application::dumpData ($this->databaseConnection->error ());
		}
	}
	
	
	# Export as CSV, essentially just a nicer URL to the API
	public function exportcsv ()
	{
		return $this->apiCall_locations (true);
	}
	
	
	# Export as GeoJSON, essentially just a nicer URL to the API
	public function exportgeojson ()
	{
		return $this->apiCall_locations (false, true);
	}
	
	
	# API call to retrieve data
	public function apiCall_locations ($exportCsv = false, $exportGeojson = false)
	{
		# Start a timer
		$timeStart = microtime (true);
		
		# Obtain the supplied BBOX (W,S,E,N)
		$bbox = (isSet ($_GET['bbox']) && (substr_count ($_GET['bbox'], ',') == 3) && preg_match ('/^([-.,0-9]+)$/', $_GET['bbox']) ? explode (',', $_GET['bbox'], 4) : false);
		if (!$bbox) {
			return array ('error' => 'A valid BBOX must be supplied.');
		}
		
		# Obtain the supplied zoom
		$zoom = (isSet ($_GET['zoom']) && ctype_digit ($_GET['zoom']) ? $_GET['zoom'] : false);
		if (!$zoom) {
			return array ('error' => 'A valid zoom must be supplied.');
		}
		$zoomedOut = ($this->settings['zoomedOut'] ? ($zoom <= $this->settings['zoomedOut']) : false);
		
		# Obtain the supplied year
		$year = (isSet ($_GET['year']) && ctype_digit ($_GET['year']) ? $_GET['year'] : false);
		if (!$year) {
			return array ('error' => 'A valid year must be supplied.');
		}
		
		# Obtain the supplied field
		$field = (isSet ($_GET['field']) && array_key_exists ($_GET['field'], $this->settings['fields']) ? $_GET['field'] : false);
		if (!$field) {
			return array ('error' => 'A valid field must be supplied.');
		}
		
		# Construct the BBOX WKT string
		$bboxGeom = "Polygon(({$bbox[0]} {$bbox[1]},{$bbox[2]} {$bbox[1]},{$bbox[2]} {$bbox[3]},{$bbox[0]} {$bbox[3]},{$bbox[0]} {$bbox[1]}))";
		
		# Determine the fields to obtain
		$fields = array ();
		if (!$zoomedOut || $exportCsv) {
			foreach ($this->availableGeneralFields as $generalField) {
				if (array_key_exists ($generalField, $this->settings['fields'])) {
					$fields[] = $generalField;
				}
			}
		}
		$orderBy = $fields;		// Set order-by to the main fields defined
		$fields[] = $field;
		if ($exportCsv) {
			$fields[] = 'Y(ST_Centroid(geometry)) AS latitude';
			$fields[] = 'X(ST_Centroid(geometry)) AS longitude';
		} else {
			$fields[] = 'ST_AsText(geometry) AS geometry';
		}
		$fields = implode (', ', $fields);
		
		# In export mode, order the data
		$orderBySql = ($exportCsv && $orderBy ? 'ORDER BY ' . implode (',', $orderBy) : '');
		
		# Support close datasets for GeoJSON output when zoomed in; CSV export gets the close dataset
		$closeSql = '';
		if ($this->settings['closeDatasets']) {
			if ($exportCsv) {
				$closeSql = 'AND close IS NOT NULL';
			} else {
				if (in_array ($year, $this->settings['closeDatasets'])) {
					$closeSql = 'AND close ' . ($zoom >= $this->settings['closeZoom'] ? '= 1' : 'IS NULL');
				}
			}
		}
		
		# Construct the query
		$query = "
			SELECT
				{$fields}
			FROM {$this->settings['database']}.{$this->settings['table']}
			WHERE
				MBRIntersects(geometry, ST_GeomFromText('{$bboxGeom}') )
				AND year = {$year}
				{$closeSql}
			{$orderBySql}
		;";
		
		# If exporting, serve CSV and end
		$filenameBase = "{$this->settings['downloadFilenameBase']}_{$field}_{$year}";
		if ($exportCsv) {
			$headings = $this->databaseConnection->getHeadings ($this->settings['database'], $this->settings['table']);
			$this->databaseConnection->serveCsv ($query, array (), $filenameBase, $timestamp = true, $headings, false, false, true, 500, $this->settings['downloadInitialNotice']);
			die;
		}
		
		# Get the data, except for no-variable option
		if ($field == '_') {
			$data = array ();
		} else {
			$data = $this->databaseConnection->getData ($query);
		}
		
		# Format decimal fields, handling explicitly unknown values, conversion to 2 decimal places, and removing trailing zeroes
		$data = $this->formatDecimalFields ($data, $decimalPlaces = 2);
		
		# If required, convert exact values to intervals
		if ($this->settings['intervalsMode']) {
			$data = $this->convertToIntervals ($data);
		}
		
		# Convert to GeoJSON
		require_once ('geojsonRenderer.class.php');
		$geojsonRenderer = new geojsonRenderer ();
		foreach ($data as $id => $location) {
			$properties = $location;
			unset ($properties['geometry']);
			$geojsonRenderer->geometryWKT ($location['geometry'], $properties);
		}
		$data = $geojsonRenderer->getData ();
		
		# Simplify the lines to reduce data volume
		#!# This should really be done before the GeoJSON stage (and closeModeSimplifyFar removed/modified), as geojsonRenderer::unpackPointsCSV function is very memory-intensive; though ultimately, ST_Simplify would avoid large amounts of data entirely
		if ($zoomedOut) {
			$data = $this->simplifyLines ($data);
		}
		
		# GeoJSON export; essentially a standard GeoJSON API output but with Content-Disposition to push as file
		if ($exportGeojson) {
			$filenameBase .= '_savedAt' . date ('Ymd-His');
			$filename = $filenameBase . '.geojson';
			header ('Content-Disposition: attachment; filename="' . $filename . '"');
			
			# Encode the JSON
			$flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
			if ($this->settings['apiJsonPretty']) {
				$flags = JSON_PRETTY_PRINT | $flags;
			}
			$json = json_encode ($data, $flags);	// Enable pretty-print; see: http://www.vinaysahni.com/best-practices-for-a-pragmatic-restful-api#pretty-print-gzip
			
			# Send the data
			header ('Content-type: application/json; charset=UTF-8');
			echo $json;
			die;
		}
		
		# Add timings in a top-level metadata field
		$timeFinish = microtime (true);
		$time = $timeFinish - $timeStart;
		$metadata = array (
			'properties' => array (
				'time' => round ($time, 3),
			)
		);
		$data = array_merge ($metadata, $data);
		
		# Return the data
		return $data;
	}
	
	
	# Function to format numbers, handling explicitly unknown values, conversion to 2 decimal places, and removing trailing zeroes
	private function formatDecimalFields ($data, $decimalPlaces)
	{
		# Determine fields that are DECIMAL
		$fields = $this->databaseConnection->getFields ($this->settings['database'], 'data');
		$decimalFields = array ();
		foreach ($fields as $field => $attributes) {
			if (substr_count (strtolower ($attributes['Type']), 'decimal')) {
				$decimalFields[] = $field;
			}
		}
		
		# Convert to decimal for supported fields
		foreach ($data as $index => $record) {
			foreach ($decimalFields as $field) {
				if (isSet ($data[$index][$field])) {
					
					# Convert explicitly unknown values to the string symbol
					if ($this->settings['valueUnknown']) {
						if (floatval ($data[$index][$field]) == $this->settings['valueUnknown']) {
							$data[$index][$field] = $this->settings['valueUnknownString'];
						}
						continue;
					}
					
					# Format numbers to specified decimal places, removing trailing zeroes
					#!# Ideally the trailing zeroes handling would be handled natively by the database library
					$data[$index][$field] = number_format ($data[$index][$field], $decimalPlaces, '.', '');
					$data[$index][$field] = floatval ($data[$index][$field]);
				}
			}
		}
		
		# Return the data
		return $data;
	}
	
	
	# Function to quantize a value to an interval, e.g. "2.3" with ranges "1-3, 3-5, 5-7" would become "3-5"
	private function convertToIntervals ($data)
	{
		# Determine fields to quantize and their ranges
		$quantizeFields = array ();
		foreach ($this->settings['fields'] as $fieldId => $field) {
			if ($field['intervals']) {
				if (is_string ($field['intervals'])) {	// Array type has its own colour set, defined associatively, so only string type needs to be checked
					$quantizeFields[$fieldId] = preg_split ('/,\s*/', $field['intervals']);	// Split by comma/comma-whitespace
				}
			}
		}
		
		# Quantize to an interval for the specified field(s)
		foreach ($data as $id => $location) {
			foreach ($quantizeFields as $field => $intervals) {
				if (array_key_exists ($field, $data[$id])) {
					$data[$id][$field] = $this->getInterval ($data[$id][$field], $intervals);
				}
			}
		}
		
		# Return the modified dataset
		return $data;
	}
	
	
	# Function to determine the interval; this is the server-side equivalent of the getColour algorithm in the javascript (but returning an interval, not the colour itself)
	private function getInterval ($value, $intervals)
	{
		# Return non-numeric values unmodified
		if (!is_numeric ($value)) {return $value;}
		
		# Loop through to find the correct range
		$lastInterval = count ($intervals) - 1;
		foreach ($intervals as $index => $interval) {
			
			// Exact value, e.g. '0'
			if (preg_match ('/^([.0-9]+)$/', $interval, $matches)) {
				if ($value == $matches[1]) {
					return $interval;
				}
			}
			
			# Up-to range, e.g. '<10'
			if (preg_match ('/^<([.0-9]+)$/', $interval, $matches)) {
				if ($value < $matches[1]) {
					return $interval;
				}
			}
			
			# Range, e.g. '5-10' or '5 - <10'
			if (preg_match ('/^([.0-9]+)(-| - <)([.0-9]+)$/', $interval, $matches)) {
				if (($value >= $matches[1]) && ($value < $matches[3])) {	// 10 treated as matching in 10-20, not 5-10
					return $interval;
				}
				
				# Deal with last, where (e.g.) 90-100 is implied to include 100
				if ($index == $lastInterval) {
					if ($value == $matches[2]) {
						return $interval;
					}
				}
			}
			
			# Excess value, e.g. '100+' or '≥100'
			if (preg_match ('/^([.0-9]+)\+$/', $interval, $matches) || preg_match ('/^≥([.0-9]+)$/', $interval, $matches)) {
				if ($value >= $matches[1]) {
					return $interval;
				}
			}
		}
		
		# Unknown/other, if other checks have not matched
		return NULL;	// Unmatched value
	}
	
	
	# Function to simplify lines; this is a wrapper to the Douglas-Peucker algorithm library
	#!# Migrate to ST_Simplify available in MySQL 5.7: https://dev.mysql.com/doc/refman/5.7/en/spatial-convenience-functions.html#function_st-simplify
	private function simplifyLines ($data, $thresholdMetres = 1000)
	{
		# Load the library
		require_once ('lib/simplifyLineHelper.class.php');
		$simplifyLine = new simplifyLine ();
		
		# Simplify each feature
		foreach ($data['features'] as $featureIndex => $feature) {
			switch ($feature['geometry']['type']) {
					
				case 'Polygon':
					foreach ($feature['geometry']['coordinates'] as $coordinateSetIndex => $coordinates) {
						$data['features'][$featureIndex]['geometry']['coordinates'][$coordinateSetIndex] = $simplifyLine->straighten ($coordinates, $thresholdMetres);
					}
					break;
					
				case 'MultiPolygon':
					foreach ($feature['geometry']['coordinates'] as $polygonIndex => $polygons) {
						foreach ($polygons as $coordinateSetIndex => $coordinates) {
							$data['features'][$featureIndex]['geometry']['coordinates'][$polygonIndex][$coordinateSetIndex] = $simplifyLine->straighten ($coordinates, $thresholdMetres);
						}
					}
					break;
			}
		}
		
		# Return the data
		return $data;
	}
}

?>
