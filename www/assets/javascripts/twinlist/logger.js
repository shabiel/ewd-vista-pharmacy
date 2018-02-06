var logger = function(logger, undefined) {
// visible ///////////////////////////////////////////////////////////////
    var visible = {};
    
    // TODO consider refactor elsewhere
    // constants for events
    visible.EVENT_ANIMATION_SPEED_CHANGE = "CHANGED_ANIMATION_SPEED";
    visible.EVENT_CLICKED = "CLICKED"; // user clicked on something
    visible.EVENT_DATASET_CHANGE = "CHANGED_DATASET";
    visible.EVENT_DEMO_RESUME = "RESUMED_DEMO";
    visible.EVENT_DEMO_START = "STARTED_DEMO";
    visible.EVENT_LIST_ACCEPTED = "ACCEPTED_LIST";
    visible.EVENT_LIST_REJECTED = "REJECTED_LIST";
    visible.EVENT_LIST_UNDECIDED = "UNDECIDED_LIST";
    visible.DATA_DEMO_END_STATE = "DEMO_END_STATE"; // state of dataset + what was accepted - Note: assumes that demo end does not include undecided items
    visible.EVENT_SIGNED_OFF = "SIGNED_OFF"; // user finished demo
    visible.EVENT_STATE_CHANGE = "CHANGED_STATE";
    visible.EVENT_SCROLLED = "SCROLLED"; // user scrolled in some direction
    visible.EVENT_VERSION_CHANGE = "CHANGED_VERSION";
    visible.EVENT_MODIFY_PANEL_START = "MODIFY_PANEL_START";
	visible.EVENT_MODIFY_PANEL_END = "MODIFY_PANEL_END";
    visible.EVENT_COLUMN_ACTION = "COLUMN_ACTION";
    
    visible.init = function() {
        if (utils.getStorageItem(LOG) === null) {
            utils.setStorageItem(LOG, "");
        }
        
        if (utils.getStorageItem(ENTRY_NUMBER) === null) {
            utils.setStorageItem(ENTRY_NUMBER, 0);
        }
    }
    
    visible.log = function(eventType, entry) {
    	if (utils.getStorageItem(LOG) === null) {
            utils.setStorageItem(LOG, "");
        }

        utils.setStorageItem(LOG, utils.getStorageItem(LOG) +
                '[' + entryID() + ']' + "\t" + visible.dateString(new Date()) + "\t" +
                eventType + "\t" + entry + "\n");
    };
    
    visible.dump = function() {
        console.log("-- START LOG DUMP --------------------------------" +
                "\n" + utils.getStorageItem(LOG) +
                "-- END LOG DUMP ----------------------------------" +
                "\n");
    };
    
    visible.dateString = function(date) {
        var year = date.getFullYear();
        var month = date.getMonth() + 1;
        var day = date.getDate();
        var ms = date.getUTCMilliseconds();
        
        month = month < 10 ? "0" + month : month;
        day = day < 10 ? "0" + day : day;
        ms = ms < 10 ? "00" + ms : (ms < 100 ? "0" + ms : ms);
        
        return year + "-" + month + "-" + day + " " +
                date.toLocaleTimeString() + ":" + ms;
    };
    
    /* Given a item's id, return a human-readable string of the item:
     * 	e.g. "temazepam 15 mg PO qHS"
     */
    visible.simpleItemString = function(id) {
    	var item = model.items[id];
        
        var str = item.getNames().recorded;
        
        for (var attributeName in item.attributes) {
            if (model.attributes[attributeName].display) {
                str += " " + item.attributes[attributeName].toString();
            }
        }
        return str;
    }
    
    /* Given a item's id, return a human-readable string of the item,
     *  with information about the source list and whether it is modified
     * 	e.g. "(Hospital) * temazepam 15 mg PO qHS"
     */
    visible.itemString = function(id) {
        var item = model.items[id];
        var list = item.listID === model.list1.id ? model.list1.name :
                model.list2.name;
    	
    	var star = "";
    	if(item.isModified)
    		star = " * "
    	
    	return "(" + list + ") " + star + visible.simpleItemString(id);
    }
    
// hidden ////////////////////////////////////////////////////////////////
    var LOG = "__LOG__";
    var ENTRY_NUMBER = "__ENTRY_NUMBER__";
    
    /* increment and return a log entry number (unique for each log entry) */
    function entryID() {
        var entryNumber = utils.getStorageItem(ENTRY_NUMBER);
        utils.setStorageItem(ENTRY_NUMBER, ++entryNumber);
        
        return entryNumber;
    }

    // expose interface //////////////////////////////////////////////////
    return visible;
}(window.logger = window.logger || {});