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
        t.find('tr > *:nth-child(3)').hide();
        //TODO: This is too hackey. See if there's a way to save that info.
        // Hide any data not from the current institution
        let currentDivName = $('#user-division').text().split(': ')[1];
        t.find('td:nth-of-type(3):not(:contains(' + currentDivName + '))').parent().hide();
      }
      else t.find(' * ').show();

      // Calculate total orders
      // Get all visible non header rows and then the last child (count) column
      let totalCount = 0;
      t.find('tbody tr:not(:first):visible td:last-child').each(function() {
        totalCount += parseInt($(this).text());
      });

      // Insert the counts into the badge
      $('ul.nav-tabs > li > a:contains("Outpatient") > span.badge').html(totalCount);
    });

    pharmacy.getInpatientPharmacyOrders(EWD);
    pharmacy.getOutpatientPharmacyOrders(EWD);

    $('#inpatient-refresh-info').off().on('click', function() {
      $('#inpatient-refresh-info').addClass('fa-spin');
      pharmacy.getInpatientPharmacyOrders(EWD);
    });

    $('#outpatient-refresh-info').off().on('click', function() {
      $('#outpatient-refresh-info').addClass('fa-spin');
      pharmacy.getOutpatientPharmacyOrders(EWD);
    });

    $('#processAll').off().on('click', function () {
      let params = {
        service: 'ewd-vista-pharmacy',
        name: 'modal-table.html',
        targetId: 'modal-window'
      };
      EWD.getFragment(params, function() {
        let params = {
          service: 'ewd-vista-pharmacy',
          type: 'outpatientOrdersAll'
        };
        EWD.send(params, (res) => pharmacy.drawOutpatientPatientsTable(EWD, res.message));
      }); //EWD.getFragment
    }); //on.Click

  }); //EWD.getFragement
}; // ~landingPage

pharmacy.getInpatientPharmacyOrders = function(EWD) {
  $('#inpatient-pending-table > table > tbody').html('');
  let params = {
    service: 'ewd-vista-pharmacy',
    type: 'inpatientOrdersSummary'
  };
  EWD.send(params, (res) => {
    pharmacy.drawInpatientPendingOrders(EWD, res.message);
    $('#inpatient-refresh-info').removeClass('fa-spin');
  });
};

pharmacy.getOutpatientPharmacyOrders = function(EWD) {
  $('#outpatient-pending-table > table > tbody').html('');
  let params = {
    service: 'ewd-vista-pharmacy',
    type: 'outpatientOrdersSummary'
  };
  EWD.send(params, (res) => {
    pharmacy.drawOutpatientPendingOrders(EWD, res.message);
    $('#outpatient-refresh-info').removeClass('fa-spin');
  });
};

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

  console.log('foo');
  // Convert Sort Groups into spans for each sort group
  Object.keys(tableData).forEach(ien => {
    tableData[ien].clinicSortGroupsSpans = '';
    if (tableData[ien].clinicSortGroups.length > 0) {
      for (clinicSortGroup of tableData[ien].clinicSortGroups) {
        tableData[ien].clinicSortGroupsSpans = tableData[ien]
          .clinicSortGroupsSpans
          .concat(`<span id=${clinicSortGroup.ien}>${clinicSortGroup.name}</span>`);
      }
    }
  });
  // For each ward group or clinic
  Object.keys(tableData).forEach(ien => {
    t.append(`
            <tr id=${ien}>
            <td>${tableData[ien].clinicSortGroupsSpans}</td>
            <td>${tableData[ien].name}</td>
            <td id=${tableData[ien].institutionIEN}>
            ${tableData[ien].institutionName}&nbsp;
            <span class="badge">${tableData[ien].institutionCount}</span>
            </td>
            <td>${tableData[ien].earliestOrderDateTime}</td>
            <td>${tableData[ien].latestOrderDateTime}</td>
            <td>${tableData[ien].flagged}</td>
            <td>${tableData[ien].count}</td>
            </tr>
            `);
  });

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
  pharmacy.addTableBehaviors(EWD, $table);

  $('#tableReset').click(function(){
    $('input:checkbox#chkonlyMyInstitution').prop( 'checked', false ).change();
  });

  // Make checkbox checked to invoke event and hide institution (default)
  $('input:checkbox#chkonlyMyInstitution').prop( 'checked', true ).change();

  // Add clickable links, first, to institution
  let $th = $table.find('th#institution');
  let columnIndex = $th.index();
  // Underline on hover
  $table.find('tr > *:nth-child(' + (columnIndex + 1) + ')').hover(
    function() { $(this).css('text-decoration', 'underline'); },
    function() { $(this).css('text-decoration', 'none');      }
  );
  // Click
  $table.find('tr > *:nth-child(' + (columnIndex + 1) + ')').click(function(e) {
    // Don't let the click event shoot up to the row click
    e.stopPropagation();

    let institutionIEN = this.id;
    let params = {
      service: 'ewd-vista-pharmacy',
      name: 'modal-table.html',
      targetId: 'modal-window'
    };

    EWD.getFragment(params, function() {
      let params = {
        service: 'ewd-vista-pharmacy',
        type: 'outpatientOrdersByInstitution',
        params: { institutionIEN: institutionIEN  }
      };
      EWD.send(params, (res) => pharmacy.drawOutpatientPatientsTable(EWD, res.message));
    });
  });

  // Add clickable links, second, to clinic sort group
  $th = $table.find('th#sortGroups');
  columnIndex = $th.index();

  // Underline on hover
  $table.find('tr > *:nth-child(' + (columnIndex + 1) + ') span').hover(
    function() { $(this).css('text-decoration', 'underline'); },
    function() { $(this).css('text-decoration', 'none');      }
  );

  // Click
  $table.find('tr > *:nth-child(' + (columnIndex + 1) + ') span').click(function(e) {
    // Don't let the click event shoot up to the row click
    e.stopPropagation();

    let clinicSortGroupIEN = this.id;
    let params = {
      service: 'ewd-vista-pharmacy',
      name: 'modal-table.html',
      targetId: 'modal-window'
    };

    EWD.getFragment(params, function() {
      let params = {
        service: 'ewd-vista-pharmacy',
        type: 'outpatientOrdersByClinicSortGroup',
        params: { clinicSortGroupIEN: clinicSortGroupIEN}
      };
      EWD.send(params, (res) => pharmacy.drawOutpatientPatientsTable(EWD, res.message));
    });
  });
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

  pharmacy.addTableBehaviors(EWD, $table);

  $('#modal-window').modal({
    backdrop: true,
    keyboard: true,
    focus: true,
    show: true
  });
  $('#modal-window').modal('show');

};

pharmacy.addTableBehaviors = function(EWD, $table) {

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

  // Add hiding behavior
  $table.find('i.fa-eye-slash').click(function() {
    let columnIndex = $(this).closest('th').index();
    $table.find('tr > *:nth-child(' + (columnIndex + 1) + ')').hide();
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
