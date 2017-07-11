<?php

# Helper to simplify a line
# Code from CycleStreets

class simplifyLine
{
	# Constructor
	public function __construct ()
	{
		// No action
		
	}
	
	
	
	/**
	 * Straighten a polyline by removing redundant points.
	 * Any points that lie within a threshold distance from a straight line between the end points of the line is considered redundant.
	 * 
	 * Based on an algorithm by Douglas-Peucker which is described at:
	 * http://wiki.openstreetmap.org/wiki/JOSM/Plugins/RemoveRedundantPoints
	 * and implemented at:
	 * https://github.com/bularcasergiu/RemoveRedundantPoints/blob/master/src/org/openstreetmap/josm/plugins/RemoveRedundantPoints/DPfilter.java
	 * 
	 * It is sensible to call stitchWays on the line first, as that will enable straightening across sub-lines within an overall line
	 * 
	 * @param array $points List of coordinates each as array(lon, lat).
	 * @param The maxium offset of an intermediate point from a straight line drawn between the two ends. A more descriptive name might be threshold.
	 *
	 * @result array $points Ditto.
	 */
	public function straighten ($points, $thresholdMetres = 20)
	{
		// Assure threshold is greater than zero
		if ($thresholdMetres <= 0) {return false;}
		
		// Result
		return $this->ramerDouglasPeuckerFunction ($points, 0, count ($points) - 1, $thresholdMetres);
	}
	
	
	/**
	 * Implements the DouglasPeuckerAlgorithm on list of points - filtering out those within threshold of straight line between the start and finish.
	 * 
	 * @param array $points List of coordinates
	 * @param int Start index
	 * @param int Finish index
	 * @return double[x.coordinate][y.coordinate]
	 */
	private function ramerDouglasPeuckerFunction ($points, $startIndex, $finishIndex, $thresholdMetres)
	{
		$dmax		= 0;	// double - maximum deviation from a straight line between start and finish
		$idx		= 0;	// int
		$distance	= 0;	// double
		$xx			= 0;	// double
		$yy			= 0;	// double
		$length		= 0;	// double
		
		// End points
		$first_lastNodes = array ();
		
		// Points are arrays of lon, lat.
		$first_lastNodes[] = array ($points[$startIndex][0],  $points[$startIndex][1]);
		$first_lastNodes[] = array ($points[$finishIndex][0], $points[$finishIndex][1]);

		// Bind start and finish coordinates
		$x1 = $points[$startIndex][0];
		$y1 = $points[$startIndex][1];
		$x2 = $points[$finishIndex][0];
		$y2 = $points[$finishIndex][1];

		// double dx = x2 - x1;double dy = y2 - y1;double d12 = dx * dx + dy * dy;
		$dx = $x2 - $x1;
		$dy = $y2 - $y1;
		// !! This value can be zero if start and finish points are the same.
		$d12 = $dx * $dx + $dy * $dy;

		// The whole purpose of this loop is to find the maximum deviation from a straight line between start and finish
		for ($i = $startIndex + 1; $i < $finishIndex; $i++) {

			// Coordinates at point with index i
			$xi = $points[$i][0];
			$yi = $points[$i][1];

			// U is some kind of scaling factor of the point i along the line 12
			if ($d12 == 0) {

				// When start and finish are at the same point use zero
				$u = 0;
				
			} else {

				// U is some kind of scaling factor of the point i along the line 12
				$u = (($xi - $x1) * $dx + ($yi - $y1) * $dy) / $d12;
			}

			// Interpolate to find the coordinate of the nearest point to i on the line jointing start and finish
			$xx = $x1 + $u * $dx;
			$yy = $y1 + $u * $dy;
			
			// Gets length in metres
			$length = $this->haversineGetCrowFlyDistance ($xx, $yy, $xi, $yi);
			
			// Find the maximum deviation from a straight line
			if ($length > $dmax) {
				$idx = $i;
				$dmax = $length;
			}
		}
		
		if ($dmax >= $thresholdMetres) {
			
			// Recurse
			$recursiveResult1 = $this->ramerDouglasPeuckerFunction ($points, $startIndex, $idx, $thresholdMetres);
			$recursiveResult2 = $this->ramerDouglasPeuckerFunction ($points, $idx, $finishIndex, $thresholdMetres);
			
			// Start a new result with this size
			$result = array ();
			array_pad ($result, count ($recursiveResult1) - 1 + count ($recursiveResult2), array (0, 0));
			
			// Splice in recursion result (!! Garbagey)
			array_splice ($result, 0, count ($recursiveResult1) - 1, $recursiveResult1);
			array_splice ($result, count ($recursiveResult1) - 1, count ($recursiveResult2), $recursiveResult2);
			
			// Result
			return $result;
		}
		
		// Result
		return $first_lastNodes;
	}
	
	
	
	/*
	 * Useful page, mentioning haversine formula:
	 * @link http://www.movable-type.co.uk/scripts/latlong.html
	 * @link http://en.wikipedia.org/wiki/Great-circle_distance
	 *
	 * @return float
	 */
	public static function haversineGetCrowFlyDistance ($lon1, $lat1, $lon2, $lat2)
	{
		$earthRadiusMetres = 6372795;
		return round(2 * asin(sqrt(pow(sin(deg2rad(($lat1 - $lat2)/2)),2) + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * pow(sin(deg2rad(($lon1 - $lon2) / 2)), 2))) * $earthRadiusMetres);
	}
	
}
