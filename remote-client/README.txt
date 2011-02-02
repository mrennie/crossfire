This is the README for the Crossfire Remote-Client XULRunner app.

You can run this as a standalone XULRunner app with Firefox's -app switch,
and pointing it at the application.ini file in this directory.

$> cd crossfire/branches/0.3/remote-client
crossfire/branches/0.3/remote-client$> firefox -app application.ini

Note that this app requires Firebug and Crossfire (and optionally Chromebug)
extensions but they are installed by linking to their locations in the firebug
svn repository. So you will either need to have those parts of the tree checked
out as well, or adjust the links in the extensions/ folder.

