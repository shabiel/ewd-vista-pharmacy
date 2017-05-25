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

    // Checkbox - only my institution check event handler.
    $('input:checkbox#chkonlyMyInstitution').change(function() {
      let t = $('#outpatient-pending-table > table > tbody');
      if ($('#chkonlyMyInstitution')[0].checked) {
        // Hide institution column
        t.find('tr > *:nth-child(2)').hide();
        //TODO: This is too hackey. See if there's a way to save that info.
        // Hide any data not from the current institution
        let currentDivName = $('#user-division').text().split(': ')[1];
        t.find('td:nth-of-type(2):not(:contains(' + currentDivName + '))').parent().hide();
      }
      else t.find(' * ').show();
    });


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
            <td>${tableData[ien].institutionName}</td>
            <td>${tableData[ien].count}</td>
            </tr>
            `);
    count += tableData[ien].count;
  });

  // Insert the counts into the badges
  $('ul.nav-tabs > li > a:contains("Outpatient") > span.badge').html(count);

  // Sorting logic
  $('i.sortable').click(function() {
    let dir = $(this).hasClass('fa-caret-down') ? 'forwards' : 'backwards';

    if (dir === 'backwards') $(this).removeClass('fa-caret-up').addClass('fa-caret-down');
    if (dir === 'forwards')  $(this).removeClass('fa-caret-down').addClass('fa-caret-up');

    // Table sorting logic. Takes into account whether to sort lexically or numerically.
    t.find('tr:not(:first)').sort((a,b) => {
      let columnIndex = $(this).closest('th').index();
      let tda = $(a).find('td:eq(' + columnIndex +')').text();
      let tdb = $(b).find('td:eq(' + columnIndex +')').text();

      let isNumeric = !isNaN(tda);

      if (dir === 'backwards' && !isNumeric) return tda       < tdb ? 1 : tda       > tdb ? -1 : 0;
      if (dir === 'backwards' && isNumeric)  return tda - tdb < 0   ? 1 : tda - tdb > 0   ? -1 : 0;
      if (dir === 'forwards'  && !isNumeric) return tda       > tdb ? 1 : tda       < tdb ? -1 : 0;
      if (dir === 'forwards'  && isNumeric)  return tda - tdb > 0   ? 1 : tda - tdb < 0   ? -1 : 0;
    }).appendTo(t);
  });

  // Make checkbox checked to invoke event and hide institution (default)
  $('input:checkbox#chkonlyMyInstitution').prop( 'checked', true ).change();
};
