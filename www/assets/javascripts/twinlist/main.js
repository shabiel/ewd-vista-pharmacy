
$(function() {
    
    // set up handler for clicking to the demo
    // open a new tab with particular url
    $(".to_demo").click(function() {
        
        var dataset = $("select[name='dataset']").val();
        var version = $("select[name='version']").val();
        var animate = $("select[name='autoAnimate']").val();
        
        window.open("index.html?case=" + dataset + "&version=" + version + "&animate=" + animate);
    });
    
    $("select[name='version']").change(function() {
        if ($(this).val() === "__VERSION_FULL__") {
            $("select[name='autoAnimate']").prop('disabled', false);
        } else {
            $("select[name='autoAnimate']").prop('disabled', true);
        }
    });
    
    logger.init();
    
    $(window).unbind("keydown")// for some reason, multiple keydowns firing, remove previous ones
        .keydown(function(event) {
            switch (event.which) {
                case 76:
                    // the 'l' key
                    logger.dump();
                    window.open("log_summary.html");
                    break;
            }
        });
});

