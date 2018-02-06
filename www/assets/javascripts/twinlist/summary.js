$(function() {
	populatePatientName();
    populateTable("stop");
    populateTable("start");
    populateTable("continue");
    
    $("#btn_close").click(function () {
    	window.close();
    });
});

function populatePatientName() {
	var name = utils.getStorageItem("patient_name");
	$("#patient_name").html(name);
}

function populateTable(name) {
    var list = utils.getStorageItem(name);
    
    if (list.length > 0) {
        var $data = $("#data");
        var $header = $("<h3>Please " + name + " taking </h3>");
        var $table = $("<table></table>");
        $table.attr("id", name);
        
        var medications = list.split("\n");
        
        var modifiedStr;
        
        for (var i = 0; i < medications.length; i++) {        	
            var $tr = $("<tr></tr>");
            modifiedStr = "";
            
            var attributes = medications[i].split("\t");
            
            for (var j = 1; j < attributes.length; j++) {
            	// j=0 contains info on which list it is from
            	if(attributes[j] == "undefined") // from session storage, so is just the string
            		attributes[j] = "";
                if(attributes[j].indexOf("*") == 0) {
                	// Note: modified items have a name that start with *
                	modifiedStr = "modified";
                }
                
                $tr.append("<td>" + attributes[j] + "</td>");
                
            }
            $tr.append("<td><textarea name='instructions' rows='1' placeholder='no notes'>" +
            	modifiedStr + 
            	"</textarea></td>");
            $table.append($tr);
        }
        $data.append($header);
        $data.append($table);
    }
}
