<?php

# Class to create the online atlas

require_once ('frontControllerApplication.php');
class onlineAtlas extends frontControllerApplication
{
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
			'zoomedOut' => 8,	// Level at which the interface shows only overviews without detail to keep data size down
			'apiUsername' => true,
			'apiJsonPretty' => false,
			'downloadFilenameBase' => 'onlineatlas',
			'useTemplating' => true,
			'disableTabs' => true,
			'authLinkVisibility' => false,
			'h1' => '',
			'div' => false,
			'firstRunMessageHtml' => false,
			'defaultField' => NULL,
			'fields' => array (
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
			'funders' => array (
				'description' => false,
				'url' => 'funders/',
				'tab' => 'Funders',
			),
			'contacts' => array (
				'description' => false,
				'url' => 'contacts/',
				'tab' => 'Contacts',
			),
			'export' => array (
				'description' => false,
				'url' => 'data.csv',
				'export' => true,
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
			  privilege enum('Administrator','Restricted administrator') COLLATE utf8_unicode_ci NOT NULL DEFAULT 'Administrator' COMMENT 'Administrator level',
			  PRIMARY KEY (username)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='System administrators';
			
			CREATE TABLE `data` (
			  `id` INT(11) NOT NULL COMMENT 'Automatic key',
			  `year` INT(4) NOT NULL COMMENT 'Year',
			  
			  {$specificFields}
			  
			  `geometry` GEOMETRY NOT NULL COMMENT 'Geometry'
			) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='Data'
		;";
		
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
		# Set the body class
		$this->template['action'] = $this->action;
		
		# Set the SSO block
		$this->template['sso'] = pureContent::ssoLinks ('Raven');
		
		# Set the admin
		$this->template['userIsAdministrator'] = $this->userIsAdministrator;
		
		# Set the default title
		$this->template['title'] = $this->settings['applicationName'];
		$this->template['pageHeader'] = $this->settings['pageHeader'];
		
	}
	
	
	
	# Welcome screen
	public function home ()
	{
		# Start the HTML
		$html = '
			
			<!-- Main stylesheet -->
			<link rel="stylesheet" href="' . $this->baseUrl . '/css/styles.css?3" type="text/css">
			
			<script src="https://code.jquery.com/jquery-3.2.1.min.js"></script>
			<script src="https://code.jquery.com/ui/1.12.1/jquery-ui.min.js"></script>
			<link rel="stylesheet" href="https://code.jquery.com/ui/1.12.1/themes/base/jquery-ui.css" type="text/css">
			
			<link rel="stylesheet" href="https://unpkg.com/leaflet@1.2.0/dist/leaflet.css" />
			<script src="https://unpkg.com/leaflet@1.2.0/dist/leaflet.js"></script>
			
			<script type="text/javascript" src="' . $this->baseUrl . '/js/lib/geocoder/geocoder.js"></script>
			
			<script type="text/javascript" src="' . $this->baseUrl . '/js/lib/leaflet-fullHash/leaflet-fullHash.js"></script>
			
			<!-- Leaflet-active-area; see: https://github.com/Mappy/Leaflet-active-area -->
			<script src="' . $this->baseUrl . '/js/lib/Leaflet-active-area/src/leaflet.activearea.js" charset="utf-8"></script>
			
			<!-- Cookie support -->
			<script src="' . $this->baseUrl . '/js/lib/js-cookie/js.cookie.min.js"></script>
			
			<!-- Vex dialogs; see: http://github.hubspot.com/vex/ -->
			<script src="https://cdnjs.cloudflare.com/ajax/libs/vex-js/4.0.0/js/vex.combined.min.js"></script>
			<script>vex.defaultOptions.className = \'vex-theme-plain\'</script>
			<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/vex-js/4.0.0/css/vex.min.css" />
			<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/vex-js/4.0.0/css/vex-theme-plain.min.css" />
			
			<!-- Full screen control; see: https://github.com/Leaflet/Leaflet.fullscreen -->
			<script src="https://api.mapbox.com/mapbox.js/plugins/leaflet-fullscreen/v1.0.1/Leaflet.fullscreen.min.js"></script>
			<link href="https://api.mapbox.com/mapbox.js/plugins/leaflet-fullscreen/v1.0.1/leaflet.fullscreen.css" rel="stylesheet" />
			
			<!-- Geolocation control; see: https://github.com/domoritz/leaflet-locatecontrol -->
			<script src="' . $this->baseUrl . '/js/lib/leaflet-locatecontrol/dist/L.Control.Locate.min.js" charset="utf-8"></script>
			<link rel="stylesheet" href="' . $this->baseUrl . '/js/lib/leaflet-locatecontrol/dist/L.Control.Locate.min.css" />
			<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css">
			
			<!-- Side-by-side sync -->
			<script src="' . $this->baseUrl . '/js/lib/Leaflet.Sync/L.Map.Sync.js" charset="utf-8"></script>
			
			<script type="text/javascript" src="' . $this->baseUrl . '/js/lib/leaflet-ajax/dist/leaflet.ajax.min.js"></script>
			
			<script type="text/javascript" src="' . $this->baseUrl . '/js/onlineatlas.js?3"></script>
			<script type="text/javascript">
				
				var config = {
					geocoderApiKey: \'' . $this->settings['geocoderApiKey'] . '\',
					zoomedOut: ' . $this->settings['zoomedOut'] . ',
					datasets: ' . json_encode ($this->settings['datasets']) . ',
					defaultField: \'' . $this->settings['defaultField'] . '\',
					fields: ' . json_encode ($this->settings['fields'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . ',
					firstRunMessageHtml: \'' . $this->settings['firstRunMessageHtml'] . '\'
				}
				
				$(function() {
					onlineatlas.initialise (config, \'' . $this->baseUrl . '\');
				});
				
			</script>
			
			<div id="mapcontainers"></div>
		';
		
		# Add text for more details on each field into the page
		$html .= "\n<div id=\"aboutfields\">";
		$html .= file_get_contents ($this->applicationRoot . '/about.html');
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
		# Load and show the HTML
		$file = ($path ? $path : $this->applicationRoot) . '/about.html';
		$html = file_get_contents ($file);
		
		# Templatise
		$this->template['contentHtml'] = $html;
		$html = $this->templatise ();
		
		# Show the HTML
		echo $html;
	}
	
	
	# Funders page
	public function funders ($path = false)
	{
		# Load and show the HTML
		$file = ($path ? $path : $this->applicationRoot) . '/funders.html';
		$html = file_get_contents ($file);
		
		# Templatise
		$this->template['contentHtml'] = $html;
		$html = $this->templatise ();
		
		# Show the HTML
		echo $html;
	}
	
	
	# Contact page
	public function contacts ()
	{
		# Add the feedback form
		$this->template['feedbackform'] = parent::feedback (NULL, NULL, $echoHtml = false);
		
		# Templatise
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
		
		# Create the list of import files
		$importFiles = array ();
		foreach ($this->settings['datasets'] as $dataset) {
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
	public function doImport ($exportFiles, $importType, &$html)
	{
		# Start the HTML
		$html = '';
		
		# Enable high memory due to GeoJSON size
		ini_set ('memory_limit','200M');
		
		# Ensure the temp directory is writable
		$exportsTmpDir = "{$this->applicationRoot}/exports-tmp";
		if (!is_writable ($exportsTmpDir)) {
			$html = "\n<p class=\"warning\">ERROR: the temporary directory {$exportsTmpDir}/ does not exist or is not writable.</p>";
			return false;
		}
		
		# Loop through each file
		$i = 0;
		foreach ($exportFiles as $dataset => $file) {
			
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
			
			# Convert to GeoJSON
			$currentDirectory = getcwd ();
			chdir ($tempDir);
			$command = "ogr2ogr -f GeoJSON -lco COORDINATE_PRECISION=4 -t_srs EPSG:4326 {$geojson} *.shp";	// E.g.: ogr2ogr -f GeoJSON -s_srs EPSG:3857 -t_srs EPSG:4326 1911.geojson RSD_1911.shp
			exec ($command, $output);
			// application::dumpData ($output);
			chdir ($currentDirectory);	// Change back
			
			# Remove the shapefile files and containing directory
			array_map ('unlink', glob ("{$tempDir}/*.*"));	// http://php.net/unlink#109971
			rmdir ($tempDir);
			
			# Determine whether to truncate
			$truncate = ($i == 0);
			$i++;
			
			# Import the GeoJSON contents into the database
			$this->importGeojson ($geojson, $year, $truncate);
			
			# Remove the GeoJSON file after use
			unlink ($geojson);
		}
		
		# Return success
		return true;
	}
	
	
	# Function to import contents of a GeoJSON file into the database
	private function importGeojson ($geojsonFilename, $year, $truncate)
	{
		# Truncate the table for the first file; requires the DROP privilege
		if ($truncate) {
			$this->databaseConnection->truncate ($this->settings['database'], $this->settings['table']);
		}
		
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
			
			# Replace CEN_1851, CEN_1861, etc. with CEN
			$fieldname = 'CEN_' . $year;
			$feature['properties']['CEN'] = $feature['properties'][$fieldname];
			unset ($feature['properties'][$fieldname]);
			
			# Add the properties
			$insert += $feature['properties'];
			
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
	
	
	# Export, essentially just a nicer URL to the API
	public function export ()
	{
		return $this->apiCall_locations (true);
	}
	
	
	# API call to retrieve data
	public function apiCall_locations ($export = false)
	{
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
		$zoomedOut = ($zoom <= $this->settings['zoomedOut']);
		
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
		if (!$zoomedOut || $export) {
			$fields[] = 'REGDIST';
			$fields[] = 'SUBDIST';
			$fields[] = 'year';
		}
		$fields[] = $field;
		if (!$export) {
			$fields[] = 'ST_AsText(geometry) AS geometry';
		}
		$fields = implode (', ', $fields);
		
		# In export mode, order the data
		$orderBySql = ($export ? 'ORDER BY REGDIST,SUBDIST,year' : '');
		
		# Construct the query
		$query = "
			SELECT
				{$fields}
			FROM {$this->settings['database']}.{$this->settings['table']}
			WHERE
				MBRIntersects(geometry, ST_GeomFromText('{$bboxGeom}') )
				AND year = {$year}
			{$orderBySql}
		;";
		
		# If exporting, serve CSV and end
		if ($export) {
			$headings = $this->databaseConnection->getHeadings ($this->settings['database'], $this->settings['table']);
			$filenameBase = "{$this->settings['downloadFilenameBase']}_{$field}_{$year}";
			$this->databaseConnection->serveCsv ($query, array (), $filenameBase, $timestamp = true, $headings);
			die;
		}
		
		# Get the data
		$data = $this->databaseConnection->getData ($query);
		
		# Determine fields that are DECIMAL so that trailing zeros are removed; also format to 2dp
		#!# Ideally the trailing zeroes handling should be handled natively by the database library
		$fields = $this->databaseConnection->getFields ($this->settings['database'], 'data');
		foreach ($fields as $field => $attributes) {
			if (substr_count (strtolower ($attributes['Type']), 'decimal')) {
				foreach ($data as $index => $record) {
					if (isSet ($data[$index][$field])) {
						$data[$index][$field] = number_format ($data[$index][$field], 2);
						$data[$index][$field] = $data[$index][$field] + 0;
					}
				}
			}
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
		if ($zoomedOut) {
			$data = $this->simplifyLines ($data);
		}
		
		# Return the data
		return $data;
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
