$(function() {
	// intended to be saved as "webpage complete", only update if unitialized
	// this will make it keep the time the log summary was generated
	if($("#time").text() == "time") {
		$("#time").html(new Date().toLocaleString());
	    populateTable();
	}
});

function populateTable() {

	// get raw string and split by newlines
    var list = utils.getStorageItem("__LOG__").split("\n");
	var sessionTrials = [];
	
	// parse each line
	var sessionData = undefined;
    for(var i = 0; i < list.length; i++) {
    	var trialData;
    	var rawString = list[i].trim();
    	console.log("rs: " + rawString);// TODO remove
    	
    	var matches = rawString.split("\t");
    	if(matches.length >= 3) {
    		var index = matches[0];
    		var timestamp = matches[1];
    		var eventType = matches[2];
    		var args = matches[3];
    		
    		// TODO remove
    		
    		console.log("\t" + timestamp);
    		console.log("\t" + eventType);
    		console.log("\t" + args);
    		
    		if(!sessionData) {
    			switch(eventType) {
	    			case logger.EVENT_DEMO_START:
	    				sessionData = new TrialSummary(toMilliseconds(timestamp), args);
	    				break;
    			}
    		} else {
	    		switch(eventType) {
	    			case logger.EVENT_DEMO_START:
	    				sessionData = new TrialSummary(toMilliseconds(timestamp), args);
	    				break;
					case logger.EVENT_STATE_CHANGE:
						sessionData.processTransition(args);
						break;
					case logger.EVENT_LIST_ACCEPTED:
						sessionData.processList(LIST_TYPE_ACCEPTED, args);
						break
					case logger.EVENT_LIST_REJECTED:
						sessionData.processList(LIST_TYPE_REJECTED, args);
						break
					case logger.EVENT_SIGNED_OFF:
						sessionData.endTrial(toMilliseconds(timestamp));
						sessionTrials.push(sessionData);
	    				break;
					case logger.EVENT_MODIFY_PANEL_START:
						sessionData.startModify(toMilliseconds(timestamp));
	    				break;
					case logger.EVENT_DEMO_RESUME:	// this only occurs when going from modify panel back
	    				sessionData.endModify(toMilliseconds(timestamp));
	    				break;
					case logger.EVENT_CLICKED:
						sessionData.numClicks++;
						break;
					case logger.EVENT_SCROLLED:
						sessionData.numScrolls++;
						break;
					case logger.DATA_DEMO_END_STATE:
						sessionData.saveEndState(args);
						break;
	    		}
    		}
    	}
    	
    }
    
    // append data to table
    var $table = $("#summary_table");
    
    // append headings
    var $tr = $("<tr></tr>");
    $tr.append("<td>row</td>");
    $tr.append("<td>dataset</td>");
    $tr.append("<td>version</td>");
    $tr.append("<td>total<br/>time<br/>(s)</td>");
    $tr.append("<td>transition<br/>time<br/>(s)</td>");
    $tr.append("<td>modify<br/>time<br/>(s)</td>");
    $tr.append("<td>adjusted<br/>time<br/>(s)</td>");
    $tr.append("<td>num<br/>clicks</td>")
    $tr.append("<td>num<br/>scrolls</td>")
    $tr.append("<td>intake<br/>list</td>");
    $tr.append("<td>hospital<br/>list</td>");
    $tr.append("<td>end<br/>state</td>");
    $table.append($tr);

    var $csv = $("#csv");
    $csv.append("dataset,version,total time (ms), transition time (ms), modify time (ms), adjusted time (ms), num clicks<br/>");
    

    for(var i = 0; i < sessionTrials.length; i++) {
    	trialData = sessionTrials[i];
    	var $tr = $("<tr></tr>");
    	$tr.append("<td>" + i + "</td>");
	    $tr.append("<td>" + trialData.dataset + "</td>");
	    $tr.append("<td>" + trialData.version + "</td>");
	    $tr.append("<td>" + Math.round((trialData.rawTrialDuration / 1000) * 10) / 10 + "</td>");
	    $tr.append("<td>" + Math.round((trialData.transitionTime / 1000) * 10) / 10 + "</td>");
	    $tr.append("<td>" + Math.round((trialData.modifyTime / 1000) * 10) / 10 + "</td>");
	    $tr.append("<td>" + Math.round((trialData.trueTrialDuration / 1000) * 10) / 10 + "</td>");
	    $tr.append("<td>" + trialData.numClicks + "</td>");
	    $tr.append("<td>" + trialData.numScrolls + "</td>");
	    $tr.append("<td>" + htmlify(trialData.intakeList) + "</td>");
	    $tr.append("<td>" + htmlify(trialData.hospitalList) + "</td>");
	    
	    // just put the data import string into the table, will likely cause horizontal scrolling
	    var $td = $("<td>" + sessionTrials[i].dataset + "," + 
				sessionTrials[i].endData + "</td>");
	    $tr.append($td);
	    
	    $table.append($tr);
	    
	    // add to csv part too
	    $csv.append(trialData.dataset + ",");
	    $csv.append(trialData.version + ",");
	    $csv.append(trialData.rawTrialDuration + ",");
	    $csv.append(trialData.transitionTime + ",");
	    $csv.append(trialData.modifyTime + ",");
	    $csv.append(trialData.trueTrialDuration + ",");
	    $csv.append(trialData.numClicks + "<br/>");
    }
    
    // append raw log (in case)
    var $raw_log = $("#raw_log");
    for(var i = 0; i < list.length; i++) {
    	var rawString = list[i].trim();
    	$raw_log.append(rawString + "<br>");
    }
}


