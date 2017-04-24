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
			'useDatabase' => false,
			'geocoderApiKey' => NULL,
			'administrators' => NULL,
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
		
		# Run the import UI
		$this->importUi ($importFiles, $importTypes, $fileCreationInstructionsHtml, 'zip');
		
		# Show errors file if present
		$html = '';
		if (is_file ($this->errorsFile)) {
			$html .= "\n<hr />";
			$html .= "\n<h3>Errors from import:</h3>";
			$html .= file_get_contents ($this->errorsFile);
		}
		
		# Show the HTML
		echo $html;
	}
	
	
	# Function to do the actual import
	public function doImport ($exportFiles, $importType, &$html)
	{
		# Start the HTML
		$html = '';
		
		# Loop through each file
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
		}
		
		# Return success
		return true;
	}
}

?>