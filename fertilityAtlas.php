<?php

# Class to create the Atlas of Victorian Fertility

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
		$html = 'Home page';
		
		
		# Show the HTML
		echo $html;
	}
	
	
	# Function to ...
	private function someFunction ()
	{
		
	}
	
}

?>