#!/usr/bin/env bash

releasedate=170421

years=(
	1851
	1861
	1881
	1891
	1901
	1911
)


# Get current directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Convert each shapefile
for year in ${years[@]} ; do
	rm -f "${DIR}/${year}.geojson"
	cd "${DIR}/_originals/${releasedate}/TFR_${year}/"
	ogr2ogr -f GeoJSON -t_srs EPSG:4326 "${DIR}/${year}.geojson" *.shp
	cd "${DIR}/"
done
