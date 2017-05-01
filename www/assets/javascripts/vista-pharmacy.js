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
    EWD.send(params2, (res) => pharmacy.drawPendingOrders(res.message));
  });
};

pharmacy.drawPendingOrders = function(tableData) {

  // Grab Table Body (table doesn't work)
  let t = $('#pending-table > table > tbody');

  // For each ward group or clinic
  Object.keys(tableData).map((type) => {
    let typeName = type === 'C' ? 'Clinic' : 'Ward Group';
    t.append(
    `<tr><th colspan="5">${typeName}</th></tr>`
    );

    // For each clinic/ward
    Object.keys(tableData[type]).map((name) => {
      //Add the name in the first cell
      t.append('<tr>');
      t.append(`
        <td>${name}</td>
      `);

      // Then each ^ piece after that as IV/UD/IV/UD
      for (item in tableData[type][name].split('^'))
      {
        t.append(`
        <td>${tableData[type][name].split('^')[item]}</td>
        `);
      }
      t.append('</tr>');
    });
  });
};
