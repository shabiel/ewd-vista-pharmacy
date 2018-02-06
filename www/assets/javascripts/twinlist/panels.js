var panels = function(panels, jQuery) {
    var visible = {};
    
////// visible ///////////////////////////////////////////////////////////
    visible.showCenter = function() {
        if ($(".center.panel").hasClass("hide-left")) {
            rotate(RIGHT_TO_CENTER);
        } else if ($(".center.panel").hasClass("hide-right")) {
            rotate(LEFT_TO_CENTER);
        }
    };
    
    visible.showLeft = function() {
        rotate(CENTER_TO_LEFT);
    };
    
    visible.showRight = function(panel) {
        rotate(CENTER_TO_RIGHT, panel);
    };
    
    
////// hidden ////////////////////////////////////////////////////////////
    var CENTER_TO_LEFT = 0;
    var CENTER_TO_RIGHT = 1;
    var LEFT_TO_CENTER = 2;
    var RIGHT_TO_CENTER = 3;
    
    
    function rotate(direction, panel) {
        var panel = panel ? "#" + panel : "";
        
        /*
         * No arbitrary movement, only continuous rotation -- as if the
         * three panels were drawn on the same sheet of paper.
         */
        switch(direction) {
            case CENTER_TO_LEFT:
                $(".right.panel").addClass("hide-right");
                $(".center.panel").addClass("hide-right");
                $(".left.panel").removeClass("hide-left");
                break;
            case LEFT_TO_CENTER:
                $(".right.panel").addClass("hide-right");
                $(".left.panel").addClass("hide-left");
                $(".center.panel").removeClass("hide-left hide-right");
                break;
            case CENTER_TO_RIGHT:
                $(".left.panel").addClass("hide-left");
                $(".center.panel").addClass("hide-left");
                
                // multiple right panels exist
                if (panel) {
                    $(panel).parent(".right.panel")
                            .removeClass("hide-right");
                } else {
                    $(".right.panel").removeClass("hide-right");
                }
                break;
            case RIGHT_TO_CENTER:
                $(".right.panel").addClass("hide-right");
                $(".left.panel").addClass("hide-left");
                $(".center.panel").removeClass("hide-left hide-right");
                break;
        }
    }
    
    
    // expose interface //////////////////////////////////////////////////
    return visible;
}(window.panels = window.panels || {}, $, undefined);
