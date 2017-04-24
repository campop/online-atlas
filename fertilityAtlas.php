<?php

# Class to create the online atlas

require_once ('frontControllerApplication.php');
class fertilityAtlas extends frontControllerApplication
{
	# Function to assign defaults additional to the general application defaults
	public function defaults ()
	{
		# Specify available arguments as defaults or as NULL (to represent a required argument)
		$defaults = array (
			'applicationName' => 'Atlas of Victorian Fertility',
			'div' => 'fertilityatlas',
			'hostname' => 'localhost',
			'database' => 'fertilityatlas',
			'username' => 'fertilityatlas',
			'password' => NULL,
			'table' => 'data',
			'databaseStrictWhere' => true,
			'administrators' => true,
			'geocoderApiKey' => NULL,
			// 'importsSectionsMode' => true,
			'datasets' => array (1851, 1861, 1881, 1891, 1901, 1911),
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
				'tab' => 'Map of Victorian Fertility',
				'icon' => 'map',
			),
			'about' => array (
				'description' => 'About the Atlas of Victorian Fertility',
				'url' => 'about/',
				'tab' => 'About the Atlas',
			),
			'import' => array (
				'description' => 'Import',
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
		return "
			CREATE TABLE administrators (
			  username varchar(255) COLLATE utf8_unicode_ci NOT NULL COMMENT 'Username',
			  active enum('','Yes','No') COLLATE utf8_unicode_ci NOT NULL DEFAULT 'Yes' COMMENT 'Currently active?',
			  privilege enum('Administrator','Restricted administrator') COLLATE utf8_unicode_ci NOT NULL DEFAULT 'Administrator' COMMENT 'Administrator level',
			  PRIMARY KEY (username)
			) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='System administrators';
			
			CREATE TABLE `data` (
			  `id` int(11) NOT NULL COMMENT 'Automatic key',
			  `year` int(4) NOT NULL COMMENT 'Year',
			  `CEN` int(11) NOT NULL COMMENT 'CEN (e.g. from CEN_1851)',
			  `COUNTRY` varchar(255) COLLATE utf8_unicode_ci NOT NULL COMMENT 'Country',
			  `DIVISION` varchar(255) COLLATE utf8_unicode_ci NOT NULL COMMENT 'Division',
			  `REGCNTY` varchar(255) COLLATE utf8_unicode_ci NOT NULL COMMENT 'County',
			  `REGDIST` varchar(255) COLLATE utf8_unicode_ci NOT NULL COMMENT 'Registration district',
			  `SUBDIST` varchar(255) COLLATE utf8_unicode_ci NOT NULL COMMENT 'Sub-district',
			  `RAW_1519` decimal(14,7) NOT NULL COMMENT 'Females aged 15-19',
			  `EBS_1519` decimal(14,7) NOT NULL COMMENT 'Females aged 15-19 (smoothed)',
			  `RAW_2024` decimal(14,7) NOT NULL COMMENT 'Females aged 20-24',
			  `EBS_2024` decimal(14,7) NOT NULL COMMENT 'Females aged 20-24 (smoothed)',
			  `RAW_2529` decimal(14,7) NOT NULL COMMENT 'Females aged 25-29',
			  `EBS_2529` decimal(14,7) NOT NULL COMMENT 'Females aged 25-29 (smoothed)',
			  `RAW_3034` decimal(14,7) NOT NULL COMMENT 'Females aged 30-34',
			  `EBS_3034` decimal(14,7) NOT NULL COMMENT 'Females aged 30-34 (smoothed)',
			  `RAW_3539` decimal(14,7) NOT NULL COMMENT 'Females aged 35-39',
			  `EBS_3539` decimal(14,7) NOT NULL COMMENT 'Females aged 35-39 (smoothed)',
			  `RAW_4044` decimal(14,7) NOT NULL COMMENT 'Females aged 40-44',
			  `EBS_4044` decimal(14,7) NOT NULL COMMENT 'Females aged 40-44 (smoothed)',
			  `RAW_4549` decimal(14,7) NOT NULL COMMENT 'Females aged 45-49',
			  `EBS_4549` decimal(14,7) NOT NULL COMMENT 'Females aged 45-49 (smoothed)',
			  `RAW_TFR` decimal(14,7) NOT NULL COMMENT 'Total fertility rate',
			  `EBS_TFR` decimal(14,7) NOT NULL COMMENT 'Total fertility rate (smoothed)',
			  `geometry` geometry NOT NULL COMMENT 'Geometry'
			) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='Data';
		";
	}
	
	
	# Welcome screen
	public function home ()
	{
		# Start the HTML
		$html = '
			
			<script src="https://code.jquery.com/jquery-3.1.1.min.js"></script>
			<script src="https://code.jquery.com/ui/1.12.1/jquery-ui.min.js"></script>
			<link rel="stylesheet" href="http://code.jquery.com/ui/1.12.1/themes/base/jquery-ui.css" type="text/css">
			
			<link rel="stylesheet" href="https://unpkg.com/leaflet@1.0.3/dist/leaflet.css" />
			<script src="https://unpkg.com/leaflet@1.0.3/dist/leaflet.js"></script>
			
			<script type="text/javascript" src="' . $this->baseUrl . '/js/lib/geocoder/geocoder.js"></script>
			
			<script type="text/javascript" src="' . $this->baseUrl . '/js/lib/leaflet-fullHash/leaflet-fullHash.js"></script>
			
			<!-- Full screen control; see: https://github.com/Leaflet/Leaflet.fullscreen -->
			<script src="https://api.mapbox.com/mapbox.js/plugins/leaflet-fullscreen/v1.0.1/Leaflet.fullscreen.min.js"></script>
			<link href="https://api.mapbox.com/mapbox.js/plugins/leaflet-fullscreen/v1.0.1/leaflet.fullscreen.css" rel="stylesheet" />
			
			<!-- Geolocation control; see: https://github.com/domoritz/leaflet-locatecontrol -->
			<script src="https://domoritz.github.io/leaflet-locatecontrol/dist/L.Control.Locate.min.js" charset="utf-8"></script>
			<link rel="stylesheet" href="//maxcdn.bootstrapcdn.com/font-awesome/4.5.0/css/font-awesome.min.css">
			<link rel="stylesheet" href="https://domoritz.github.io/leaflet-locatecontrol/dist/L.Control.Locate.min.css" />
			
			<script type="text/javascript" src="' . $this->baseUrl . '/js/lib/leaflet-ajax/dist/leaflet.ajax.min.js"></script>
			<script type="text/javascript" src="' . $this->baseUrl . '/js/lib/LeafletSlider/leaflet.SliderControl.min.js"></script>
			
			<script type="text/javascript" src="' . $this->baseUrl . '/js/fertilityatlas.js"></script>
			<script type="text/javascript">
				
				var config = {
					geocoderApiKey: \'' . $this->settings['geocoderApiKey'] . '\'
				}
				
				$(function() {
					fertilityatlas.initialise (config);
				});
				
			</script>
			
			
			<p><em>Project under development.</em></p>
			
			<div id="mapcontainer">
				
				<div id="geocoder">
					<input type="text" name="location" autocomplete="off" placeholder="Search locations and move map" tabindex="1" />
				</div>
				
				<div id="map"></div>
				
			</div>
		';
		
		# Show the HTML
		echo $html;
	}
	
	
	# About page
	public function about ()
	{
		# Load and show the HTML
		$html = file_get_contents ($this->applicationRoot . '/about.html');
		echo $html;
	}
	
	
	# Function to import the data files, clearing any existing import
	public function import ()
	{
		# Define the import types
		$importTypes = array (
			'full' => 'Full import'
		);
		
		# Import files
		$importFiles = array ();
		foreach ($this->settings['datasets'] as $dataset) {
			$importFiles[] = $dataset;
		}
		
		# Define the introduction HTML
		$fileCreationInstructionsHtml  = "\n\t" . '<p>Create the shapefile, and zip up the contents of the folder.</p>';
		
		# Run the import UI (which will output HTML)
		$this->importUi ($importFiles, $importTypes, $fileCreationInstructionsHtml, 'zip');
	}
	
	
	# Function to do the actual import
	public function doImport ($exportFiles, $importType, &$html)
	{
		# Start the HTML
		$html = '';
		
		# Enable high memory due to GeoJSON size
		ini_set ('memory_limit','200M');
		
		# Loop through each file
		$i = 0;
		foreach ($exportFiles as $year => $file) {
			
			# Remove existing data file if present
			$geojson = "{$this->applicationRoot}/data/{$year}.geojson";
			if (is_file ($geojson)) {
				unlink ($geojson);
			}
			
			# Unzip the shapefile
			$path = pathinfo ($file);
			$tempDir = "{$this->applicationRoot}/exports/{$path['filename']}/";
			$command = "unzip {$file} -d {$tempDir}";		// http://stackoverflow.com/questions/8107886/create-folder-for-zip-file-and-extract-to-it
			exec ($command, $output);
			// application::dumpData ($output);
			
			# Convert to GeoJSON
			$currentDirectory = getcwd ();
			chdir ($tempDir);
			$command = "ogr2ogr -f GeoJSON -lco COORDINATE_PRECISION=4 -t_srs EPSG:4326 {$geojson} *.shp";
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
}

?>