/*
 * Given an array, return a string that is the array with <br/>s after each element
 */
function htmlify(raw_arr) {
	var retStr = "";
	var arr = raw_arr.sort(sortSpanStrings); // will sort by name
	for(var i = 0; i < arr.length; i++)
		retStr = retStr + arr[i] + "<br/><br/>";
	return retStr;
}

// sort strings that have been prefixed by "<span class='keep'>"
//  and "<span class='reject'>"
function sortSpanStrings(a, b) {
	var s1 = a.substring(a.indexOf('>'));
	var s2 = b.substring(b.indexOf('>'));
	
	var ret;
	if(s1 < s2)
		ret = -1;
	else if(s1 > s2)
		ret = 1;
	else
		ret = 0;
	return ret;
}

function toMilliseconds(timestamp) {
    var times = timestamp.split(" ");
    var time;

    if(times.length == 2) {
        time = times[1].split(":");
    } else if (times.length == 3) {
        time = times[1].split(":");
        time[3] = times[2].split(":")[1];
    }
    var millis = 0;
    millis = millis + (parseInt(time[0]) * 3600000);
    millis = millis + (parseInt(time[1]) * 60000);
    millis = millis + (parseInt(time[2]) * 1000);
    millis = millis + (parseInt(time[3]) * 1);
    
    return millis; 
}

var LIST_TYPE_ACCEPTED = "__ACCEPTED_LIST__";
var LIST_TYPE_REJECTED = "__REJECTED_LIST__";


function TrialSummary(startTime, args) {
	
	// initialize
	// args is something like: dataset:__DATASET_APPENDECTOMY__,version:__VERSION_FULL__
	var splitArgs = args.split(",");
	
    var visible = {};
    
    visible.startTime = startTime;
    var endTime;
    visible.rawTrialDuration = 0;
    visible.trueTrialDuration = 0;
    
    visible.dataset = splitArgs[0].split(":")[1];
    visible.version = splitArgs[1].split(":")[1];
    
    visible.transitionTime = 0;
    visible.modifyTime = 0;
    
    var acceptedList = [];
    var rejectedList = [];
    
    visible.intakeList = [];
    visible.hospitalList = [];
    // no undecided allowed
    
    visible.numClicks = 0;
    visible.numScrolls = 0;
    
    var modifyStart = 0; // internal variable to process modify time
    
    // importable information about the end state of the demo
    visible.endData = "";
    
    // given the arguments for EVENT_STATE_CHANGE, extract duration and add to transition time
    visible.processTransition = function(args) {
    	// process something like: start:separate,end:compact,duration(ms):7800
    	//console.log(args);
    	//console.log(visible.startTime);
    	//console.log(visible.dataset);
    	//console.log(visible.version);
    	var duration = args.split(",")[2];
    	var durationValue = parseInt(duration.split(":")[1]);
    	visible.transitionTime = visible.transitionTime + durationValue; 
    };
    
    visible.startModify = function(timestamp) {
    	modifyStart = timestamp;
    }
    
    visible.endModify = function(endTimestamp) {
    	if(modifyStart != 0) {
	    	var modifyDuration = endTimestamp - modifyStart;
	    	visible.modifyTime = visible.modifyTime + modifyDuration;
	    	modifyStart = 0;
    	} 
    }
    
    visible.processList = function(type, data) {
        if(data == undefined) {
            return;
        }
		var $spanStart = "";
		var list = [];
    	switch(type) {
    		case LIST_TYPE_ACCEPTED:
    			list = data.split(",");
    			$spanStart = "<span class='keep'>";
    			break;
			case LIST_TYPE_REJECTED:
				list = data.split(",");
				$spanStart = "<span class='reject'>";
				break;
    		
    	}
    	
    	var $spanStr;
    	for(var i = 0; i < list.length; i++ ) {
    		if(list[i].indexOf("(Intake)") == 0)
    			visible.intakeList.push($spanStart + list[i].substring(9) + "</span>");
			else
				visible.hospitalList.push($spanStart + list[i].substring(11) + "</span>");
    	}
    };
    
    visible.endTrial = function(timestamp) {
    	endTime = timestamp
    	visible.rawTrialDuration = endTime - startTime;
    	console.log("st: " + startTime + " , eT: " + endTime + " rDur: " + visible.rawTrialDuration);
    	visible.trueTrialDuration = visible.rawTrialDuration - (visible.transitionTime + visible.modifyTime);
    	
    	console.log("tt: " + visible.trueTrialDuration);
    	console.log("dataset: " + visible.dataset);
    	console.log("version: " + visible.version);
    	console.log("transt: " + visible.transitionTime);
    	console.log("modt: " + visible.modifyTime);
    	console.log("accL: " + visible.acceptedList);
    	console.log("rejL: " + visible.rejectedList);
    }
    
    visible.saveEndState = function(data_dump_string) {
		visible.endData = data_dump_string;
    }
    
    return visible;
}
