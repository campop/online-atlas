<?php

/**
 * Static class to convert from GeoJSON to OpenGIS SQL spatial geometry (WKT)
 *
 * Copyright CycleStreets Ltd 2017, GPL2
 *
 * @see https://dev.mysql.com/doc/refman/5.7/en/gis-data-formats.html#gis-wkt-format
 * @see http://geojson.org/geojson-spec.html
 */
class geojson2spatial
{
	/**
	 * Main entry point
	 *
	 * @param array $geometry Geojson geometry.
	 * @return string False on failure
	 */
	public static function geojsonGeometry2wkt ($geometry)
	{
		// Check it is an array
		if (!is_array ($geometry)) {return false;}
		
		// Check it has a type
		if (!isset ($geometry['type']) || !$type = $geometry['type']) {return false;}
		
		// Check supported types
		if (!in_array ($type, explode (',', 'Point,LineString,Polygon,MultiPolygon'))) {return false;}
		
		// Get coordinates
		if (!isset ($geometry['coordinates']) || (!$coordinates = $geometry['coordinates']) || !is_array ($coordinates)) {return false;}
		
		// Apply the transformation
		return "{$type}(" . self::$type ($coordinates) . ')';
	}
	
	
	# Point, e.g. POINT(15 20)
	public static function Point			($point)		{return implode (' ', array_map (function ($x) {return round ($x, 6);}, $point));}
	
	
	# LineString, e.g. LINESTRING(0 0, 10 10, 20 25, 50 60)
	public static function LineString		($lineString)	{return implode (',', array_map (array (__CLASS__, 'Point'), $lineString));}
	
	
	# Polygon, e.g. POLYGON((0 0,10 0,10 10,0 10,0 0),(5 5,7 5,7 7,5 7, 5 5))
	public static function Polygon			($polygon)		{return  '(' . implode ('),(', array_map (array (__CLASS__, 'LineString'), $polygon)) . ')';}
	
	
	# Multipolygon, e.g. MULTIPOLYGON(((0 0,10 0,10 10,0 10,0 0)),((5 5,7 5,7 7,5 7, 5 5)))
	public static function MultiPolygon	($multiPolygon)		{return  '(' . implode ('),(', array_map (array (__CLASS__, 'Polygon'), $multiPolygon)) . ')';}
}

?>