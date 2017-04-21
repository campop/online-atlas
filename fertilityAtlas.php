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
			'useDatabase' => false,
		);
		
		# Return the defaults
		return $defaults;
	}
	
	
	# Function assign additional actions
	public function actions ()
	{
		# Specify additional actions
		$actions = array (
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
			
			<p><em>Project under development.</em></p>
			
			<script src="https://code.jquery.com/jquery-3.1.1.min.js"></script>
			<script src="https://code.jquery.com/ui/1.12.1/jquery-ui.min.js"></script>
			<link rel="stylesheet" href="http://code.jquery.com/ui/1.12.1/themes/base/jquery-ui.css" type="text/css">
			
			<link rel="stylesheet" href="https://unpkg.com/leaflet@1.0.3/dist/leaflet.css" />
			<script src="https://unpkg.com/leaflet@1.0.3/dist/leaflet.js"></script>
			
			<script type="text/javascript" src="js/lib/geocoder/geocoder.js"></script>
			
			<script type="text/javascript" src="js/lib/leaflet-fullHash/leaflet-fullHash.js"></script>
			
			<script type="text/javascript" src="js/lib/leaflet-ajax/dist/leaflet.ajax.min.js"></script>
			<script type="text/javascript" src="js/lib/LeafletSlider/leaflet.SliderControl.min.js"></script>
			
			<script type="text/javascript" src=".config.js"></script>
			<script type="text/javascript" src="js/fertilityatlas.js"></script>
			<script type="text/javascript">
				$(function() {
					fertilityatlas.initialise (config);
				});
			</script>
			
			<div id="fertilityatlas">
				
				
				<div id="geocoder">
					<input type="text" name="location" autocomplete="off" placeholder="Search locations and move map" tabindex="1" />
				</div>
				
				<div id="map"></div>
				
				
			</div>
		';
		
		# Show the HTML
		echo $html;
	}
	
	
	# Function to ...
	private function someFunction ()
	{
		
	}
	
}

?>