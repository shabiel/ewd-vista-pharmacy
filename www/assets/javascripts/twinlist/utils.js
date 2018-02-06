var utils = function(utils, undefined) {
    ////// visible ///////////////////////////////////////////////////////////
    var visible = {};

    // TODO consider using GAE datastore

    visible.getStorageItem = function(key) {
        if (localStorageSupported) {
            return window.localStorage.getItem(key);
        } else {
            return getCookie(key);
        }
    };

    visible.setStorageItem = function(key, value, days) {
        if (localStorageSupported) {
            window.localStorage.setItem(key, value);
        } else {
            setCookie(key, value, days);
        }
    };

    visible.adjustCase = function(str) {
        return str[0].toUpperCase() + str.slice(1).toLowerCase();
    };

    // TODO remove instances?
    visible.debug = function(str, marker) {
        var mark = marker || "";
        console.log("begin: " + mark);
        console.log(str);
        console.log("end: " + mark);
    };

    // utility function to remove duplicates from an array
    visible.getUniqueElements = function(arr) {
        var u = {}, a = [];
        for (var i = 0, l = arr.length; i < l; ++i) {
            if (u.hasOwnProperty(arr[i])) {
                continue;
            }
            a.push(arr[i]);
            u[arr[i]] = 1;
        }
        return a;
    };
    
    // from http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript/901144#901144
    // retrieve query parameters from URL by name
    visible.getURLParameter = function(name) {
        name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
        var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
            results = regex.exec(location.search);
        return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
    };

    ////// hidden ////////////////////////////////////////////////////////////
    var localStorageSupported = window.localStorage || false;

    function getCookie(name) {
        var cookies = document.cookie.split(";");

        for (var i = 0; i < cookies.length; i++) {
            var key = cookies[i].slice(0, cookies[i].indexOf("="));
            var value = cookies[i].slice(cookies[i].indexOf("=") + 1);
            key = key.trim();

            if (key === name) {
                return unescape(value);
            }
        }
        return null;
    }

    function setCookie(name, value, days) {
        var expires = new Date();
        expires.setDate(expires.getDate() + days);
        value = escape(value) + ((days) ? "" : "; expires=" + expires.toUTCString());
        document.cookie = name + "=" + value;
    }

    // expose interface //////////////////////////////////////////////////
    return visible;
}(window.utils = window.utils || {});
