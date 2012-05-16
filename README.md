Crossfire
=======
*Crossfire* is a Firebug extension which implements a JSON protocol to allow remote clients 
(like an IDE or code editor) to connect to Firebug.


Source Repository Structure
---------------------------


Build Firebug XPI
-----------------
In order to build Firebug *.xpi package run following in your command line
(you need [Apache Ant](http://ant.apache.org/))

    $ cd crossfire
    $ ant

The *.xpi file should be located within `./release` directory.


Run Firebug From Source
-----------------------
The *extension* directory directly contains Firebug extension files and so, you can run
Firebug directly from it. This is the recommended way how to quickly test your code
changes and provide a patch.

1. Locate your Firefox [profile folder](http://kb.mozillazine.org/Profile_folder)
2. Open `extensions/` folder, create if it doesn't exist.
3. Create a new text file and put the full path to your development folder inside.
(e.g. `C:\firebug\extension\` or `~/firebug/extension/`). Windows users should retain the OS'
slash direction, and everyone should remember to include a closing slash and remove any
trailing spaces.
4. Save the file with Firebug ID as it's name `firebug@software.joehewitt.com`


Further Resources
-----------------


