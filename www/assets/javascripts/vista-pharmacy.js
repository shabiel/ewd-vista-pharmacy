var pharmacy = {};

// Load CSS & set up nav
pharmacy.prep = function(EWD) {
  $('body').on('click', '#app-pharmacy', function() {
    vista.switchApp();
    pharmacy.landingPage(EWD);
  });
}; // ~prep

// Main set-up
pharmacy.landingPage = function(EWD) {
  let params = {
    service: 'ewd-vista-pharmacy',
    name: 'landing.html',
    targetId: 'main-content'
  };

  EWD.getFragment(params, function() {
    $('.fileman-autocomplete').filemanAutocomplete();

    // Braces for let isolation
    {
      let params = {
        service: 'ewd-vista-pharmacy',
        type: 'inpatientOrdersSummary'
      };
      EWD.send(params, (res) => pharmacy.drawInpatientPendingOrders(res.message));
    }

    {
      let params = {
        service: 'ewd-vista-pharmacy',
        type: 'outpatientOrdersSummary'
      };
      EWD.send(params, (res) => pharmacy.drawOutpatientPendingOrders(res.message));
    }
  });
}; // ~landingPage

pharmacy.drawInpatientPendingOrders = function(tableData) {

  // Grab Table Body pointer (table by itself will malfunction)
  let t = $('#inpatient-pending-table > table > tbody');

  // Counters for updating the "badges" next to the tabs
  let countIV = 0, countUD = 0;

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

      let itemArray = tableData[type][name].split('^');
      for (var itemIndex in itemArray)
      {
        // IVs are in position 0 and 2; UDs in 1 and 3
        // NB: || 0 is to change empty strings to zero.
        countIV += itemIndex % 2 ? 0 : parseInt(itemArray[itemIndex] || 0);
        countUD += itemIndex % 2 ? parseInt(itemArray[itemIndex] || 0) : 0;
        t.append(`
        <td>${tableData[type][name].split('^')[itemIndex]}</td>
        `);
      }
      t.append('</tr>');
    });
  });

  // Insert the counts into the badges
  $('ul.dropdown-menu > li > a:contains("UD") > span.badge').html(countUD);
  $('ul.dropdown-menu > li > a:contains("IV") > span.badge').html(countIV);
  $('ul.nav-tabs > li > a:contains("Inpatient") > span.badge').html(countUD + countIV);

};

pharmacy.drawOutpatientPendingOrders = function(tableData) {
  // Grab Table Body pointer (table by itself will malfunction)
  let t = $('#outpatient-pending-table > table > tbody');

  // Counters for updating the "badge" next to the tab
  let count = 0;

  // For each ward group or clinic
  Object.keys(tableData).forEach(ien => {
    t.append(`
            <tr id=${ien}>
            <td>${tableData[ien].name}</td>
            <td>${tableData[ien].count}</td>
            </tr>
            `);
    count += tableData[ien].count;
  });
  // Insert the counts into the badges
  $('ul.nav-tabs > li > a:contains("Outpatient") > span.badge').html(count);

  $('i.sortable').click(function() {
    let dir = $(this).hasClass('fa-caret-down') ? 'forwards' : 'backwards';

    t.find('tr:not(:first)').sort((a,b) => {
      let columnIndex = $(this).closest('th').index();
      let tda = $(a).find('td:eq(' + columnIndex +')').text();
      let tdb = $(b).find('td:eq(' + columnIndex +')').text();
      if (dir === 'backwards') return tda < tdb ? 1 : tda > tdb ? -1 : 0;
      if (dir === 'forwards')  return tda > tdb ? 1 : tda < tdb ? -1 : 0;
    }).appendTo(t);

    if (dir === 'backwards') $(this).removeClass('fa-caret-up').addClass('fa-caret-down');
    if (dir === 'forwards')  $(this).removeClass('fa-caret-down').addClass('fa-caret-up');
  });
};
