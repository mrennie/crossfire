FBL.ns(function() {

Crossfire.Firefox =
{
    onConnect: function()
    {
        Crossfire.Firefox.openFirebugClient();
        Crossfire.connect();
    },

    openFirebugClient: function()
    {
        var args = {
            FBL: FBL,
            Firebug: this,
        };
        var win = FBL.openWindow("Firebug", "chrome://firebug/content/firebug.xul", "", args);
    }
}

});