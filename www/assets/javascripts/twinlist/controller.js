// TODO: populate DOM with HTML strings for speed (less readable, though)

var controller = function(controller, jQuery) {
    
    ////// hidden ////////////////////////////////////////////////////////////

    // pseudo constants //////////////////////////////////////////////////
    var LIST_1_UNIQUE_INDEX = 0;
    var LIST_1_INDEX = 1;
    var LIST_IDENTICAL_INDEX = 2;
    var LIST_2_INDEX = 3;
    var LIST_2_UNIQUE_INDEX = 4;

    /*
     * Keeps track of, for each state, how many rows are needed
     * Used to generate striped backdrop
     *  (necessary for item animation since top/left based on generated row heights)
     * populated in calculatePositions
     */
    var NUM_ROWS = {};

    var NUM_COLUMNS = 5;

    var STATE_SEPARATE = 0;
    var STATE_IDENTICAL = 1;
    var STATE_UNIQUE = 2;
    var STATE_SIMILAR = 3;
    var STATE_COMPACT = 4;
    var NUM_STATES = 5;

    var BASE_ANIMATION_DURATION = 800;
    var PANEL_DELAY = BASE_ANIMATION_DURATION * 2;
    var ANIMATION_SPEED_0 = "__ANIMATION_SPEED_0__";
    var ANIMATION_SPEED_1 = "__ANIMATION_SPEED_1__";
    var ANIMATION_SPEED_2 = "__ANIMATION_SPEED_2__";
    var ANIMATION_SPEED_3 = "__ANIMATION_SPEED_3__";
    var ANIMATION_SPEED_4 = "__ANIMATION_SPEED_4__";
    var ANIMATION_SPEED_5 = "__ANIMATION_SPEED_5__";
    var ANIMATION_SPEED_COEFFICIENTS = [0, 1.5, 1.25, 1, 0.75, 0.5];
    var CUSTOM_EASE_IN = "cubic-bezier(0.4, 0.2, 0.1, 0.9)";

    // config - version
    var VERSION_FULL = "__VERSION_FULL__";
    var VERSION_BASELINE = "__VERSION_BASELINE__";
    var VERSION_LINK_ONLY = "__VERSION_LINK_ONLY__";
    var VERSION_THREE_COLUMN = "__VERSION_THREE_COLUMN__";
    var VERSION_3COL_CLASSES = "__VERSION_3COL_CLASSES__";

    // config - animation
    var AUTO_ANIMATE_ON = "__AUTO_ANIMATE_ON__";
    var AUTO_ANIMATE_OFF = "__AUTO_ANIMATE_OFF__";
    var AUTO_ANIMATE_END = "__AUTO_ANIMATE_END__";

    var WHITE = "#fafafa";
    var NEUTRAL_GRAY = "#f0f0f0";
    var CONTRAST_GRAY = "#d9d6d0";


    ////// visible ///////////////////////////////////////////////////////////
    var visible = {};

    // animation speed ///////////////////////////////////////////////////
    visible.animationSpeed = 0;
    visible.animationDuration = 0;
    visible.animationDelay = 0;
    visible.toggleOnDelay = 0;
    visible.toggleOffDelay = 0;

    // state /////////////////////////////////////////////////////////////
    visible.editID = 0;
    
    visible.versionDefault = VERSION_FULL;
    visible.autoAnimateDefault = AUTO_ANIMATE_ON;

    var version = VERSION_FULL;
    var autoAnimate = AUTO_ANIMATE_ON;
    
    // whether the mousedown is because of touch
    var touchEvent = false;
    // last item that was touched (not clicked)
    var $lastTouchedItem;
    
    // methods ///////////////////////////////////////////////////////////
    // initialize data to display and populate interface
    // assumed model has already been initialized
    // dontRedraw indicates not to do a redraw (default is undefined)
    // version - version of interface to initialize
    // animate - whether to animate automatically, on compare lists, or jump to compact
    visible.init = function(dontRedraw, interfaceVersion, animate) {
                
        // TODO might need string translation?
        version = interfaceVersion;
        autoAnimate = animate;
    
        logger.log(logger.EVENT_DEMO_START, "dataset:" + model.getDatasetShortName(model.dataset) + ",version:" + getVersionShortName(version));
        
        if (version === VERSION_LINK_ONLY) {
            updateGroupBy("__ATTR_DRUG_CLASS__", true);
        } else {
            updateGroupBy("", true);
        }        
        
        // fetch data to display
        viewData = model.viewData(true, true);

        // prepare interface
        prepareDOM();
        // prepare backdrop and interface (e.g. create items)
        prepareTransitions();
        // calculate item position information and animation delay time
        prepareHandlers();
        resetLinkActionFlags();

        // put everything in place
        
        // TODO refactor - initialize number of times "decided" to 0
        utils.setStorageItem("decided", 0);

        // TODO hack (should be a supported by populate code)
        // show diagnoses column
        if (version === VERSION_THREE_COLUMN || version === VERSION_3COL_CLASSES)
            $(".backdrop th:nth-child(1) .col-header").show();
            
        // set up auto animation
        if (autoAnimate === AUTO_ANIMATE_ON) {
            setTimeout(function() {
                if (version === VERSION_FULL) {
                    changeState(STATE_COMPACT);
                }
            }, PANEL_DELAY);
        } else if (autoAnimate === AUTO_ANIMATE_END) {
            setTimeout(function() {
                if (version === VERSION_FULL) {
                    setAnimationSpeed(ANIMATION_SPEED_0);
                    changeState(STATE_COMPACT, true);
                }
            }, 0);
        }
        redraw(true, true, false, true);

    };

    visible.toggleItem = function($item, delay, show) {
        if (show) {
            if (model.hidden[$item.attr("id")] === undefined) {
                $item.show();

                if (!displayDetails) {
                    $item.children(".detail").fadeOut();
                }

                setTimeout(function() {
                    if ($item.hasClass("shadow"))
                        $item.css("opacity", "0.6");
                    else
                        $item.css("opacity", "1");

                    // some item was hidden or shown, update review button
                    updateReviewButton();
                }, delay);
            }
        } else {
            setTimeout(function() {
                $item.css("opacity", 0);

                setTimeout(function() {
                    $item.hide();
                    $item.removeClass("undecided-hover item-hover");
                    // TODO this will not appear real-time because identical items are not immediately hidden when merged
                    // some item was hidden or shown, update review button
                    updateReviewButton();
                }, delay);
            }, delay);
        }
    };



    // internal state ////////////////////////////////////////////////////

    /*
     * viewData:
     * Information about what to display. Populated in model.viewData and
     * in calculatePositions. Consists of:
     *
     *      // for each group, the ids (including shadows) in that group
     *      groups: {
     *          <group1name>: [id, id, ...],
     *          <group2name>: [id, id, ...],
     *          <group3name>: [id, id, ...],
     *          ...
     *      },
     *
     *      // keys to the groups array (in the order they should be accessed)
     *      groupRank: [<group1name>, <group2name>, ...],
     *
     *      groupLengths: {
     *          <group1>: {
     *              // within this group, id -> identical items
     *              // Note: is (one-way, i.e. if id1 identical to id2, only
     *              //  one entry: {id1: [id1, id2]} present)
     *              identicalMarker: {
     *                  <id1>: [<id1>, <identicalIds...>],
     *                  ...
     *              },
     *
     *              // within this group, for each state, the height of each row
     *              // e.g. [1,2,1] means first set takes 1 row, next (maybe a
     *              //  similar set) takes 2, last takes 1.
     *              //  populated in calculatePositions, used for row coloring
     *              rowSetLen: {
     *                  <STATE>: [<set1length>, <set2length>, ...],
     *                  ...
     *              },
     *
     *              // for each state, what row this group starts on
     *              // populated in calculatePositions
     *              startRow: {
     *                  <STATE>: <start row for STATE>,
     *                  ...
     *              },
     *
     *              // within this group, the ids (including shadows) that are
     *              // unique1 at the end. Used to help figure out the size of
     *              // the background block coloring in STATE_COMPACT as well as
     *              // for column actions
     *              unique1: [id, id, ...],
     *
     *              // same as above, but for unique2
     *              unique2: [id, id, ...]
     *          },  // end of <group1>
     *          ...
     *      } // end of groupLengths
     *
     *      // function that retrieves all ids as a single list (in rank order)
     *      getAll()
     */
    var viewData = {};

    var hoverSet = {};
    
    // diagnoses that are being hovered (due to mouseover an item)
    var hoverDiagnosisSet = [];


    var groups = [];

    var state = STATE_SEPARATE;

    var showPatientTab = false;

    /*
     * Stores item locations for different states - used during animateItem
     * e.g. positions[id][state] -> {
     *     'row': <row of "id" in "STATE">,
     *     'col': <column of "id" in "STATE">}
     */
    var positions = {};

    var linkAction = {};

    var displayDetails = true;
    
    // for debugging - whether to print item information on hover
    var printHover = false;

    // initialization ////////////////////////////////////////////////////
    function resetState() {
        state = STATE_SEPARATE;
        viewData = {};
        hoverSet = {};

        groups = [];

        positions = {};

        linkAction = {};
    }

    function changeDataset(dataset) {
        model.init(dataset);
        resetState();
        visible.init();

        logger.log(logger.EVENT_DATASET_CHANGE, dataset);
    }

    function prepareDOM() {
    	// remove jquery mobile loading div...
    	$(".ui-loader").remove();
    	
        // clear
        $(".backdrop thead").remove();
        $(".backdrop tbody").remove();
        $("#app .item").remove();
        $("#app .diagnosis").remove();
        // TODO rename - includes drug class items right now

        // create actual objects
        populateBackdrop($(".backdrop-header"), $(".backdrop-body"));
        populateItems($(".items"));

        // TODO refactor? Diagnoses -> Control column?
        if (version === VERSION_THREE_COLUMN) {
            populateThirdAnchorColumn($(".diagnoses"), model.diagnoses);
        } else if (version === VERSION_3COL_CLASSES) {
            populateThirdAnchorColumn($(".drug_classes"), model.drugClasses);
        }
        // TODO: faster / neater to wrap all shadows in a separate div?

        // start shadowing
        $(".shadow").hide();

        // hide unused column headers; avoid unexpected behavior
        $(".backdrop th:nth-child(odd) .col-header").hide();

        $(".conditional").hide();

        // TODO might be removed
        // indicate current config
        $("select[name='dataset']").val(model.dataset);
        $("#app .annotation").text("[ case : " + model.dataset.toLowerCase().replace(/_/g, " ").replace(/dataset/, "").trim() + " ]");
        $("select[name='version']").val(version);
        $("select[name='autoAnimate']").val(autoAnimate);
        $("select[name='speed']").val(visible.animationSpeed);

        // initialize the number of drugs to act on
        updateReviewButton();

    }

    // prepare information necessary for state transitions
    function prepareTransitions() {
        // prepare positions data structure
        calculatePositions();

        // prepare animation speed
        setAnimationSpeed(ANIMATION_SPEED_3);
    }

    function prepareHandlers() {
        // clear
        // OSE/SMH: This is a problem. Unbinds everything. Wonder if can disable
        // that?
        $("*").not(".backdrop *").off();

        // item action
        $("#app .item").mousedown(mousedownHandler).mouseover(mouseoverHandler).mouseout(mouseoutHandler).bind("contextmenu", function() {
            // free right click for item action
            return false;
        });

		// touch-controls
		$("#app .item").on(
			{
			    // left swipe = left click
				"swipeleft": function(ev) {
				    // mouse out to disable touchstart's hover mimicking
				    $(this).mouseout();
					itemChange($(this), this.id, "left");
				},
				
				// right swipe = right click
				"swiperight": function(ev) {
				    $(this).mouseout();
					itemChange($(this), this.id, "right");
				},
			}
		);
		
		// touch start mimics hover for items
		$("#app .item").bind("touchstart", function(ev) {
		    touchEvent = true;
		    $(this).mouseover();
		    $lastTouchedItem = $(this);
		});
		
		// touch start mimics hover for diagnoses / drug class anchors
		$("#app .diagnosis").bind("touchstart", function(ev) {
            touchEvent = true;
            $(this).mouseover();
            $lastTouchedItem = $(this);
        });

        // if body of page is touched, undo hover of last item		
		$("body").bind("touchstart", function(ev) {
            $lastTouchedItem.mouseout();
        });
		
		// Prevent rubber-banding of the body, but allow for scrolling elements
        $('body').on('touchmove', function (e) {
            var searchTerms = '.scroll, .scroll-y, .scroll-x',
                $target = $(e.target),
                parents = $target.parents(searchTerms);
        
            if (parents.length || $target.hasClass(searchTerms)) {
                // ignore as we want the scroll to happen
                // (This is where we may need to check if at limit)
            } else {
                e.preventDefault();
            }
        });

        // diagnosis mouseover
        if (version === VERSION_THREE_COLUMN) {
            $("#app .diagnosis").mouseover(function() {
                // highlight diagnosis and items for this diagnosis

                var id = this.id;
                var diagnosis = model.diagnoses[id];

                $(this).addClass("third-col-anchor-hover");

                // de-emphasize all items - Note: needs to be changed if allowing multigrouping...
                $(".item").css("opacity", "0.0");

                // hover appropriate item(s) - TODO: does not support with shadows
                var toHover = model.diagnosisSet[id];
                for (var i = 0; i < toHover.length; i++) {
                    var hoverID = toHover[i];
                    diagnosisHoverItem(hoverID, true, false);
                }
                
                hoverScrolltips(id, true);

            }).mouseout(function() {
                var id = this.id;
                var diagnosis = model.diagnoses[id];

                $(this).removeClass("third-col-anchor-hover");

                // revert de-emphasization
                $(".item").css("opacity", "1.0");

                // hover appropriate item(s) - TODO: does not support with shadows
                var toHover = model.diagnosisSet[id];
                for (var i = 0; i < toHover.length; i++) {
                    var hoverID = toHover[i];
                    diagnosisHoverItem(hoverID, false, false);
                }

                hoverScrolltips(id, false);
            });
        }

        // TODO should refactor...
        // drug class mouseover
        if (version === VERSION_3COL_CLASSES) {
            $("#app .diagnosis").mouseover(function() {
                // highlight diagnosis and items for this diagnosis

                var id = this.id;
                var drugClass = model.drugClasses[id];

                $(this).addClass("third-col-anchor-hover");
                
                // de-emphasize all items - Note: needs to be changed if allowing multigrouping...
                $(".item").css("opacity", "0.0");


                // hover appropriate item(s) - TODO: does not support with shadows
                var toHover = model.drugClassSet[id];
                for (var i = 0; i < toHover.length; i++) {
                    var hoverID = toHover[i];
                    diagnosisHoverItem(hoverID, true, false);
                }

                // TODO
                hoverScrolltips(id, true);

            }).mouseout(function() {
                var id = this.id;
                var drugClass = model.drugClasses[id];

                $(this).removeClass("third-col-anchor-hover");
                
                // revert de-emphasization
                $(".item").css("opacity", "1.0");

                // hover appropriate item(s) - TODO: does not support with shadows
                var toHover = model.drugClassSet[id];
                for (var i = 0; i < toHover.length; i++) {
                    var hoverID = toHover[i];
                    diagnosisHoverItem(hoverID, false, false);
                }

                hoverScrolltips(id, false);
            });
        }
        // basic controls
        $(".compare").click(function() {
            if (version === VERSION_FULL) {
                logger.log(logger.EVENT_CLICKED, "compare");
                // TODO use button constants?
            }
            
            if(!$(this).hasClass("inactive")) {
            	changeState(STATE_COMPACT);
            	$(".compare").addClass("inactive");
            }
        });

        $(".review").click(function() {
            
            logger.log(logger.EVENT_CLICKED, "sign off");

            // save decisions
            var accepted = [];
            var rejected = [];
            var undecided = [];
            var acceptedIds = [];

            acceptedIds.push(state);
            for (var i = 0; i < model.accepted.length; i++) {
                accepted.push(logger.itemString(model.accepted[i]));
                acceptedIds.push(model.accepted[i]);
            }

            for (var i = 0; i < model.rejected.length; i++) {
                rejected.push(logger.itemString(model.rejected[i]));
            }

            for (var i = 0; i < model.undecided.length; i++) {
                undecided.push(logger.itemString(model.undecided[i]));
            }

            // dump current item decisions (accepted, rejected, undecided)
            logger.log(logger.EVENT_LIST_ACCEPTED, accepted);
            logger.log(logger.EVENT_LIST_REJECTED, rejected);
            logger.log(logger.EVENT_LIST_UNDECIDED, undecided);
            logger.log(logger.DATA_DEMO_END_STATE, acceptedIds);

            // if still items to review - show popup
            if (calculateNumRemaining() > 0) {
                //TODO make 2s popup
                alert("Still " + calculateNumRemaining() + " drugs to act upon before signing off");
            } else {
                logger.log(logger.EVENT_SIGNED_OFF, "");
                // return to initial panel
                setTimeout(function() {
                    // prepare patient summary
                    if (showPatientTab) {
                        saveItemActions();
                        window.open("summary.html");
                    }
                    
                    window.open('','_self','');
                    window.close();
                }, PANEL_DELAY / 2);
                // TODO consider delay time
                // TODO consider feedback saying the lists were saved
            }

        });
        // end of $(".review").click

        $(".retry").click(function() {
            logger.log(logger.EVENT_CLICKED, "reset");
            $(".compare").removeClass("inactive");
            resetDecisions();
            
            redraw(true, true);
        });

        // options panel
        $(".options").click(function() {
            logger.log(logger.EVENT_CLICKED, "options");

            toggleOptionsPanel($(this), true);
        });

        // when clicked, cycles the current groupby layout used
        $(".cycle_groupby").click(function() {
            logger.log(logger.EVENT_CLICKED, "cycle_groupby");
            updateGroupBy($(this).attr("value"));
        });
        
        // help modal
        $(".help-modal").css("top", $("header").height());

        $(".help").click(function() {
            logger.log(logger.EVENT_CLICKED, "help");
            $(".help-modal").addClass("show");
        });

        $(".help-close").click(function() {
            logger.log(logger.EVENT_CLICKED, "help_close");
            $(".help-modal .welcome").remove();
            $(".help-modal").removeClass("show");
        });

        // alert modal
        $("#alert-close").click(function() {
            logger.log(logger.EVENT_CLICKED, "alert_close");
            $(".alert-modal").removeClass("show");
        });
        
        // options
        $("select[name='groupBy']").change(function() {
            updateGroupBy($(this).attr("value"));
        });

        $("input[name='multigroup']").click(function() {
            logger.log(logger.EVENT_CLICKED, "multigroup");

            model.multigroup = this.checked;

            // trigger layout change - redraw(true, true) handled in here too
            $("select[name='groupBy']").change();
        });

        $("input[name='patient_tab']").click(function() {
            logger.log(logger.EVENT_CLICKED, "patient_tab");
            showPatientTab = this.checked;
        });

        $("select[name='speed']").change(function() {
            setAnimationSpeed($(this).val());
        });

        $("input[name='filterOn']").keyup(function() {
            model.filterOn = $(this).val();
            redraw(true, true);
        });

        $(".separate").click(function() {
            logger.log(logger.EVENT_CLICKED, "separate");
            changeState(STATE_SEPARATE);
        });

        $(".identical").click(function() {
            logger.log(logger.EVENT_CLICKED, "identical");
            if (!$(this).hasClass("inactive")) {
                changeState(STATE_IDENTICAL);
            }
        });

        $(".unique").click(function() {
            logger.log(logger.EVENT_CLICKED, "unique");
            if (!$(this).hasClass("inactive")) {
                changeState(STATE_UNIQUE);
            }
        });

        $(".similar").click(function() {
            logger.log(logger.EVENT_CLICKED, "similar");
            changeState(STATE_SIMILAR);
        });

        $(".compact").click(function() {
            logger.log(logger.EVENT_CLICKED, "compact");
            changeState(STATE_COMPACT);
        });

        $(".grayout").click(function() {
            logger.log(logger.EVENT_CLICKED, "grayout");
            if (!$(this).hasClass("active")) {
                $(".remove").removeClass("active");
                $(this).addClass("active");

                model.afterAction = model.AFTER_ACTION_GRAYOUT;
                redraw(true, true);
            }
        });

        $(".remove").click(function() {
            logger.log(logger.EVENT_CLICKED, "remove");
            if (!$(this).hasClass("active")) {
                $(".grayout").removeClass("active");
                $(this).addClass("active");

                model.afterAction = model.AFTER_ACTION_REMOVE;
                redraw(true, true);
            }
        });

        $("select[name='displayName']").change(function() {
            model.displayName = $(this).val();

            $("#app .item").each(function() {
                var id = this.id;

                $("#" + id + " .name").fadeOut("fast").text(model.items[id].name).fadeIn("fast");
            });
            redraw(true, true);
        });

        $("input[name='displayDetails']").click(function() {
            logger.log(logger.EVENT_CLICKED, "displayDetails");
            displayDetails = this.checked;
            redraw(true, true);
        });

        // item modification modal dialog
        $(".modify-modal").css("top", $("header").height());
        
        $(".add").click(function() {
            logger.log(logger.EVENT_CLICKED, "add");
            resetModifyPanel("add");
            $(".modify-modal").addClass("show");
        });

        $(".edit").click(function() {
            logger.log(logger.EVENT_CLICKED, "edit");
            resetModifyPanel("edit");
            $(".modify-modal").addClass("show");
        });

        // preview
        $("input, textarea").keyup(function() {
            updatePreview($(this));
        });

        // modify panel
        $("#modify .save").click(function() {
            logger.log(logger.EVENT_CLICKED, "save_modified");
            saveModifiedItem($("#modify h1").text());
            // $("#modify .response").addClass("show");
            $("#modify .close").click();
        });
        
        $("#modify .close").click(function() {
            $(".modify-modal").removeClass("show");
        });

        // hidden controls (shortcuts)
        // OSE/SMH - Another problem
        $(window).unbind("keydown")// for some reason, multiple keydowns firing, remove previous ones
        .keydown(function(event) {

            if (!$("input[name='filterOn']").is(':focus') &&
                !$("input[name='name']").is(':focus') &&
                !$("input[name='dose']").is(':focus') &&
                !$("input[name='route']").is(':focus') &&
                !$("input[name='frequency']").is(':focus') &&
                !$("textarea[name='instructions']").is(':focus')) {
                switch (event.which) {
                    case 48:
                        // the '0' key
                        setAnimationSpeed(ANIMATION_SPEED_0);
                        break;
                    case 49:
                        // the '1' key
                        setAnimationSpeed(ANIMATION_SPEED_1);
                        break;
                    case 50:
                        // the '2' key
                        setAnimationSpeed(ANIMATION_SPEED_2);
                        break;
                    case 51:
                        // the '3' key
                        setAnimationSpeed(ANIMATION_SPEED_3);
                        break;
                    case 52:
                        // the '4' key
                        setAnimationSpeed(ANIMATION_SPEED_4);
                        break;
                    case 53:
                        // the '5' key
                        setAnimationSpeed(ANIMATION_SPEED_5);
                        break;
                    case 67:
                        // the 'c' key
                        updateGroupBy("__ATTR_DRUG_CLASS__");
                        break;
                    case 76:
                        // the 'l' key
                        logger.dump();
                        window.open("log_summary.html");
                        break;
                    case 77:
                        // the 'm' key
                        // toggle multigroup

                        // toggle controls
                        if ($("#chk_mg").attr("checked")) {
                            $("#chk_mg").attr('checked', false);
                        } else {
                            $("#chk_mg").attr('checked', true);
                        }
                        
                        // update model
                        model.multigroup = $("#chk_mg").attr("checked");
                        
                        // trigger layout change
                        redraw(true, true);

                        break;
                    case 78:
                        // the 'n' key
                        // group by none
                        updateGroupBy("");
                        break;
                    case 79:
                        // the 'o' key
                        // toggle options panel
                        $(".options").click();
                        break;
                    case 68:
                        // the 'd' key
                        // group by drug class
                        updateGroupBy("__ATTR_DIAGNOSES__");
                        break;
                    case 82:
                        // the 'r' key
                        // group by route
                        updateGroupBy("__ATTR_ROUTE__");
                        break;

                    case 88:
                        // 'x' key - for debugging
                        console.log("state: " + state);
                        console.log(viewData);
                        console.log(positions);
                        console.log(NUM_ROWS);
                        console.log(model);
                        break;
                        
                    case 89:
                        // the 'y' key - for debugging
                        // toggle printing item + id to console
                        printHover = !printHover;

                }
            }
        });

        // count scrolls
        var lastScrollTop = 0;
        $(".scrolling_content").unbind("scroll").bind('scroll', function() {

            var st = $(this).scrollTop();
            if (st > lastScrollTop) {
                // downscroll code
                logger.log(logger.EVENT_SCROLLED, "down");
            } else {
                // upscroll code
                logger.log(logger.EVENT_SCROLLED, "up");
            }
            lastScrollTop = st;
        });

        // resize with window
        $(window).resize(function() {
            setTimeout(function() {
                redraw(true, true, true);
            }, 0);
        });
    }

    /*
     * Populate the backdrop of the display
     *
     * Postconditions:
     *      Column headers are created (and added to $container_header)
     *      tbody added to $container
     */
    function populateBackdrop($container_header, $container) {
        var $thead = $("<thead id='bg-thead'></thead>");

        $thead.attr("class", "bg-accent");

        var $tr = $("<tr></tr>");

        for (var i = 0; i < NUM_COLUMNS; i++) {
            var $th = $("<th></th>");
            var $header = $("<div></div>");
            var $name = $("<div></div>");

            // column name
            switch (i) {
                case LIST_1_UNIQUE_INDEX:
                    if (version === VERSION_THREE_COLUMN)
                        $name.text("Diagnoses");
                    else if (version === VERSION_3COL_CLASSES)
                        $name.text("Drug Classes")
                    else
                        $name.text(model.list1.name + " unique");
                    break;
                case LIST_1_INDEX:
                    $name.text(model.list1.name).append("<span class='conditional'> similar" + "</span>");
                    break;
                case LIST_IDENTICAL_INDEX:
                    $name.text("Identical");
                    break;
                case LIST_2_INDEX:
                    $name.text(model.list2.name).append("<span class='conditional'> similar" + "</span>");
                    break;
                case LIST_2_UNIQUE_INDEX:
                    $name.text(model.list2.name + " unique");
                    break;
            }
            $name.attr("class", "name");
            $header.attr("class", "col-header");
            $header.append($name);

            // if 2 or 3 col versions, move 1 and 3 closer
            if (version != VERSION_FULL) {
                if (i == LIST_1_INDEX) {
                    $th.css("left", "10%");
                    $th.css("position", "relative");
                } else if (i == LIST_2_INDEX) {
                    $th.css("right", "10%");
                    $th.css("position", "relative");
                }
            }

            // column actions
            var $action = $("<div></div>");
            var $ul = $("<ul></ul>");

            /*
             * Note: the key names here (e.g "keep", "reject", "clear")
             * become the text for the displayed buttons (for convenience).
             * Furthermore, they receive a class with the same name.
             * So, changes in button text require changes in style.css
             */
            var actions = {
                keep : "accepted",
                reject : "rejected",
                clear : "undecided"
            };

            for (var action in actions) {
                var $li = $("<li></li>");
                var $a = $("<a></a>");

                $a.attr("class", action);
                if (action == "clear") {
                    $a.text(action);
                } else {
                    $a.text(action + " rest");
                }
                $a.click({
                    index : i,
                    dst : actions[action]
                }, processColumn);
                $li.append($a);
                $ul.append($li);
            }
            $action.attr("class", "action");
            $action.append($ul);

            // TODO generalize
            if (!((version === VERSION_THREE_COLUMN || version === VERSION_3COL_CLASSES) && i == 0))
                $header.append($action);

            $th.append($header);
            $tr.append($th);
        }
        $thead.append($tr);
        $container_header.append($thead);
        $container.append("<tbody></tbody>");

    }

    function populateItems($container) {

        // TODO: populate shadows first for less awkward overlaps

        // populate all items and shadows
        for (var id in model.items) {

            var item = model.items[id];
            var differences = [];

            var $item = $("<div></div>");
            $item.attr("id", id);
            $item.attr("class", "item undecided");

            if (item.isShadow) {
                $item.addClass("shadow");
            }

            /*
             * Highlighting a block element name allows for text-overflow,
             * but typically results in unnecessary color due to
             * 100% width. Thus wrap an inline name in a block element to
             * enable text-overflow and more natural name highlighting.
             */
            var $header = $("<div></div>");
            var $name = $("<span></span>");

            $header.attr("class", "header");
            $name.attr("class", "name");
            $name.text(item.name);

            if ( id in model.similar) {
                differences = model.similar[id].differences;

                if (differences.indexOf(model.ATTR_NAME) !== -1) {
                    $name.addClass("difference");
                }
            }
            var $detail = $("<div></div>");
            $detail.attr("class", "detail");

            for (var attribute in item.attributes) {
                if (model.attributes[attribute].display) {
                    var $attribute = $("<span></span>");
                    $attribute.text(item.attributes[attribute].toString());

                    if ( id in model.similar) {
                        if (differences.indexOf(attribute) !== -1) {
                            $attribute.addClass("difference");
                        }
                    }
                    $detail.append($attribute);
                }
            }
            $header.append($name);
            $item.append($header);
            $item.append($detail);
            $container.append($item);
        }

    }

    /*
     * Compute positions of items at each state based on contents of viewData
     * Update viewData.groupLengths[groupKey].startRow
     * Update NUM_ROWS
     *
     * Preconditions:
     *      viewData has been appropriately populated (with groups)
     *
     * Postconditions:
     *      positions datastructure populated such that positions[id][state]
     *          returns {'row': rowIndex, 'col': colIndex} for item "id" in
     *      viewData.groupLengths[groupKey].startRow populated so that
     *          viewData.groupLengths[groupKey].startRow[STATE] returns the row
     *          group "groupKey" starts on in state "STATE"
     *      viewData.groupLengths[groupKey].rowSetLen[STATE] populated so that
     *          it contains a list of lengths of sets (e.g. [1,1,2,1] means
     *          the 3rd set consumes 2 rows)
     *      NUM_ROWS datastructure populated with number of rows needed in
     *          Twinlist for each state
     *
     * Algorithm summary:
     *  viewData contains information about for each group (if none is default
     *  group) what ids to display
     *  for each id within a group, need to figure out row positions for
     *  the following states:
     *  (Note: col is just computed based on source list and whether identical)
     *
     *  STATE_SEPARATE:
     *    keep track of next row to put something for each source list
     *
     *  STATE_SIMILAR:
     *    consider each item in a "set" with relevant items (e.g. identical and
     *    similar) align this "set" on a set of rows
     *
     *  STATE_COMPACT:
     *    keep track of next row for the unique and identical columns, group
     *    similar sets at the bottom
     *
     *  NUM_ROWS is calculated at the end (maximum row reached in each state)
     *  This becomes an offset for the next group (next group starts where this
     *  one ended)
     *
     *  Note: currently, items only move into their similar position, then
     *   compact position. This makes it so group labels are invalid for identical
     *   and unique states (e.g. during unique state, the height of a previous
     *   group might change, which would require shifting later groups down).
     *   But, this invalidity is ok because it maintains that only relevant items
     *   animate during a state (e.g. in state unique: "unique move to sides",
     *   NOT "unique move to sides and stuff moves down")
     * // TODO identical items that are similar to something else, probably just putting identical items in col 2 and not updating row if already there
     */
    function calculatePositions() {

        // populate NUM_ROWS
        NUM_ROWS = {};
        NUM_ROWS[STATE_SEPARATE] = 0;
        NUM_ROWS[STATE_IDENTICAL] = 0;
        NUM_ROWS[STATE_UNIQUE] = 0;
        NUM_ROWS[STATE_SIMILAR] = 0;
        NUM_ROWS[STATE_COMPACT] = 0;

        // num rows for before starting current group (used to calculate length
        // of a group)
        var numRowsPrev = {};

        // clear rows
        positions = {};

        // for each group, in rank order:
        for (var groupKeyIndex in viewData.groupRank) {
            var groupKey = viewData.groupRank[groupKeyIndex];

            // get the list of visible ids
            var group = viewData.groups[groupKey];

            // save current maxes
            numRowsPrev[STATE_SEPARATE] = NUM_ROWS[STATE_SEPARATE];
            numRowsPrev[STATE_IDENTICAL] = NUM_ROWS[STATE_IDENTICAL];
            numRowsPrev[STATE_UNIQUE] = NUM_ROWS[STATE_UNIQUE];
            numRowsPrev[STATE_SIMILAR] = NUM_ROWS[STATE_SIMILAR];
            numRowsPrev[STATE_COMPACT] = NUM_ROWS[STATE_COMPACT];

            // various variables to keep track of what has been calculated so far
            // as we calculate positions for this group
            var separateNextRow = {
                "-1" : NUM_ROWS[STATE_SEPARATE],
                "1" : NUM_ROWS[STATE_SEPARATE]
            };

            var similarNextRow = {
                "-1" : NUM_ROWS[STATE_SIMILAR],
                "1" : NUM_ROWS[STATE_SIMILAR]
            };

            // start position for similar group in compact state
            var similarStart = (NUM_ROWS[STATE_COMPACT] + Math.max(viewData.groupLengths[groupKey].unique1.length, viewData.groupLengths[groupKey].unique2.length, Object.keys(viewData.groupLengths[groupKey].identicalMarker).length));

            var compactNextRow = {
                "unique" : {
                    "-1" : NUM_ROWS[STATE_COMPACT],
                    "1" : NUM_ROWS[STATE_COMPACT]
                },
                "similar" : {
                    "-1" : similarStart,
                    "1" : similarStart
                },
                "identical" : NUM_ROWS[STATE_COMPACT]
            }

            // save starting row for this group (using jQuery extend to make deep copy of NUM_ROWS)
            viewData.groupLengths[groupKey].startRow = $.extend(true, {}, NUM_ROWS);

            // initialize structure for row set lengths for this group
            viewData.groupLengths[groupKey].rowSetLen = {};
            viewData.groupLengths[groupKey].rowSetLen[STATE_SIMILAR] = [];
            viewData.groupLengths[groupKey].rowSetLen[STATE_COMPACT] = [];

            // hash of ids already processed, used to skip ids that are
            //  processed out of order
            var processed = {};

            // for each item in this group:
            for (var i = 0; i < group.length; i++) {
                // get the id and non-shadow (true) id
                var id = group[i];
                var trueId = model.items[id].isShadow ? parseInt(model.shadowsToItems[id]) : id;

                // either get existing positions data (may have been partially
                // calculated from out of order processing) or initialize
                positions[id] = positions[id] || {};

                // which side is this item on (if non-identical) - e.g. left or right side
                var side = model.items[id].listID == model.list1.id ? -1 : 1;

                // for every item, set the row and column in the separate state
                positions[id][STATE_SEPARATE] = {
                    'row' : separateNextRow[side.toString()]++, // set equal to value before increment
                    'col' : LIST_IDENTICAL_INDEX + side,         // Note: assumed identical column in center
                }

                // determine whether identical or similar
                var identicalSet = model.getIdentical(id, true, false);
                var similarSet = model.getSimilar(id, true, false);

                // make value false-y if empty, otherwise include id
                identicalSet = identicalSet.length == 0 ? undefined : [id].concat(identicalSet);
                similarSet = similarSet.length == 0 ? undefined : [id].concat(similarSet);

                if (identicalSet) {

                    // if not already processed out of order, calculate the
                    //  positions for the other states
                    if (!processed[id]) {

                        // calculate similar and compact states' row,col for
                        //  each identical item

                        for (var j in identicalSet) {
                            var identicalItemId = identicalSet[j];

                            // skip processing of things not in same group
                            // Note: possible because shadows should be in
                            //  separate groups
                            if (group.indexOf(identicalItemId) >= 0) {

                                // (already exists if identicalItemId == id)
                                positions[identicalItemId] = positions[identicalItemId] || {};

                                // reference to "identical item position data" (abbrev.)
                                var iIPD = positions[identicalItemId];

                                // in similar (precompact) state - will all be
                                //  at the same row, in identical column and
                                //  will stay in that position until compact state
                                iIPD[STATE_IDENTICAL] = {
                                    'row' : similarNextRow["-1"],
                                    'col' : LIST_IDENTICAL_INDEX
                                };

                                iIPD[STATE_UNIQUE] = iIPD[STATE_IDENTICAL];

                                iIPD[STATE_SIMILAR] = iIPD[STATE_UNIQUE];

                                // in compact state - will be in the next
                                //  identical row available
                                iIPD[STATE_COMPACT] = {
                                    'row' : compactNextRow.identical,
                                    'col' : LIST_IDENTICAL_INDEX
                                };

                                // mark item as already processed
                                processed[identicalItemId] = true;
                            }
                        }

                        // every identical item uses up one entire row in similar state
                        similarNextRow["-1"]++;
                        similarNextRow["1"]++;

                        // every identical item uses up one identical row in compact state
                        compactNextRow.identical++;

                        // identical set consumed 1 row in similar state
                        viewData.groupLengths[groupKey].rowSetLen[STATE_SIMILAR].push(1);
                    }

                } else if (similarSet) {

                    // calculate this item's identical state and unique state positions
                    // (same as its position in separate)
                    positions[id][STATE_IDENTICAL] = {
                        'row' : positions[id][STATE_SEPARATE].row,
                        'col' : positions[id][STATE_SEPARATE].col
                    };

                    positions[id][STATE_UNIQUE] = {
                        'row' : positions[id][STATE_SEPARATE].row,
                        'col' : positions[id][STATE_SEPARATE].col
                    };

                    if (!processed[id]) {

                        // sort so processed in same order currently in viewData group
                        similarSet = similarSet.sort(function(a, b) {
                            return group.indexOf(a) - group.indexOf(b);
                        });

                        // calculate similar and compact states' row + col for
                        // each similar item (including this item)

                        // save to figure out afterwards how many rows consumed
                        var lenBeforeSet = similarNextRow["-1"];

                        for (var j in similarSet) {
                            var similarItemId = similarSet[j];

                            if (group.indexOf(similarItemId) >= 0) {

                                positions[similarItemId] = positions[similarItemId] || {};

                                // reference to "similar item position data" (abbrev.)
                                var sIPD = positions[similarItemId];
                                var simSide = model.items[similarItemId].listID == model.list1.id ? -1 : 1;

                                sIPD[STATE_SIMILAR] = {
                                    'row' : similarNextRow[simSide.toString()]++,
                                    'col' : LIST_IDENTICAL_INDEX + simSide
                                };

                                // in compact state - will be in the next identical row available
                                sIPD[STATE_COMPACT] = {
                                    'row' : compactNextRow.similar[simSide.toString()]++,
                                    'col' : LIST_IDENTICAL_INDEX + simSide
                                };

                                processed[similarItemId] = true;
                            } // else don't process yet - not in same group
                        }

                        // re-align next similar positions (for similar and compact statea)
                        var newSimilarStart = Math.max(similarNextRow["-1"], similarNextRow["1"]);
                        similarNextRow["-1"] = newSimilarStart;
                        similarNextRow["1"] = newSimilarStart;

                        var newCompactStart = Math.max(compactNextRow.similar["-1"], compactNextRow.similar["1"]);
                        compactNextRow.similar["-1"] = newCompactStart;
                        compactNextRow.similar["1"] = newCompactStart;

                        // figure out how many rows consumed
                        viewData.groupLengths[groupKey].rowSetLen[STATE_SIMILAR].push(newSimilarStart - lenBeforeSet);
                        viewData.groupLengths[groupKey].rowSetLen[STATE_COMPACT].push(newSimilarStart - lenBeforeSet);
                    }
                } else {

                    // unique

                    // identical state is same as separate state
                    positions[id][STATE_IDENTICAL] = positions[id][STATE_IDENTICAL] || {};

                    positions[id][STATE_IDENTICAL] = positions[id][STATE_SEPARATE];

                    positions[id][STATE_SIMILAR] = {
                        'row' : similarNextRow[side]++,
                        'col' : LIST_IDENTICAL_INDEX + (2 * side)
                    };
                    similarNextRow[ (-1 * side).toString()]++;
                    // align similar next rows

                    positions[id][STATE_UNIQUE] = positions[id][STATE_SIMILAR];

                    positions[id][STATE_COMPACT] = {
                        'row' : compactNextRow.unique[side.toString()]++,
                        'col' : LIST_IDENTICAL_INDEX + (2 * side)
                    };

                    // uniques consume 1 row
                    viewData.groupLengths[groupKey].rowSetLen[STATE_SIMILAR].push(1);
                }

                // update maximum num rows
                NUM_ROWS[STATE_SEPARATE] = Math.max(NUM_ROWS[STATE_SEPARATE], positions[id][STATE_SEPARATE]['row'] + 1);
                NUM_ROWS[STATE_IDENTICAL] = Math.max(NUM_ROWS[STATE_IDENTICAL], positions[id][STATE_IDENTICAL]['row'] + 1);
                NUM_ROWS[STATE_UNIQUE] = Math.max(NUM_ROWS[STATE_UNIQUE], positions[id][STATE_UNIQUE]['row'] + 1);
                NUM_ROWS[STATE_SIMILAR] = Math.max(NUM_ROWS[STATE_SIMILAR], positions[id][STATE_SIMILAR]['row'] + 1);
                NUM_ROWS[STATE_COMPACT] = Math.max(NUM_ROWS[STATE_COMPACT], positions[id][STATE_COMPACT]['row'] + 1);
            } // end of for each item in group
        } // end of for each group
    }// end of calculatePositions

    /*
     * Return the number of remaining drugs to act upon
     * This varies depending on the current state
     * e.g. during Identical, drugs are merged so there seem to be fewer
     */
    function calculateNumRemaining() {
        // return the number of page elements that are undecided
        return $(".undecided:not(.preview):not(.shadow):visible").length;
    }

    // called to update the review button
    function updateReviewButton() {
        var $numRemaining = calculateNumRemaining();
        if ($numRemaining > 0) {
            // TODO rename
            $(".review_button .review").html('<div style="text-align:right"><strong>sign<br/>off</strong></div>' + '<span class="num_remaining">' + $numRemaining + '</span><br/>left<br/>' + '<div class="patient_name">' + model.patientLastName + ', ' + model.patientFirstName + ' (' + model.patientAge + model.patientGender + ')</div>');
            $(".review_button .review").addClass("disabled_button");
        } else {
            $(".review_button .review").html('<div style="text-align:right"><strong>sign<br/>off</strong></div>' + '<div class="patient_name">' + model.patientLastName + ', ' + model.patientFirstName + ' (' + model.patientAge + model.patientGender + ')</div>');
            $(".review_button .review").removeClass("disabled_button");
        }
    }

    // animation /////////////////////////////////////////////////////////
    /*
     * sort - whether to apply sort
     * filter - whether to apply filter
     * immediate - whether to move all items into final positon or use changeState
     * jumpToPosition - whether to jump to position or animate transition
     */
    function redraw(sort, filter, immediate, jumpToPosition) {
    	/*
         * Tweak proportions.
         *
         * Set position relative to the bottom primarily so that content
         * grows / shrinks from top edge, making room for the options
         * panel without occluding anything.
         *
         * Debatable whether the main app should have to crunch for the
         * options panel: overlapping might make it harder to forget that
         * it's open (and occupying unnecessary space).
         */
        var headerHeight = $(".banner").outerHeight(true);
        var optionsPanelHeight = $(".options").hasClass("active") ? $(".options-panel").outerHeight(true) : 0;
        var contentMarginTop = parseFloat($("#app > .content").css("margin-top"));
        var contentHeader = $(".backdrop-header").outerHeight(true);    // column headers
        var contentMarginBottom = parseFloat($("#app > .content").css("margin-bottom"));
        var detailHeight = $("#app > .detail").outerHeight(true);
        var brandingHeight = $(".branding").outerHeight(true);
        var footerHeight = detailHeight + brandingHeight;
        var tabHeight = $(".add").outerHeight(true);

        $("#app > .content").css("bottom", footerHeight);
        $("#app > .content").height($(window).height() - headerHeight - optionsPanelHeight - footerHeight - contentMarginTop - contentMarginBottom);
        $(".scrolling_content").height($(window).height() - headerHeight - optionsPanelHeight - footerHeight - contentMarginTop - contentMarginBottom - contentHeader);

        $(".add").css("top", headerHeight + contentMarginTop + topOffset() + optionsPanelHeight + tabHeight * 0.5);
        $(".edit").css("top", headerHeight + contentMarginTop + topOffset() + optionsPanelHeight + tabHeight * 1.75);

        // TODO: move scrolltip adjustment?

        adjustScrolltips();

        // if parameter to immediately draw (default undefined => false)
        //  calculatePositions and animate each at once
        
        viewData = model.viewData(sort, filter);
        // TODO check if need to regenerate (or don't preload it in init?)
        calculatePositions();
            
        
        if (immediate) {
            $("#app .item").each(function() {
                animateItem(this.id, state, jumpToPosition ? 0 : visible.animationDelay / 4);
            });
        } else {
            changeState(state, jumpToPosition);
        }
    }

    function changeState(toState, jumpToPosition) {
    	// if state is final one, disable compare
    	if(toState === STATE_COMPACT) {
    		$(".compare").addClass("inactive");
    	}
    	
        if (state === toState || version === VERSION_BASELINE || version === VERSION_LINK_ONLY || version === VERSION_THREE_COLUMN || version === VERSION_3COL_CLASSES) {
            transition(state, state, jumpToPosition);
            // no state change
        } else {
            var transitionDuration = visible.animationDuration;

            if (visible.animationSpeed === ANIMATION_SPEED_0) {
                // no animation, jump to destination state
                transition(toState, toState, jumpToPosition);
            } else {
                var offset = (state < toState) ? 1 : -1;
                var i = state;

                while (i !== toState) {
                    transition(state, i + offset, jumpToPosition);
                    i += offset;
                }
                transitionDuration += transitionDelay(state, toState - offset);
            }
            logger.log(logger.EVENT_STATE_CHANGE, "start:" + stateIndexToName(state) + ",end:" + stateIndexToName(toState) + ",duration(ms):" + transitionDuration);
            state = toState;
        }
    }

    /*
     * Handle transition between states
     * queue all transitions with timed delays
     *
     * in each transition:
     *      update row coloring
     *      animate item position
     */
    function transition(from, to, jumpToPosition) {
        var delay = 0;

        if (from < to) {
            delay = transitionDelay(state, to - 1);
        } else if (from > to) {
            delay = transitionDelay(state, to + 1);
        }

        // TODO: track timers to allow queue canceling

        setTimeout(function() {
            adjustAnimationControls(to);
            adjustBackdrop(to);
            adjustCellDimensions();

            // TODO better organization? code should be refactored, since this was when there was only intended to be 1 version
            if (version !== VERSION_THREE_COLUMN && version !== VERSION_3COL_CLASSES)// for 3col version, headers don't change'
                adjustColumnHeaders(from, to);

            adjustGroupLabels(from, to);
            adjustDifferenceHighlights(to);

            // clear striping
            $(".backdrop td").css("background", "");

            var $tbody = $(".backdrop tbody");
            var height = $tbody.children().length;

            for (var i = 0; i < height; i++) {
                $tbody.children(":nth-child(" + (i + 1) + ")").css("background", "");
            }

            // WHITE, NEUTRAL_GRAY, CONTRAST_GRAY
            var color = NEUTRAL_GRAY;

            if (model.groupBy) {

                // color each group a solid color
                var i = 0;
                // nth-child(i) is 1-indexed

                for (var j = 0; j < viewData.groupRank.length; j++) {
                    var groupKey = viewData.groupRank[j];
                    while (i < viewData.groupLengths[groupKey].startRow[to]) {
                        // color until start of next group
                        $tbody.children(":nth-child(" + (i + 1) + ")").css("background", color);
                        i++;
                    }
                    color = (color === WHITE) ? NEUTRAL_GRAY : WHITE;
                    // alternate colors
                }

                // finish coloring to the end
                while (i < NUM_ROWS[to]) {
                    $tbody.children(":nth-child(" + (i + 1) + ")").css("background", color);
                    i++;
                }

            } else if (to == STATE_COMPACT) {
                color = CONTRAST_GRAY;
                // if compact state and no grouping, do block coloring for top and similar set coloring below

                // block color top
                var topHeight = (Math.max(viewData.groupLengths[model.DEFAULT_GROUP].unique1.length, viewData.groupLengths[model.DEFAULT_GROUP].unique2.length, Object.keys(viewData.groupLengths[model.DEFAULT_GROUP].identicalMarker).length));
                var i = 0
                for (; i < topHeight; i++) {
                    $tbody.children(":nth-child(" + (i + 1) + ")").children(":nth-child(odd)").css("background", NEUTRAL_GRAY);
                }

                // color similar sets below
                var setEnd = topHeight;
                for (var j = 0; j < viewData.groupLengths[model.DEFAULT_GROUP].rowSetLen[STATE_COMPACT].length; j++) {
                    setEnd = setEnd + viewData.groupLengths[model.DEFAULT_GROUP].rowSetLen[STATE_COMPACT][j];
                    while (i < setEnd) {
                        $tbody.children(":nth-child(" + (i + 1) + ")").css("background", color);
                        i++;
                    }
                    color = (color === WHITE) ? CONTRAST_GRAY : WHITE;
                    // alternate colors
                }

            } else if (to == STATE_SIMILAR) {
                // if similar state and no grouping, do similar set coloring
                var i = 0;
                var setEnd = 0;
                for (var j = 0; j < viewData.groupLengths[model.DEFAULT_GROUP].rowSetLen[STATE_SIMILAR].length; j++) {
                    setEnd = setEnd + viewData.groupLengths[model.DEFAULT_GROUP].rowSetLen[STATE_SIMILAR][j];
                    while (i < setEnd) {
                        $tbody.children(":nth-child(" + (i + 1) + ")").css("background", color);
                        i++;
                    }
                    color = (color === WHITE) ? NEUTRAL_GRAY : WHITE;
                    // alternate colors
                }
            } else {
                // if separate, identical, or unique state (with no grouping),
                //  stripe rows for legibility
                $tbody.children(":nth-child(odd)").css("background", WHITE);
                $tbody.children(":nth-child(even)").css("background", NEUTRAL_GRAY);
            }

            // animate items
            //animateDefault(to); // TODO consider - should animate everything for group by (to handle bumping things down?)
            if (to > from) {
                if (to === STATE_IDENTICAL) {
                    animateIdentical(to, jumpToPosition);
                } else if (to === STATE_UNIQUE) {
                    animateUnique(to, jumpToPosition);
                } else {
                    animateDefault(to, jumpToPosition);
                }
            } else {
                animateDefault(to, jumpToPosition);
            }
        }, delay);

    }

    function animateIdentical(toState, jumpToPosition) {
        var i = 0;
        var checked = {}, animated = {};

        for (var id in model.identical) {
            if (checked[id] === undefined) {
                var set = model.identical[id];

                for (var j = 0; j < set.length; j++) {
                    var checkID = set[j];

                    if (model.items[checkID].isShadowed) {
                        set = set.concat(model.getShadows(checkID));
                    }
                }
                checked[id] = true;

                for (var j = 0; j < set.length; j++) {
                    checked[set[j]] = true;
                }
                animateSet(set, toState, (i > 0) ? (i * visible.animationDuration) + (i * visible.animationDelay) : 0, animated, jumpToPosition);
                i++;
            }
        }
    }

    function animateUnique(toState, jumpToPosition) {
        var unique1 = model.unique1, unique2 = model.unique2;

        for (var i = 0; i < model.unique1.length; i++) {
            var id = model.unique1[i];
            var item = model.items[id];

            if (item.isShadowed) {
                unique1 = unique1.concat(model.getShadows(id));
            }
        }

        for (var i = 0; i < model.unique2.length; i++) {
            var id = model.unique2[i];
            var item = model.items[id];

            if (item.isShadowed) {
                unique2 = unique2.concat(model.getShadows(id));
            }
        }

        // animate left first, then right
        animateSet(unique1, toState, 0, jumpToPosition)
        animateSet(unique2, toState, visible.animationDuration + visible.animationDelay, jumpToPosition);
    }

    function animateDefault(toState, jumpToPosition) {
        var duration = undefined;
        if(jumpToPosition)
            duration = 0;
            
        $("#app .item").each(function() {
            animateItem(this.id, toState, duration);
        });
    }

    function animateSet(set, toState, delay, animated, jumpToPosition) {
        
        var duration = undefined;
        if(jumpToPosition)
            duration = 0;
        
        setTimeout(function() {
            for (var i = 0; i < set.length; i++) {
                var id = set[i];

                if (animated) {
                    if (animated[id] === undefined) {
                        animated[id] = true;
                        animateItem(id, toState, duration);
                    }
                } else {
                    animateItem(id, toState, duration);
                }
            }
        }, delay);
    }

    function animateItem(id, toState, duration) {
        // skip items that did not have positions calculated in viewData
        if (!positions[id] || !positions[id][toState])
            return;

        var $item = $("#" + id);

        var position = (toState !== undefined) ? offsetToPosition(positions[id][toState]) : offsetToPosition(positions[id]);
        
        // TODO: animate() or transition()?

        $item.transition({
            left : position.x,
            top : position.y,
            duration : (duration == undefined) ? visible.animationDuration : duration,
            easing : CUSTOM_EASE_IN
        });

        var trueId = model.items[id].isShadow ? parseInt(model.shadowsToItems[id]) : id;

        // for simplicity, hide identical shadows that are from the right column

        var item = model.items[id];

        // handle identical overlap
        if ( trueId in model.identical) {
            if (state < STATE_IDENTICAL) {
                if ( id in model.hidden) {
                    delete model.hidden[id];
                    visible.toggleItem($item, visible.toggleOnDelay, true);
                }
            } else {
                if (item.isShadow) {
                    if (item.listID === model.list2.id) {
                        // only hide shadows if in right column and has an identical in left column
                        var identicalItems = model.getIdentical(id, true);
                        for (var i = 0; i < identicalItems.length; i++) {
                            var idenItem = model.items[identicalItems[i]];
                            if (item.attributes[model.groupBy][item.groupByOffset] == idenItem.attributes[model.groupBy][idenItem.groupByOffset]) {
                                model.hidden[id] = true;
                                visible.toggleItem($item, visible.toggleOffDelay, false);
                                break;
                            }
                        }
                    } // else don't hide
                } else {
                    // for non-shadow, just check if in first position of identical
                    if (model.identical[id].indexOf(parseFloat(id)) !== 0) {
                        model.hidden[id] = true;
                        visible.toggleItem($item, visible.toggleOffDelay, false);
                    }
                }
            }
        }
    }

    function topOffset() {
        return $(".backdrop-header th").outerHeight(true);
    }

    function columnWidth() {
        // align according to column headers
        return $(".backdrop-header tr").outerWidth(true) / 5;
    }

    function scrollbarAdjust() {
        // compare body's trs with headers to determine if scrollbar present
        var ret = $(".backdrop-header tr").outerWidth(true) - $(".backdrop-body tr").outerWidth(true);
        return ret
    }

    function rowHeight() {
        // include padding but exclude margin
        return $(".backdrop td").outerHeight();
    }

    // given offset information (which row/column), convert into (x,y) position info for css "top" and "left"
    function offsetToPosition(offset) {
        var twoColOffset = 0;
        // offset for 2 column versions to make lists closer together
        if (version != VERSION_FULL) {
            twoColOffset = $(".backdrop thead").outerWidth() * 0.1;
            if (offset.col == 3)
                twoColOffset = twoColOffset * -1;
        }

        return {
            x : offset.col * columnWidth() + twoColOffset,
            y : (offset.row * rowHeight())
        };
    }

    function transitionDelay(from, to) {
        var delay = 0;

        if (from < to) {
            for (var i = from + 1; i <= to; i++) {
                if (i === STATE_IDENTICAL) {
                    delay += transitionIdenticalDelay();
                } else if (i === STATE_UNIQUE) {
                    delay += 2 * (visible.animationDuration + visible.animationDelay);
                } else {
                    delay += visible.animationDuration + visible.animationDelay;
                }
            }
        } else if (from > to) {
            for (var i = from; i >= to + 1; i--) {
                delay += visible.animationDuration + visible.animationDelay;
            }
        }
        return delay;
    }

    function transitionIdenticalDelay() {
        var numSets = 0;
        var checked = {};

        for (var id in model.identical) {
            if (checked[id] === undefined) {
                var set = model.getIdentical(id);
                checked[id] = true;

                for (var j = 0; j < set.length; j++) {
                    checked[set[j]] = true;
                }
                numSets++;
            }
        }
        return (numSets * visible.animationDuration) + (numSets * visible.animationDelay);
    }

    /*
     * Given a speed, update delay times accordingly (and log it)
     * Params:
     *      String speed - defined constant
     * Returns:
     *      none
     */
    function setAnimationSpeed(speed) {
        // adjust speed
        visible.animationSpeed = speed;
        $("select[name='speed']").val(speed);

        if (speed === ANIMATION_SPEED_0) {
            // use neutral (median) animation speed for single transition
            visible.animationDuration = BASE_ANIMATION_DURATION * ANIMATION_SPEED_COEFFICIENTS[
            Math.floor(ANIMATION_SPEED_COEFFICIENTS.length / 2)];
        } else {
            var coefficient = speed.replace(/[^0-5]+/g, "");
            visible.animationDuration = BASE_ANIMATION_DURATION * ANIMATION_SPEED_COEFFICIENTS[coefficient];
        }

        // adjust delays accordingly
        visible.animationDelay = visible.animationDuration * 0.75;
        visible.toggleOnDelay = visible.animationDelay / 4;
        visible.toggleOffDelay = visible.animationDelay * 1.5;

        adjustAnimationControls(state);

        logger.log(logger.EVENT_ANIMATION_SPEED_CHANGE, visible.animationSpeed);
    }

    // interface adjustment //////////////////////////////////////////////
    function adjustBackdrop(toState) {
        // redraw everything: avoid odd white stripe when end row changes
        $(".backdrop tbody tr").remove();

        for (var i = 0; i < NUM_ROWS[toState]; i++) {
            var $tr = $("<tr></tr>");

            for (var j = 0; j < NUM_COLUMNS; j++) {
                $tr.append("<td></td>");
            }
            $(".backdrop tbody").append($tr);
        }
    }

    function adjustColumnHeaders(from, to) {
        toggleHeader(LIST_1_UNIQUE_INDEX, to < STATE_UNIQUE ? false : true);
        toggleHeader(LIST_IDENTICAL_INDEX, to < STATE_IDENTICAL ? false : true);

        // match item animation: list 1 unique, then list 2 unique
        setTimeout(function() {
            toggleHeader(LIST_2_UNIQUE_INDEX, to < STATE_UNIQUE ? false : true);
        }, from >= to ? 0 : visible.animationDuration + visible.animationDelay);

        toggleConditionalHeaders(to < STATE_SIMILAR ? false : true);
    }

    /*
     * Given a state, adjust animation controls appropriately
     * "state" is one of the defined constants above
     */
    function adjustAnimationControls(state) {
    	$(".separate, .identical, .unique, .similar, .compact").removeClass("active inactive");
        var active = {};
        var inactive = {};

        // inactive
        if (visible.animationSpeed === ANIMATION_SPEED_0) {
            inactive[STATE_IDENTICAL] = true;
            inactive[STATE_UNIQUE] = true;
            inactive[STATE_SIMILAR] = true;
        }

        if (model.groupBy) {
            inactive[STATE_IDENTICAL] = true;
            inactive[STATE_UNIQUE] = true;
            delete inactive[STATE_SIMILAR];
        } else {
            delete inactive[STATE_IDENTICAL];
            delete inactive[STATE_UNIQUE];
            delete inactive[STATE_SIMILAR];
        }

        if (version === VERSION_BASELINE || version === VERSION_LINK_ONLY || version === VERSION_THREE_COLUMN || version === VERSION_3COL_CLASSES) {
            for (var i = STATE_IDENTICAL; i < NUM_STATES; i++) {
                inactive[i] = true;
            }
            $(".compare").addClass("inactive");
        }

        for (var stateIndex in inactive) {
            $("." + stateIndexToName(parseInt(stateIndex))).addClass("inactive");
        }
        $("." + stateIndexToName(state)).removeClass("inactive").addClass("active");
    }

    function adjustGroupLabels(from, to) {
        $(".groups .label").remove();

        if (model.groupBy) {
            for (var groupKey in viewData.groups) {
                var group = viewData.groups[groupKey];

                var $label = $("<span></span>");
                $label.attr("class", "label");
                $label.text(groupKey);
                $label.css("left", 0);
                $label.css("top", (viewData.groupLengths[groupKey]['startRow'][to] * rowHeight()));
                $(".groups").append($label);
            }
            $(".groups .label").addClass("show");
        }
    }
    
    
    /*
     * populate the third column in 3-column view (the anchor column)
     * will either be drug classes or diagnoses right now
     * 
     * Parameters:
     *      $container - jQuery selected object to append to
     *      populationData - data to insert, assumed to be an object
     *          whose keys will be the names
     */
    function populateThirdAnchorColumn($container, populationData) {
        var bg_thead_height = 0;
        var dHeight = 40;
        // TODO fetch from css?

        // populate all items and shadows
        var i = 0;
        for (var key in populationData) {
            var itemText = populationData[key];

            var $item = $("<div></div>");
            $item.attr("id", key);
            $item.attr("class", "diagnosis");

            var $header = $("<div></div>");
            var $name = $("<span></span>");

            $header.attr("class", "header");
            $name.attr("class", "name");
            $name.text(itemText);

            $header.append($name);
            $item.append($header);

            $item.css("top", bg_thead_height + (i * dHeight) + "px");

            $container.append($item);
            i++;
        }
    }

    function adjustCellDimensions() {
        // adjust padding
        $("#app .item").css("padding-top", model.groupBy ? "1em" : "0.6em");
        $("#app .item").css("padding-bottom", model.groupBy ? 0 : "0.4em");

        // adjust height
        if (displayDetails) {
            $("#app .item .detail").fadeIn();
        } else {
            $("#app .item .detail").fadeOut();
        }
    }

    // given a state, adjust difference highlights on items
    function adjustDifferenceHighlights(toState) {
        if (toState < STATE_SIMILAR) {
            $(".difference").removeClass("highlight");
        } else {
            if (model.displayName !== model.RECORDED_NAME) {
                $(".name.difference").removeClass("highlight");
                $(".undecided .difference:not(.name)").addClass("highlight");
            } else {
                $(".undecided .difference").addClass("highlight");
            }
        }
    }

    function adjustScrolltips() {
        var bottom = $("#app > .detail").outerHeight(true) + $(".branding").outerHeight(true) + parseFloat($("#app > .content").css("margin-bottom"));

        // hand-tweaked positions, adjust as appropriate
        $(".up").css("top", topOffset() * 2);
        // * 2 just for simple rough positioning
        $(".down").css("bottom", bottom);
    }

    function toggleHeader(index, show) {
        var $header = $(".backdrop th:nth-child(" + (index + 1) + ") .col-header");

        if (show) {
            $header.fadeIn(visible.toggleOnDelay);
        } else {
            $header.fadeOut(visible.toggleOnDelay);
        }
    }

    function toggleConditionalHeaders(show) {
        if (show) {
            $(".backdrop th:nth-child(" + (LIST_1_INDEX + 1) + ") .name .conditional").fadeIn(visible.toggleOnDelay);
            $(".backdrop th:nth-child(" + (LIST_2_INDEX + 1) + ") .name .conditional").fadeIn(visible.toggleOnDelay);
        } else {
            $(".backdrop th:nth-child(" + (LIST_1_INDEX + 1) + ") .name .conditional").fadeOut(visible.toggleOffDelay);
            $(".backdrop th:nth-child(" + (LIST_2_INDEX + 1) + ") .name .conditional").fadeOut(visible.toggleOffDelay);
        }
    }

    function stateIndexToName(index) {
        switch (index) {
            case STATE_SEPARATE:
                return "separate";
            case STATE_IDENTICAL:
                return "identical";
            case STATE_UNIQUE:
                return "unique";
            case STATE_SIMILAR:
                return "similar";
            case STATE_COMPACT:
                return "compact";
        }
        return undefined;
    }

    // item events ///////////////////////////////////////////////////////
    function mousedownHandler(event) {
        if(!touchEvent) {
            var clickType = 0;
            if(event.which == 1)
                clickType = "left";
            else if(event.which == 3)
                clickType = "right";
            itemChange($(this), this.id, clickType);
        }
    }
    
    /*
     * used by mousedown + swipe/tap to handle the user's decision for an item
     * itemId - id of item decided on
     * String clickType - type of click (indicates which direction to cycle)
     *      {"left", "right"} 
     */
    function itemChange($item, itemId, clickType) {
        logger.log(logger.EVENT_CLICKED, "item");
        
        var dst;
        visible.editID = itemId;
        
        if (clickType == "left") {// left click
            if ($item.hasClass("undecided")) {
                dst = "accepted";
            } else if ($item.hasClass("accepted")) {
                dst = "rejected";
            } else if ($item.hasClass("rejected")) {
                dst = "undecided";
            }
        } else if (clickType == "right") {// right click
            if ($item.hasClass("undecided")) {
                dst = "rejected";
            } else if ($item.hasClass("accepted")) {
                dst = "undecided";
            } else if ($item.hasClass("rejected")) {
                dst = "accepted";
            }
        }
        
        if (dst) {
            processItem(itemId, dst, version === VERSION_BASELINE);

            if (model.afterAction === model.AFTER_ACTION_REMOVE) {
                redraw(true, true);
            }
            
            // some item was changed, update sign off button's undecided count
            updateReviewButton();
        }            
    }

    function mouseoverHandler() {
        var id = this.id;
        var item = model.items[id];

        if(printHover) {
            // for debugging, print item + id to console on hover
            console.log(item.name + "\t" + id);
        }

        // hover appropriate item(s)
        if (version === VERSION_FULL || version === VERSION_LINK_ONLY || version === VERSION_THREE_COLUMN || version === VERSION_3COL_CLASSES) {
            var toHover = model.getRelatedSet(id, model.multigroup);

            for (var i = 0; i < toHover.length; i++) {
                var hoverID = toHover[i];
                hoverSet[hoverID] = true;
                hoverItem(hoverID, true, true);
            }
        } else {
            hoverSet[id] = true;
            hoverItem(id, true, true);
        }
        hoverScrolltips(id, true);

        // update item detail
        var $detail = $(".detail .content");
        
        // color detail panel to draw attention
        $detail.css("background", "#555555");
        $detail.css("color", "#f0f0f0");
        
        // TODO more general approach? this becomes med rec-specific:
        // display generic name
        var genericName = item.getNames()['generic'];
        var genericPart = item.name == genericName ? "" : " (" + genericName + ")";

        var fullDescription = item.name + genericPart + " | ";

        for (var attributeName in model.attributes) {
            if ( attributeName in item.attributes) {
                var values = item.attributes[attributeName];
                var valuesString = "";

                if (values.length > 1) {
                    values = item.attributes[attributeName];

                    for (var i = 0; i < values.length; i++) {

                        if (attributeName === model.ATTR_SUBITEM) {
                            var subitem = values[i];
                            var dose = subitem
                            .attributes[model.ATTR_DOSE];

                            valuesString += subitem.name + ( dose ? " " + subitem.attributes[model.ATTR_DOSE] : "");
                        } else {
                            valuesString += values[i];
                        }
                        valuesString += ", ";
                    }
                    valuesString = valuesString.slice(0, -2);
                } else {
                    valuesString = values.toString();
                }

                if (valuesString.trim() !== "") {
                    fullDescription += valuesString + " | ";
                }
            }
        }
        fullDescription = fullDescription.slice(0, -3);

        // add note about edited items
        var editedExplanation = "";
        if ($(this).hasClass("modified")) {
            editedExplanation = " | (Note: * = modified item)"
        }
        $detail.text(fullDescription + editedExplanation);

        // diagnosis highlight
        if (version === VERSION_THREE_COLUMN) {
            var diagnosisSets = model.diagnosisSet;
            for (var diagnosisId in diagnosisSets) {
                if (diagnosisSets[diagnosisId].indexOf(id) >= 0) {
                    hoverDiagnosisSet.push(diagnosisId);
                    $("#" + diagnosisId).addClass("third-col-anchor-hover");
                }
            }
        } else if (version === VERSION_3COL_CLASSES) {
            // drug class highlight // TODO refactor into control column?
            var dcSets = model.drugClassSet;
            for (var dcId in dcSets) {
                if (dcSets[dcId].indexOf(id) >= 0) {
                    hoverDiagnosisSet.push(dcId);
                    // TODO rename when control col refactor
                    $("#" + dcId).addClass("third-col-anchor-hover");
                }
            }
        }
    }

    function mouseoutHandler() {
        for (var id in hoverSet) {
            hoverItem(id, false, true);
        }
        hoverSet = {};
        hoverScrolltips(this.id, false);

        var $detail = $(".detail .content");
        $detail.text("Nothing to display.");   
        
        // remove detail panel's coloring
        $detail.css("background", "#f0f0f0");
        $detail.css("color", "#333333");

        // diagnosis unhighlight
        if (version === VERSION_THREE_COLUMN) {
            for (var diagnosisId in hoverDiagnosisSet) {
                $("#" + hoverDiagnosisSet[diagnosisId]).removeClass("third-col-anchor-hover");
            }
            hoverDiagnosisSet = [];
        } else if (version === VERSION_3COL_CLASSES) {
            // drug class unhighlight // TODO clean - rename
            for (var diagnosisId in hoverDiagnosisSet) {
                $("#" + hoverDiagnosisSet[diagnosisId]).removeClass("third-col-anchor-hover");
            }
            hoverDiagnosisSet = [];
        }
    }

    // given an id and whether this is on mouseover, hover the item
    function hoverItem(id, mouseover, showHighlights) {
        var item = model.items[id];
        var $item = $("#" + id);

        if (mouseover) {
            $item.addClass("item-hover");

            if (item.isShadow)
                $item.css("opacity", "0.6");
            else
                $item.css("opacity", "1");

            if ($item.hasClass("undecided")) {
                $item.addClass("undecided-hover");
            }

            // for 2 column w/ links or 3col, highlight differences on mouseover
            if (version === VERSION_LINK_ONLY || (version === VERSION_THREE_COLUMN && showHighlights) || (version === VERSION_3COL_CLASSES && showHighlights)) {
                $("#" + id + " .difference").addClass("highlight");
            }

        } else {
            $item.removeClass("item-hover");

            if ($item.hasClass("undecided")) {
                $item.removeClass("undecided-hover");
            }

            // for 2 column w/ links or 3col, highlight differences on mouseover
            if (version === VERSION_LINK_ONLY || (version === VERSION_THREE_COLUMN && showHighlights) || (version === VERSION_3COL_CLASSES && showHighlights)) {
                $("#" + id + " .difference").removeClass("highlight");
            }
        }
    }

    // TODO consider refactor

    // hover item if mouseover is on a diagnosis
    function diagnosisHoverItem(id, mouseover, showHighlights) {
        var item = model.items[id];
        var $item = $("#" + id);

        if (mouseover) {
            $item.addClass("item-hover");

            if (item.isShadow)
                $item.css("opacity", "0.6");
            else
                $item.css("opacity", "1");

            if ($item.hasClass("undecided")) {
                //$item.addClass("diagnosis-hover");
            } else {
                // undo de-emphasization
                $item.css("opacity", "1.0");
            }

            // for 2 column w/ links or 3col, highlight differences on mouseover
            if (version === VERSION_LINK_ONLY || (version === VERSION_THREE_COLUMN && showHighlights) || (version === VERSION_3COL_CLASSES && showHighlights)) {
                $("#" + id + " .difference").addClass("highlight");
            }

        } else {
            $item.removeClass("item-hover");

            if ($item.hasClass("undecided")) {
                //$item.removeClass("diagnosis-hover");
            }

            // for 2 column w/ links or 3col, highlight differences on mouseover
            if (version === VERSION_LINK_ONLY || (version === VERSION_THREE_COLUMN && showHighlights) || (version === VERSION_3COL_CLASSES && showHighlights)) {
                $("#" + id + " .difference").removeClass("highlight");
            }
        }
    }

    function hoverScrolltips(id, mouseover) {
        $(".scrolltip").removeClass("show");

        if (mouseover) {
            var checkItems = (version === VERSION_FULL || version === VERSION_LINK_ONLY || version === VERSION_THREE_COLUMN || version === VERSION_3COL_CLASSES) ? model.getRelatedSet(id, model.multigroup) : model.getShadowSet(id);
            var checkItems = utils.getUniqueElements(checkItems);

            var numObscured = {
                "neither" : 0,
                "above" : 0,
                "below" : 0
            };

            var namesObscured = {
                "neither" : "",
                "above" : "",
                "below" : ""
            };

            for (var i = 0; i < checkItems.length; i++) {
                var id = checkItems[i];
                if (!model.hidden[id]) {
                    var offScreen = isOffscreen(id);
                    numObscured[offScreen]++;
                    namesObscured[offScreen] += ("\n" + model.items[id].name);
                }
            }

            if (numObscured["above"] > 0) {
                $(".up").text("...more (" + numObscured["above"] + ")" + namesObscured["above"]);
                $(".up").addClass("show");
            }

            if (numObscured["below"] > 0) {
                $(".down").text("...more (" + numObscured["below"] + ")" + namesObscured["below"]);
                $(".down").addClass("show");
            }
        }
    }

    /*
     * Toggle options panel based on whether $panel has active class
     * 
     * doRedraw - whether to perform a redraw afterwards
     */
    function toggleOptionsPanel($panel, doRedraw) {
        if ($panel.hasClass("active")) {
            $panel.text("show options").removeClass("active");

            $(".options-panel").css("transition", "transform 0.3s, opacity 0.2s").removeClass("show");
            $(".options-panel").css("-webkit-transition", "-webkit-transform 0.3s, opacity 0.2s").removeClass("show");
            $(".options-panel").css("-moz-transition", "-moz-transform 0.3s, opacity 0.2s").removeClass("show");
            $(".options-panel").css("-ms-transition", "-ms-transform 0.3s, opacity 0.2s").removeClass("show");
            $(".options-panel").css("-o-transition", "-o-transform 0.3s, opacity 0.2s").removeClass("show");

            $("#app > .content").css("transition", "height 0.3s");
            $("#app > .content").css("-webkit-transition", "height 0.3s");
            $("#app > .content").css("-moz-transition", "height 0.3s");
            $("#app > .content").css("-ms-transition", "height 0.3s");
            $("#app > .content").css("-o-transition", "height 0.3s");

            $(".add, .edit").css("transition", "top 0.3s, width 0.2s");
            $(".add, .edit").css("-webkit-transition", "top 0.3s, width 0.2s");
            $(".add, .edit").css("-moz-transition", "top 0.3s, width 0.2s");
            $(".add, .edit").css("-ms-transition", "top 0.3s, width 0.2s");
            $(".add, .edit").css("-o-transition", "top 0.3s, width 0.2s");

        } else {
            $panel.text("hide options").addClass("active");

            $(".options-panel").css("transition", "transform 0.2s, opacity 0.2s").addClass("show");
            $(".options-panel").css("-webkit-transition", "-webkit-transform 0.2s, opacity 0.2s").addClass("show");
            $(".options-panel").css("-moz-transition", "-moz-transform 0.2s, opacity 0.2s").addClass("show");
            $(".options-panel").css("-ms-transition", "-ms-transform 0.2s, opacity 0.2s").addClass("show");
            $(".options-panel").css("-o-transition", "-o-transform 0.2s, opacity 0.2s").addClass("show");

            $("#app > .content").css("transition", "height 0.2s");
            $("#app > .content").css("-webkit-transition", "height 0.2s");
            $("#app > .content").css("-moz-transition", "height 0.2s");
            $("#app > .content").css("-ms-transition", "height 0.2s");
            $("#app > .content").css("-o-transition", "height 0.2s");

            $(".add, .edit").css("transition", "top 0.2s, width 0.2s");
            $(".add, .edit").css("-webkit-transition", "top 0.2s, width 0.2s");
            $(".add, .edit").css("-moz-transition", "top 0.2s, width 0.2s");
            $(".add, .edit").css("-ms-transition", "top 0.2s, width 0.2s");
            $(".add, .edit").css("-o-transition", "top 0.2s, width 0.2s");

        }

        if (doRedraw)
            redraw(true, true, true);
    }

    function isOffscreen(id) {
        var status = "neither";
        var $content = $(".scrolling_content");
        var divHeight = $(".item").outerHeight();
        var topEdge = $(".scrolling_content").scrollTop();
        var bottomEdge = topEdge + $content.outerHeight();

        if (!positions[id]) {
            return status;
        }
        // skip for items that are not visible (e.g. shadows that are populated by not in viewdata)

        var position = offsetToPosition(positions[id][state]);

        if ((position.y + divHeight) < topEdge || topEdge > (position.y + divHeight * 0.75)) {
            status = "above";
        } else if (position.y > bottomEdge || (position.y + divHeight * 0.25) > bottomEdge) {
            status = "below";
        }
        return status;
    }

    // item action ///////////////////////////////////////////////////////
    function resetDecisions() {
        model.accepted = [];
        model.rejected = [];
        model.undecided = model.list1.source.concat(model.list2.source);

        $(".item").removeClass("accepted rejected").addClass("undecided");
        resetLinkActionFlags();

        state = STATE_SEPARATE;
    }

    function resetLinkActionFlags() {
        linkAction = {};

        for (var id in model.items) {
            linkAction[id] = true;
        }
    }

    function processItem(id, dst, nolink) {
        // don't trigger meaningless linked actions
        if (!$("#" + id).hasClass(dst)) {
            if (nolink) {
                actOnItem(id, dst);
            } else {
                // act on shadow = act on item
                actOnSet(model.items[id].isShadow ? model.getShadowed(id) : id, dst);
            }
        }
    }

    function getItemsInColumn(state, columnIndex) {

        if (state === STATE_SEPARATE) {

            // in separate, return list1 or list2
            if (columnIndex == LIST_1_INDEX)
                return model.list1.source;
            else if (columnIndex == LIST_2_INDEX)
                return model.list2.source;

        } else if (state === STATE_IDENTICAL) {

            // in identical, return list1 or list2 with identical filtered out
            //  or return things in identical that are not hidden

            if (columnIndex == LIST_1_INDEX)
                return $.grep(model.list1.source, function(id) {
                    return !( id in model.identical);
                });
            else if (columnIndex == LIST_IDENTICAL_INDEX)
                return $.grep(Object.keys(model.identical), function(id) {
                    return !(model.hidden[id]);
                });
            else if (columnIndex == LIST_2_INDEX)
                return $.grep(model.list2.source, function(id) {
                    return !( id in model.identical);
                });

        } else {

            // by state unique and up, all items in final columns
            // return data in columns filtering things out as needed

            if (columnIndex == LIST_1_UNIQUE_INDEX) {
                return model.unique1;
            } else if (columnIndex == LIST_1_INDEX) {
                return $.grep(model.list1.source, function(id) {
                    return !( id in model.identical) && model.unique1.indexOf(id) < 0;
                });
            } else if (columnIndex == LIST_IDENTICAL_INDEX) {
                return $.grep(Object.keys(model.identical), function(id) {
                    return !(model.hidden[id]);
                });
            } else if (columnIndex == LIST_2_INDEX) {
                return $.grep(model.list2.source, function(id) {
                    return !( id in model.identical) && model.unique2.indexOf(id) < 0;
                });
            } else if (columnIndex == LIST_2_UNIQUE_INDEX) {
                return model.unique2;
            }

        }
    }

    // called to handle column actions (like "keep", "reject", "clear")
    function processColumn(event) {
        logger.log(logger.EVENT_CLICKED, "column_action");
        logger.log(logger.EVENT_COLUMN_ACTION, "dst:" + event.data.dst + ",state:" + state + ",column:" + event.data.index);

        var col = getItemsInColumn(state, event.data.index)

        for (var j = 0; j < col.length; j++) {
            var id = col[j];
            // only act on items in this particular column
            //  and only act on undecided ones
            if (event.data.dst == 'undecided' || $("#" + id).hasClass('undecided')) {
                processItem(id, event.data.dst, event.data.index != LIST_IDENTICAL_INDEX);
            }
        }

        if (col.length > 0 && model.afterAction === model.AFTER_ACTION_REMOVE) {
            redraw(true, true);
        }

        // update review button's number of undecided
        updateReviewButton();
    }

    function actOnSet(id, dst) {
        var identical = model.getIdentical(id);
        var similar = model.getSimilar(id, undefined, true);

        // always link actions on identical sets
        for (var i = 0; i < identical.length; i++) {
            actOnItem(identical[i], dst === "accepted" ? "rejected" : dst);
        }

        // only link actions on similar sets for the first click
        if (linkAction[id] && similar.length > 0) {
            for (var i = 0; i < similar.length; i++) {
                actOnItem(similar[i], dst === "undecided" ? "undecided" : "rejected");
            }

            if (dst === "rejected") {
                var related = model.getRelated(id);
                var next = related[0];

                if ( next in model.identical) {
                    // ensure that next is always visible
                    next = model.identical[next][0];
                }
                actOnItem(next, "accepted");
            }
        }
        actOnItem(id, dst);
    }

    function actOnItem(id, dst) {
        // act on item
        decide(id, dst);

        // act on shadows
        var shadows = model.getShadows(id);

        for (var i = 0; i < shadows.length; i++) {
            decide(shadows[i], dst);
        }
    }

    function decide(id, dst) {
        var $item = $("#" + id);
        var $differences = $("#" + id + " .difference");
        var checkID = model.items[id].isShadow ? model.getShadowed(id) : id;

        // update model
        var src = "undecided";

        if ($item.hasClass("accepted")) {
            src = "accepted";
        } else if ($item.hasClass("rejected")) {
            src = "rejected";
        }
        model.decide(id, src, dst);

        // update view
        $item.removeClass("accepted rejected undecided undecided-hover");

        if (dst === "undecided") {
            if ( id in hoverSet) {
                $item.addClass("undecided-hover");
            }

            if (state >= STATE_SIMILAR) {
                $differences.addClass("highlight");
            }
        } else {
            $differences.removeClass("highlight");
        }
        $item.addClass(dst);

        /*
         * Actions on members of identical sets are always linked.
         *
         * Only the first action on a similar set is linked.
         */
        linkAction[id] = checkID in model.identical ? true : false;
    }

    function updateItem(id, allNames, attributes) {
        // update model
        var item = model.items[id];

        // verify was changed in some way
        var unchanged = allNames['recorded'] == item.name;
        for (var aN in attributes) {
            var oldValue = item.attributes[aN] == undefined ? "" : item.attributes[aN].toString();
            var newValue = attributes[aN] == undefined ? "" : attributes[aN].toString();
            unchanged = unchanged && oldValue == newValue;
        }

        if (!unchanged) {
            item.setName(allNames);
            item.isModified = true;

            for (var attributeName in attributes) {
                item.attributes[attributeName] = attributes[attributeName];
            }

            // update view
            $("#" + id + " .name").text(item.name);
            $("#" + id + " .detail").remove();

            var newDetailHTML = "<div class='detail'>";
            var differences = [];

            if ( id in model.similar) {
                differences = model.similar[item.id].differences;
            }

            for (var attribute in item.attributes) {
                if (model.attributes[attribute].display) {
                    newDetailHTML += "<span" + (differences.indexOf(attribute) !== -1 ? " class='difference'" : "") + ">" + item.attributes[attribute].toString() + "</span>"
                }
            }
            newDetailHTML += "</div>";

            $("#" + id).addClass("modified");
            $("#" + id).append($(newDetailHTML));
        } else {
            item = false;
            // return falsey value so no updates made
        }
        return item;
    }

    // TODO: sort ////////////////////////////////////////////////////////
    function saveModifiedItem(type) {
        var allNames = {};
        var attributes = {};

        var name = $("#modify input[name='name']").val() + "";
        var route = $("#modify input[name='route']").val() + "";
        var frequency = $("#modify input[name='frequency']").val() + "";
        var dose = $("#modify input[name='dose']").val() + "";
        var instructions = $("#modify textarea[name='instructions']").val() || "";
        var drugClass = "unknown";

        allNames = {
            recorded : name,
            generic : name,
            brand : name
        };
        attributes[model.ATTR_DOSE] = [dose];
        attributes[model.ATTR_ROUTE] = [route];
        attributes[model.ATTR_FREQUENCY] = [frequency];
        attributes[model.ATTR_INSTRUCTIONS] = [instructions];

        if (type === "edit") {
            var newItem = updateItem(visible.editID, allNames, attributes);

            // if nothing changed, newItem will be false
            if (newItem) {

                // update shadows or shadowed items, if any
                var updateIDs = [];

                if (newItem.isShadow) {
                    updateIDs = updateIDs.concat(model.getShadowed(visible.editID));
                } else {
                    updateIDs = updateIDs.concat(model.getShadows(visible.editID));
                }

                for (var i = 0; i < updateIDs.length; i++) {
                    updateItem(updateIDs[i], allNames, attributes);
                }
            }
        } else {
            // update model - needs a name at least
            if (name) {
                var newItem = {};

                attributes[model.ATTR_DRUG_CLASS] = [drugClass];
                newItem = new ListItem(model.nextID++, model.list2.id, allNames, attributes);
                newItem.groupByOffset = 0;
                newItem.isModified = true;
                newItem.isShadow = false;
                newItem.isShadowed = false;

                model.items[newItem.id] = newItem;
                model.list2.source.push(newItem.id);
                model.unique2.push(newItem.id);
                model.accepted.push(newItem.id);
                positions[newItem.id] = {// TODO verify remove - unnecessary ?
                    threshold : STATE_UNIQUE,
                    initialCol : LIST_2_INDEX,
                    finalCol : LIST_2_UNIQUE_INDEX
                };

                // update view
                var htmlItem = "<div id='" + newItem.id + "' class='item accepted modified'>" + "<div class='header'>" + "<span class='name'>" + name + "</span>" + "</div>" + "<div class='detail'>";

                for (var attribute in newItem.attributes) {
                    if (model.attributes[attribute].display) {
                        htmlItem += "<span class='" + newItem.attributes[attribute].toString() + "'>" + newItem.attributes[attribute].toString() + "</span>";
                    }
                }
                htmlItem += "</div></div>";
                $(".items").append($(htmlItem));

                // prepare actions
                $("#" + newItem.id).mousedown(mousedownHandler).mouseover(mouseoverHandler).mouseout(mouseoutHandler).bind("contextmenu", function() {
                    // free right click for item action
                    return false;
                });
            }
        }
        redraw(true, true);
    }

    function resetModifyPanel(type) {
        logger.log(logger.EVENT_MODIFY_PANEL_START, "type:" + type);
        var attributes = {
            name : "",
            dose : "",
            route : "",
            frequency : "",
            instructions : ""
        };

        // nothing to respond to
        $("#modify .response").removeClass("show");

        // panel title
        $("#modify h1").text(type);

        // preview and form contents
        if (type === "edit") {
            var item = model.items[visible.editID];

            attributes = {
                name : item.name,
                dose : item.attributes[model.ATTR_DOSE],
                route : item.attributes[model.ATTR_ROUTE],
                frequency : item.attributes[model.ATTR_FREQUENCY],
                instructions : model.ATTR_INSTRUCTIONS in item.attributes ? item.attributes[model.ATTR_INSTRUCTIONS] : ""
            };
        }

        for (var attribute in attributes) {
            var value = attributes[attribute].toString();

            if (attribute === "instructions") {
                $("textarea[name='instructions']").val(value);
            } else {
                $("input[name='" + attribute + "']").val(value);
                $(".preview ." + attribute).text(value);
            }
        }
    }

    function updatePreview($field) {
        $(".preview ." + $field.attr("name")).text($field.val());
    }

    function populateColumn(arr, rows) {
        for (var i = 0; i < arr.length; i++) {
            rows[i] += populateReviewItem(arr[i]);
        }

        for (; i < rows.length; i++) {
            rows[i] += "<td></td>";
        }
        return rows;
    }

    function populateReviewItem(id) {
        var item = model.items[id];

        var htmlItem = "<td class='item" + ($("#" + id).hasClass("modified") ? " modified" : "") + "'>" + "<div class='header'>" + "<span class='name'>" + item.name + "</span>" + "</div>" + "<div class='detail'>";

        for (var attribute in item.attributes) {
            if (model.attributes[attribute].display) {
                htmlItem += "<span class='" + item.attributes[attribute].toString() + "'>" + item.attributes[attribute].toString() + "</span>";
            }
        }
        return htmlItem += "</div></td>";
    }

    // save decisions into session storage for summary.html
    function saveItemActions() {
        var stop = "", start = "", cont = "";

        for (var id in model.items) {
            var item = model.items[id];

            if (item.isShadow) {
                continue;
            }
            var $item = $("#" + id);
            var frequency = item.attributes[model.ATTR_FREQUENCY].toString();

            // expand abbreviations
            frequency = frequency.replace(/w/i, " weeks");
            frequency = frequency.replace(/h/i, " hours");
            frequency = frequency.replace(/B\.?I\.?D\.?/i, "two times as day");
            frequency = frequency.replace(/T\.?I\.?D\.?/i, "three times a day");
            frequency = frequency.replace(/Q\.?I\.?D\.?/i, "four times a day");
            frequency = frequency.replace(/q/i, "every ");

            var modifiedStr = item.isModified ? "* " : "";

            var itemString = item.listID + "\t" + modifiedStr + item.name + "\t" + frequency + "\t" + item.attributes[model.ATTR_DOSE] + "\t" + item.attributes[model.ATTR_ROUTE] + "\n";

            if (item.listID === model.list1.id && $item.hasClass("accepted")) {
                cont = cont + itemString;
            } else if (item.listID === model.list1.id && $item.hasClass("rejected")) {
                stop = stop + itemString;
            } else if (item.listID === model.list2.id && $item.hasClass("accepted")) {
                start = start + itemString;
            }
        }
        stop = stop.trimRight();
        start = start.trimRight();
        cont = cont.trimRight();

        utils.setStorageItem("stop", stop);
        utils.setStorageItem("start", start);
        utils.setStorageItem("continue", cont);

        // save patient name
        utils.setStorageItem("patient_name", model.patientLastName + ", " + model.patientFirstName);
    }

    function getVersionShortName(version) {
        switch(version) {
            case VERSION_FULL:
                return "FULL";
            case VERSION_BASELINE:
                return "BASE";
            case VERSION_LINK_ONLY:
                return "LINK";
        }
        return undefined;
    };

    // updates cycling/options and does redraw depending on dontRedraw
    function updateGroupBy(toGroup, dontRedraw) {

        var $curr_groupby = model.groupBy;

        // update cycling if toGroup is valid
        var $next_val = "";
        var $next_name = "";

        // if going to group by drug class, next one is none
        if (toGroup == "__ATTR_DIAGNOSES__") {
            $next_val = "";
            $next_name = "none";
        } else {// otherwise next is drug class
            $next_val = "__ATTR_DIAGNOSES__";
            $next_name = "diagnoses";
        }

        // update the grouping in the options (using value)
        $("select[name='groupBy']").val(toGroup);

        // update the cycle group button's text
        $(".cycle_groupby").html("group by: " + $next_name);
        $(".cycle_groupby").attr("value", $next_val);

        // update mpdel
        model.groupBy = toGroup;

        // force; grouping in identical + similar can have problems due to group height changes
        //  two alternatives: have extra space to handle group height changes OR incorporate shifting into animation
        if (model.groupBy && state < STATE_SIMILAR && state != STATE_SEPARATE) {
            state = STATE_SIMILAR;
        }

        if(!dontRedraw)
            redraw(true, true);
    }

    // expose interface //////////////////////////////////////////////////
    return visible;
}(window.controller = window.controller || {}, $, undefined);
