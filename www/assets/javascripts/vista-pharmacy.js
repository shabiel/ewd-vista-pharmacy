var pharmacy = {};

// Load CSS & set up nav
pharmacy.prep = function(EWD) {
  $('body').on('click', '#app-pharmacy', function() {
    vista.switchApp();
    pharmacy.landingPage(EWD);
  });
};

pharmacy.landingPage = function(EWD) {
  let params = {
    service: 'ewd-vista-pharmacy',
    name: 'landing.html',
    targetId: 'main-content'
  };

  EWD.getFragment(params, function() {
    $('.fileman-autocomplete').filemanAutocomplete();

    let params2 = {
      service: 'ewd-vista-pharmacy',
      type: 'ordersSummaryDashboard'
    };
    EWD.send(params2, (res) => console.log(res));
  });



};
