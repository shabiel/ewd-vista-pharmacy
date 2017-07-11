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
  let row = '';
  Object.keys(tableData).forEach(ien => {
    row += `<tr id=${ien}>
            <td>${tableData[ien].clinicSortGroupsSpans}</td>
            <td>${tableData[ien].name}</td>
            <td id=${tableData[ien].institutionIEN}>
            ${tableData[ien].institutionName}&nbsp;
            <span class="badge">${tableData[ien].institutionCount}</span>
            </td>
            <td>${tableData[ien].earliestOrderDateTime}</td>
            <td>${tableData[ien].latestOrderDateTime}</td>
            <td>${tableData[ien].flagged}</td>`;
    row += '<td>';
    Object.keys(tableData[ien].routing).forEach(pickup => {
      row += `${pickup}: ${tableData[ien].routing[pickup]}<br />`;
    });
    row += '</td>';
    row += `<td>${tableData[ien].count}</td>
            </tr>`;
  });

  t.append(row);

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
  // NB: Data is returned in 5 arrays; the 4 arrays that contain
  // patient data all have the same indexes. data[1] applies to 
  // metaProviders[1], renewals[1], nonFormulary[1] etc.
  let $thead = $('div.modal-body table thead tr');
  let $tbody = $('div.modal-body table tbody');
  let $table = $('div.modal-body table');

  // Draw headers into $thead
  drawData.header.forEach(eachHeader => $thead.append(`
    <th>${eachHeader}&nbsp;<i class="fa fa-caret-up sortable" aria-hidden="true"></i></th>
    `)
  );

  // tableRow lets us add html to it before we put it on the page
  let tableRow = '';

  // combinedProviders and Classes add up the cumulative providers and
  // classes for each patient for use in filtering.
  let combinedProviders = {};
  let combinedClasses = {};

  // NB: This is the main drawing loop!
  drawData.data.forEach((datum, index) => {
    let sortedMetaProviders = Object.values(drawData.metaProviders[index]).sort( (a,b) => a > b);
    let sortedMetaVaDrugClasses = Object.keys(drawData.metaVaDrugClasses[index]).sort( (a,b) => a > b);
    sortedMetaProviders.forEach(one => combinedProviders[one] = '');
    sortedMetaVaDrugClasses.forEach(one => combinedClasses[one] = 
        drawData.metaVaDrugClasses[index][one]);
    // Datum 0 is the DFN. We add it then get rid of it.
    // tr has data stuff we use for filtering.
    tableRow += `<tr
      id="${datum[0]}"
      data-providers=${JSON.stringify(sortedMetaProviders)}
      data-classes=${JSON.stringify(sortedMetaVaDrugClasses)}
      data-renewal=${drawData.renewals[index]}
      data-nonformulary=${drawData.nonFormulary[index]}
      data-earliestordertime="${Number(drawData.earliestOrdersTimes[index]).dateFromTimson()}"
      data-latestordertime="${Number(drawData.latestOrdersTimes[index]).dateFromTimson()}"
      >`;
    datum.shift(); // Get rid of DFN
    datum.forEach(item => tableRow += `<td>${item}</td>`);
    tableRow += '</tr>';
  });

  $tbody.append(tableRow);
  
  console.log('foo');

  // Get the arrays from the keys
  let combinedProvidersArray = Object.keys(combinedProviders);
  let combinedVaClassesArray = Object.keys(combinedClasses);

  // Sort
  combinedProvidersArray.sort();
  combinedVaClassesArray.sort();

  // Put the sorted objects into the drop down boxes on the page
  // Providers
  $('#provider').empty();
  $('#provider').append(new Option('', ''));
  combinedProvidersArray.forEach(one => $('#provider').append(new Option(one, one)));
  // and then classes
  $('#class').empty();
  $('#class').append(new Option('', ''));
  combinedVaClassesArray.forEach(one => $('#class').append(new Option(one + ' - ' + combinedClasses[one], one)));

  // Count Updater function (function cuz has to be invoked multiple times)
  var updateCounts = function() {
    let totalCount = 0;
    let patientCount = 0;
    $table.find('tr:not(:first):visible td:last-child').each(function() {
      totalCount += parseInt($(this).text());
      patientCount++;
    });

    $('#patientCount').html(patientCount);
    $('#orderCount').html(totalCount);
  };

  // Filter the table based on select of these
  var changeFunction = function() {
    $tbody.find(' * ').show();
    let provider = $('#provider').val();
    let vaclass    = $('#class').val();
    $tbody.find('tr').each(function() {
      provArray = $(this).data().providers;
      classArray = $(this).data().classes;
      if (vaclass !== '' && !classArray.includes(vaclass)) $(this).hide();
      if (provider !== '' && !provArray.includes(provider)) $(this).hide();
    });
    updateCounts();
  };

  $('#provider').off().change(changeFunction);
  $('#class').off().change(changeFunction);

  // == Checkboxes ==
  // Clear checkboxes and reset dropdowns
  $('a#clearChecks').off().click(function() {
    $tbody.find(' * ').show();
    $('#filters input:checkbox').prop('checked', false);
    $('#provider').prop('selectedIndex', 0);
    $('#class').prop('selectedIndex', 0);
  });
  
  // Window/Inhouse Checkbox
  $('input:checkbox#winOnly').off().change(function() {
    let isChecked = this.checked;
    let columnIndex = $thead.find('th:contains("WINDOW")').index();
    $tbody.find('tr').each(function() {
      let winNum = $(this).find(`td:eq(${columnIndex})`).text();
      winNum = parseInt(winNum);
      if (isChecked && winNum === 0)  $(this).hide();
      if (!isChecked && winNum === 0) $(this).show();
    });
    updateCounts();
  });

  // Mail Only CheckBox
  $('input:checkbox#mailOnly').off().change(function() {
    let isChecked = this.checked;
    let columnIndex = $thead.find('th:contains("MAIL")').index();
    $tbody.find('tr').each(function() {
      let mailNum = $(this).find(`td:eq(${columnIndex})`).text();
      mailNum = parseInt(mailNum);
      if (isChecked && mailNum === 0)  $(this).hide();
      if (!isChecked && mailNum === 0) $(this).show();
    });
    updateCounts();
  });

  // Renewals Checkbox
  $('input:checkbox#renewalsOnly').off().change(function() {
    let isChecked = this.checked;
    $tbody.find('tr').each(function() {
      let renewal = $(this).data().renewal;
      if (typeof renewal === 'string') renewal = renewal === 'true' ? true : false;
      if (isChecked && !renewal) $(this).hide();
      if (!isChecked && !renewal) $(this).show();
    });
    updateCounts();
  });

  // Nonformulary Checkbox
  $('input:checkbox#nonformOnly').off().change(function() {
    let isChecked = this.checked;
    $tbody.find('tr').each(function() {
      let nonformulary = $(this).data().nonformulary;
      if (typeof nonformulary === 'string') nonformulary = nonformulary === 'true' ? true : false;
      if (isChecked && !nonformulary) $(this).hide();
      if (!isChecked && !nonformulary) $(this).show();
    });
    updateCounts();
  });

  // CII Checkbox
  $('input:checkbox#cIIOnly').off().change(function() {
    let isChecked = this.checked;
    let columnIndex = $thead.find('th:contains("C II")').index();
    $tbody.find('tr').each(function() {
      let ciiNum = $(this).find(`td:eq(${columnIndex})`).text();
      ciiNum = parseInt(ciiNum);
      if (isChecked && ciiNum === 0)  $(this).hide();
      if (!isChecked && ciiNum === 0) $(this).show();
    });
    updateCounts();
  });
  
  // CIII-V Checkbox
  $('input:checkbox#cIIIVOnly').off().change(function() {
    let isChecked = this.checked;
    let columnIndex = $thead.find('th:contains("C III-V")').index();
    $tbody.find('tr').each(function() {
      let cother = $(this).find(`td:eq(${columnIndex})`).text();
      cother = parseInt(cother);
      if (isChecked && cother === 0)  $(this).hide();
      if (!isChecked && cother === 0) $(this).show();
    });
    updateCounts();
  });
  
  // Adds sorting
  pharmacy.addTableBehaviors(EWD, $table);

  $('#modal-window').modal({
    backdrop: true,
    keyboard: true,
    focus: true,
    show: true
  });
  
  $('#modal-window').one('shown.bs.modal',function() {
    // Update counts needs to be called at the end because it operates on
    // visible rows only
    updateCounts();
    $.getScript('/ewd-vista/assets/javascripts/jQDateRangeSlider-min.js')
      .done( () => {
        $('<link>').appendTo('head').attr({
          type: 'text/css',
          rel:  'stylesheet',
          href: '/ewd-vista/assets/stylesheets/classic.css',
        });
        $('#slider').dateRangeSlider();
      });
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
