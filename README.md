# Online Atlas

This is a PHP application consisting of unbranded base code which implements an online atlas of data from CAMPOP.


Installation
------------

1. Clone the repository.
2. Download the library dependencies and ensure they are in your PHP include_path.
3. Download and install the famfamfam icon set in /images/icons/
4. Add the Apache directives in httpd.conf (and restart the webserver) as per the example given in .httpd.conf.extract.txt; the example assumes mod_macro but this can be easily removed.
5. Create a copy of the index.html.template file as index.html, and fill in the parameters.
6. Ensure the tmp directory is writable, e.g. `chown -R www-data tmp/`
7. Access the page in a browser at a URL which is served by the webserver.


Dependencies
------------

* [application.php application support library](https://download.geog.cam.ac.uk/projects/application/)
* [frontControllerApplication.php front controller application implementation library](https://download.geog.cam.ac.uk/projects/frontcontrollerapplication/)
* [ultimateForm.php form library](https://download.geog.cam.ac.uk/projects/ultimateform/)
* [Smarty](https://www.smarty.net/)


Author
------

Martin Lucas-Smith, Department of Geography, University of Cambridge, 2017-21.


License
-------

- Code license: GPL3
- Data license: To be determined
