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
      let t = $('#outpatient-pending-table > table');
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
      EWD.send(params, (res) => pharmacy.drawInpatientPendingOrders(EWD, res.message));
    }

    {
      let params = {
        service: 'ewd-vista-pharmacy',
        type: 'outpatientOrdersSummary'
      };
      EWD.send(params, (res) => pharmacy.drawOutpatientPendingOrders(EWD, res.message));
    }
  });
}; // ~landingPage

pharmacy.drawInpatientPendingOrders = function(EWD, tableData) {

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

      let itemArray = tableData[type][name].toString().split('^');
      for (var itemIndex in itemArray)
      {
        // IVs are in position 0 and 2; UDs in 1 and 3
        // NB: || 0 is to change empty strings to zero.
        countIV += itemIndex % 2 ? 0 : parseInt(itemArray[itemIndex] || 0);
        countUD += itemIndex % 2 ? parseInt(itemArray[itemIndex] || 0) : 0;
        t.append(`
        <td>${tableData[type][name].toString().split('^')[itemIndex]}</td>
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

pharmacy.drawOutpatientPendingOrders = function(EWD, tableData) {
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

  // Click logic for the table -- load modal window
  t.find('tr').click(function() {
    // NB: this is the tr that's clicked
    //     this.id will give us our Hospital Location IEN
    let hospitalLocationIEN = this.id;

    let params = {
      service: 'ewd-vista-pharmacy',
      name: 'modal-table.html',
      targetId: 'modal-window'
    };
    EWD.getFragment(params, function() {
      let params = {
        service: 'ewd-vista-pharmacy',
        type: 'outpatientOrdersByClinic',
        params: { hospitalLocationIEN: hospitalLocationIEN }
      };
      EWD.send(params, (res) => pharmacy.drawOutpatientPatientsTable(EWD, res.message));
    });
  });

  let $table = t.closest('table');
  pharmacy.addTableBehaviors($table);

  // Make checkbox checked to invoke event and hide institution (default)
  $('input:checkbox#chkonlyMyInstitution').prop( 'checked', true ).change();
};

pharmacy.drawOutpatientPatientsTable = function(EWD, drawData) {
  let $thead = $('div.modal-body table thead tr');
  drawData.header.forEach(eachHeader => $thead.append(`
    <th>${eachHeader}&nbsp;<i class="fa fa-caret-up sortable" aria-hidden="true"></i></th>
    `)
  );

  let $table = $('div.modal-body table');
  let $tbody = $('div.modal-body table tbody');
  let tableRow = '';
  drawData.data.forEach(datum => {
    tableRow += '<tr>';
    datum.forEach(item => tableRow += `<td>${item}</td>`);
    tableRow += '</tr>';
  });

  $tbody.append(tableRow);

  $(document).on('keydown', function(event){
    // Set up Esc key
    if (event.keyCode === 27) {
      $('#modal-window').modal('hide');
    }
  });

  pharmacy.addTableBehaviors($table);

  $('#modal-window').modal('show');

};

pharmacy.addTableBehaviors = function($table) {

  // Add sorting behavior
  $table.find('i.sortable').click(function() {
    let dir = $(this).hasClass('fa-caret-down') ? 'forwards' : 'backwards';

    if (dir === 'backwards') $(this).removeClass('fa-caret-up').addClass('fa-caret-down');
    if (dir === 'forwards')  $(this).removeClass('fa-caret-down').addClass('fa-caret-up');

    // Table sorting logic. Takes into account whether to sort lexically or numerically.
    let thisTable = $(this).closest('table');
    thisTable.find('tbody tr').sort((a,b) => {
      // Get column index of the clicked triangle
      let columnIndex = $(this).closest('th').index();

      // Grab the values based on the columnIndex
      let tda = $(a).find('td:eq(' + columnIndex +')').text();
      let tdb = $(b).find('td:eq(' + columnIndex +')').text();

      let isNumeric = !isNaN(tda);

      if (dir === 'backwards' && !isNumeric) return tda       < tdb ? 1 : tda       > tdb ? -1 : 0;
      if (dir === 'backwards' && isNumeric)  return tda - tdb < 0   ? 1 : tda - tdb > 0   ? -1 : 0;
      if (dir === 'forwards'  && !isNumeric) return tda       > tdb ? 1 : tda       < tdb ? -1 : 0;
      if (dir === 'forwards'  && isNumeric)  return tda - tdb > 0   ? 1 : tda - tdb < 0   ? -1 : 0;
    }).appendTo(thisTable);
  });

  // Add hover highlighting logic for table
  $table.find('tbody tr').hover(
    function () {
      $(this).addClass('table-highlight');
    },
    function () {
      $(this).removeClass('table-highlight');
    }
  );
};
