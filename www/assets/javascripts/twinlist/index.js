// TODO: refactor
var SIGN_OFF_SUCCESS_MSG = "reconciled list submitted.";


$(function() {
    
    console.log("url: " + utils.getURLParameter("case"));
    console.log("url: " + utils.getURLParameter("version"));
    console.log("url: " + utils.getURLParameter("animate"));
    
    // TODO input validation for query params
    var dataset = utils.getURLParameter("case") || model.DATASET_DEFAULT;
    var version = utils.getURLParameter("version") || controller.versionDefault;
    var autoAnimate = utils.getURLParameter("animate") || controller.autoAnimateDefault;

    model.init(dataset);
    
    // Note: controller assumes model has been initialized already
    controller.init(false, version, autoAnimate);
    
    logger.init();
});

