# Online Atlas

This is a PHP application consisting of unbranded base code which implements an online atlas of data from CAMPOP.

It is intended to treated as a library included within boostrapping code defining the atlas layers and parameters.


Installation
------------

1. Clone the repository.
2. Run `composer install` to install the PHP dependencies.
3. Run `yarn install` to install the JS dependencies.
4. Download and install the famfamfam icon set in /images/icons/
5. Add the Apache directives in httpd.conf (and restart the webserver) as per the example given in .httpd.conf.extract.txt; the example assumes mod_macro but this can be easily removed.
6. Create a copy of the index.html.template file as index.html, and fill in the parameters.
7. Ensure the tmp directory is writable, e.g. `chown -R www-data tmp/`
8. Access the page in a browser at a URL which is served by the webserver.


Dependencies
------------

* Composer package manager
* Yarn package manager


Author
------

Martin Lucas-Smith, Department of Geography, University of Cambridge, 2017-24.


License
-------

- Code license: GPL3
- Data license: To be determined
