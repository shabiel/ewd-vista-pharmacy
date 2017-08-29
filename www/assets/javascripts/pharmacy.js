var pharmacy = {};

pharmacy.prep = function(EWD) {
  pharmacy.landingPage(EWD);
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

    // When a patient is selected!
    $('.fileman-autocomplete').on('filemanautocompleteselect', function(event, ui) {
      let DFN = ui.item.ien;
      let params = {
        service: 'ewd-vista-pharmacy',
        name: 'patient.html',
        targetId: 'main-content'
      };

      EWD.getFragment(params, function() {
        pharmacy.populatePatientPage(EWD,DFN);
      });
    });

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
        totalCount += +$(this).text();
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
        EWD.send(params, function(res) {pharmacy.drawOutpatientPatientsTable(EWD, res.message);});
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
  EWD.send(params, function(res) {
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
  EWD.send(params, function(res)  {
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
  Object.keys(tableData).map(function(type) {
    let typeName = type === 'C' ? 'Clinic' : 'Ward Group';
    t.append(
      '<tr><th colspan="5">' + typeName + '</th></tr>'
    );

    // For each clinic/ward
    Object.keys(tableData[type]).map(function(name) {
      //Add the name in the first cell
      t.append('<tr>');
      t.append('<td>' + name + '</td>');

      // Then each ^ piece after that as IV/UD/IV/UD

      let itemArray = tableData[type][name].toString().split('^');
      for (var itemIndex in itemArray)
      {
        // IVs are in position 0 and 2; UDs in 1 and 3
        // NB: || 0 is to change empty strings to zero.
        countIV += itemIndex % 2 ? 0 : parseInt(itemArray[itemIndex] || 0);
        countUD += itemIndex % 2 ? parseInt(itemArray[itemIndex] || 0) : 0;
        t.append('<td>' + tableData[type][name].toString().split('^')[itemIndex] + '</td>');
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
  Object.keys(tableData).forEach(function(ien) {
    tableData[ien].clinicSortGroupsSpans = '';
    if (tableData[ien].clinicSortGroups.length > 0) {
      for (let clinicSortGroupIndex in tableData[ien].clinicSortGroups) {
        let clinicSortGroup = tableData[ien].clinicSortGroups[clinicSortGroupIndex];
        tableData[ien].clinicSortGroupsSpans += '<span id=' + clinicSortGroup.ien + '>' + clinicSortGroup.name + '</span>';
      }
    }
  });
  // For each ward group or clinic
  let row = '';
  Object.keys(tableData).forEach(function(ien) {
    row += '<tr id=' + ien + '>' +
           '<td>' + tableData[ien].clinicSortGroupsSpans + '</td>' +
           '<td>' + tableData[ien].name + '</td>' +
           '<td id=' + tableData[ien].institutionIEN + '>' +
           tableData[ien].institutionName + '&nbsp;' +
           '<span class="badge">' + tableData[ien].institutionCount + '</span>' +
           '</td>' +
           '<td>' + tableData[ien].earliestOrderDateTime + '</td>' +
           '<td>' + tableData[ien].latestOrderDateTime + '</td>' +
           '<td>' + tableData[ien].flagged + '</td>';
    row += '<td>';
    Object.keys(tableData[ien].routing).forEach(function(pickup) {
      row += pickup + ': ' + tableData[ien].routing[pickup] + '<br />';
    });
    row += '</td>';
    row += '<td>' + tableData[ien].count + '</td>' +
           '</tr>';
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
      EWD.send(params, function(res) {pharmacy.drawOutpatientPatientsTable(EWD, res.message);});
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
  t.find('tr > *:nth-child(' + (columnIndex + 1) + ')').hover(
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
      EWD.send(params, function(res) {pharmacy.drawOutpatientPatientsTable(EWD, res.message);});
    });
  });

  // Add clickable links, second, to clinic sort group
  $th = $table.find('th#sortGroups');
  columnIndex = $th.index();

  // Underline on hover
  t.find('tr > *:nth-child(' + (columnIndex + 1) + ') span').hover(
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
      EWD.send(params, function(res) {pharmacy.drawOutpatientPatientsTable(EWD, res.message);});
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
  drawData.header.forEach(function(eachHeader) {$thead.append('<th>' + 
        eachHeader + '&nbsp;<i class="fa fa-caret-up sortable" aria-hidden="true"></i></th>');
  }
  );

  // tableRow lets us add html to it before we put it on the page
  let tableRow = '';

  // combinedProviders and Classes add up the cumulative providers and
  // classes for each patient for use in filtering.
  let combinedProviders = {};
  let combinedDrugs = {};
  let combinedClasses = {};

  // NB: This is the main drawing loop!
  drawData.data.forEach(function(datum, index) {
    let sortedMetaProviders = Object.keys(drawData.metaProviders[index]).map(function(key) { return drawData.metaProviders[index][key]; }).sort();
    let sortedMetaDrugs = Object.keys(drawData.metaDrugs[index]).map(function(key) { return drawData.metaDrugs[index][key]; }).sort();
    let sortedMetaVaDrugClasses = Object.keys(drawData.metaVaDrugClasses[index]).sort();
    sortedMetaProviders.forEach(function(one) {combinedProviders[one] = '';});
    sortedMetaDrugs.forEach(function(one) {combinedDrugs[one] = '';});
    sortedMetaVaDrugClasses.forEach(function(one) {combinedClasses[one] = drawData.metaVaDrugClasses[index][one];});
    // Datum 0 is the DFN. We add it then get rid of it.
    // tr has data stuff we use for filtering.
    tableRow += '<tr id="' + datum[0] +'" ';
    tableRow += 'data-providers=\'' + JSON.stringify(sortedMetaProviders) + '\' ';
    tableRow += 'data-classes=\'' + JSON.stringify(sortedMetaVaDrugClasses) + '\' ';
    tableRow += 'data-drugs=\'' + JSON.stringify(sortedMetaDrugs) + '\' ';
    tableRow += 'data-renewals=\'' + drawData.renewals[index] + '\' ';
    tableRow += 'data-nonformulary=\'' + drawData.nonFormulary[index] + '\' ';
    tableRow += 'data-earliestordertime=\'' + Number(drawData.earliestOrdersTimes[index]).dateFromTimson() + '\' ';
    tableRow += 'data-latestordertime=\'' + Number(drawData.latestOrdersTimes[index]).dateFromTimson() + '\' ';
    tableRow += '>';
    datum.shift(); // Get rid of DFN
    datum.forEach(function(item) {tableRow += '<td>' + item + '</td>';});
    tableRow += '</tr>';
  });

  $tbody.append(tableRow);
  
  // Get the arrays from the keys
  let combinedProvidersArray = Object.keys(combinedProviders);
  let combinedDrugsArray     = Object.keys(combinedDrugs);
  let combinedVaClassesArray = Object.keys(combinedClasses);

  // Sort
  combinedProvidersArray.sort();
  combinedDrugsArray.sort();
  combinedVaClassesArray.sort();

  // Put the sorted objects into the drop down boxes on the page
  // Providers
  $('#provider').empty();
  $('#provider').append(new Option('', ''));
  combinedProvidersArray.forEach(function(one) {$('#provider').append(new Option(one, one));});
  // Drugs
  $('#drug').empty();
  $('#drug').append(new Option('', ''));
  combinedDrugsArray.forEach(function(one) {$('#drug').append(new Option(one, one));});
  // and then classes
  $('#class').empty();
  $('#class').append(new Option('', ''));
  combinedVaClassesArray.forEach(function(one) {$('#class').append(new Option(one + ' - ' + combinedClasses[one], one));});

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

  // To show filters
  $('h4 i.fa-caret-right').off().click(function(){
    $(this).toggleClass('fa-caret-right fa-caret-down');
    $('div#filters').slideToggle();
  });

  // Filter the table based on select of these
  var changeFunction = function() {
    $tbody.find(' * ').show();
    let provider = $('#provider').val();
    let drug     = $('#drug').val();
    let vaclass  = $('#class').val();
    $tbody.find('tr').each(function() {
      provArray = $(this).data().providers;
      classArray = $(this).data().classes;
      drugArray = $(this).data().drugs;
      if (vaclass !== '' && !classArray.includes(vaclass)) $(this).hide();
      if (provider !== '' && !provArray.includes(provider)) $(this).hide();
      if (drug    !== ''  && !drugArray.includes(drug)) $(this).hide();
    });
    updateCounts();
  };

  $('#provider').off().change(changeFunction);
  $('#drug').off().change(changeFunction);
  $('#class').off().change(changeFunction);

  // == Checkboxes ==
  // Clear checkboxes and reset dropdowns
  $('a#clearChecks').off().click(function() {
    $tbody.find(' * ').show();
    $('#filters input:checkbox').prop('checked', false);
    $('#provider').prop('selectedIndex', 0);
    $('#drug').prop('selectedIndex', 0);
    $('#class').prop('selectedIndex', 0);
    configureDateRange();
  });
  
  // Window/Inhouse Checkbox
  $('input:checkbox#winOnly').off().change(function() {
    let isChecked = this.checked;
    let columnIndex = $thead.find('th:contains("WINDOW")').index();
    $tbody.find('tr').each(function() {
      let winNum = $(this).find('td:eq(' + columnIndex + ')').text();
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
      let mailNum = $(this).find('td:eq(' + columnIndex + ')').text();
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
      let ciiNum = $(this).find('td:eq(' + columnIndex + ')').text();
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
      let cother = $(this).find('td:eq(' + columnIndex + ')').text();
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
  
  // Date time range picker stuff
  $('#modal-window').one('shown.bs.modal',function() {
    // Update counts needs to be called at the end because it operates on
    // visible rows only
    updateCounts();
    // TODO: Figure out how to manage dependency on moment.js
    // & daterangepicker using npm.
    $.getScript('/ewd-vista/assets/javascripts/moment.js')
      .done( function() {
        $.getScript('/ewd-vista/assets/javascripts/daterangepicker.js')
          .done( function() {
            $('<link>').appendTo('head').attr({
              type: 'text/css',
              rel:  'stylesheet',
              href: '/ewd-vista/assets/stylesheets/daterangepicker.css',
            });

            configureDateRange();
          });
      });
  });

  var configureDateRange = function() {
    let startAndStop = dateRange();
    $('input[name="daterange"]').daterangepicker({
      startDate: startAndStop.minDate,
      endDate: startAndStop.maxDate,
      minDate: startAndStop.minDate,
      maxDate: startAndStop.maxDate,
      timePicker: true,
      timePickerIncrement: 1,
      timePickerSeconds: true,
      locale: { format: 'YYYY/MM/DD hh:mm A' },
    },
    function(start, end, label) {
      hideDatesNotInRange(start, end);
    });
  };

  // Date Range finder
  var dateRange = function() {
    // https://stackoverflow.com/questions/11526504/minimum-and-maximum-date
    let maxPossibleDate = new Date(8640000000000000);
    let minPossibleDate = new Date(-8640000000000000);
    
    let earliestDate = maxPossibleDate;
    let lastDate = minPossibleDate;
    $tbody.find('tr').each(function() {
      let startDate = new Date($(this).data().earliestordertime);
      
      if (earliestDate > startDate) earliestDate = startDate;
      if (lastDate < startDate)   lastDate = startDate;
    });

    return {minDate: earliestDate, maxDate: lastDate};
  };

  var hideDatesNotInRange = function(start, end) {
    $tbody.find(' * ').show();
    $tbody.find('tr').each(function() {
      let earlyDate = new Date($(this).data().earliestordertime);
      if (earlyDate < start) $(this).hide();
      if (earlyDate > end  ) $(this).hide();
    });

    updateCounts();
  };
  
  // Clicking on a patient
  $tbody.find('tr').click(function(e) {
    let DFN = this.id;
    let params = {
      service: 'ewd-vista-pharmacy',
      name: 'patient.html',
      targetId: 'main-content'
    };

    EWD.getFragment(params, function() {
      $('#modal-window').html('');
      $('#modal-window').modal('hide');

      pharmacy.populatePatientPage(EWD,DFN);
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
    let that = this;
    thisTable.find('tbody tr').sort(function(a,b) {
      // Get column index of the clicked triangle
      let columnIndex = $(that).closest('th').index();

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


pharmacy.populatePatientPage = function(EWD,DFN) {

  // Demographics
  let messageObj;
  messageObj = {
    service: 'ewd-vista-pharmacy',
    type: 'getPatientDemographics',
    params: { DFN: DFN },
  };

  EWD.send(messageObj, function(res) {
    let demographics = res.message;
    $('.patient-info h2 #patientName').html(demographics.name);
    $('.patient-info h2 #typeOfCare').html(demographics.episodeType);
    $('.patient-info p  #dob').html(demographics.DOB);
    $('.patient-info p  #age').html(demographics.age);
    $('.patient-info p  #primary-id').html(demographics.ID);
    $('.patient-info p  #sex').html(demographics.sex);
    $('.patient-info p  #ht').html(demographics.height);
    $('.patient-info p  #wt').html(demographics.weight);
    $('.patient-info p  #crcl').html(demographics.crcl);
    $('.patient-info p  #bsa').html(demographics.BSA);
    if (demographics.episodeType == 'Inpatient') {
      $('.patient-info #room-bed-div #room-bed').html(demographics.bed);
    }
    else {
      $('.patient-info #room-bed-div').hide();
    }
  });

  // Allergies
  messageObj = {
    service: 'ewd-vista-pharmacy',
    type: 'getPatientAllergies',
    params: { DFN: DFN },
  };

  EWD.send(messageObj, function(res) {
    let $adr = $('#patientInfoTabContent #adr');
    if (!res.message.data) {
      $adr.html('<strong>' + res.message.status + '</strong>');
      return;
    }
    
    $adr.html('<table class="table"><thead></thead><tbody></tbody></table>');
    $thead = $adr.find('table thead');
    $tbody = $adr.find('table tbody');

    let theading = '<tr>';
    for (let h in res.message.headers) theading += '<th>' + res.message.headers[h] + '</th>';
    theading += '</tr>';
    $thead.html(theading);
    console.log('foo');

    res.message.data.forEach( function(datum)
    {
      let row = '<tr id="' + datum[0] + '">';
      datum.shift();
      datum.forEach( function(cell) { row += '<td>' + cell + '</td>'; });
      row += '</tr>';
      $tbody.append(row);
    });
  });


  // Outpatient and non-VA meds
  messageObj = {
    service: 'ewd-vista-pharmacy',
    type: 'getOutpatientMedications',
    params: { DFN: DFN },
  };

  EWD.send(messageObj, function(res) {
    let $opList = $('#medicationList div#outpatient ul');
    let $nvList = $('#medicationList div#outside ul');

    Object.keys(res.message).forEach(function(key) {
      let legendhtml= '<legend>' + key + '</legend>';
      if (key !== 'ZNONVA') {
        $opList.append(legendhtml);
      }
      res.message[key].forEach(function(item) {
        let itemhtml = '<li>' + item + '</li>';
        if (key === 'ZNONVA') {
          $nvList.append(itemhtml);
        }
        else {
          $opList.append(itemhtml);
        }
      });
    });

    if(!$opList.find('li').length) {
      $opList.append('<legend>No medications found</legend>');
    }
    if(!$nvList.find('li').length) {
      $nvList.append('<legend>No medications found</legend>');
    }
  });

  // Inpatient
  messageObj = {
    service: 'ewd-vista-pharmacy',
    type: 'getInpatientMedications',
    params: { DFN: DFN },
  };

  EWD.send(messageObj, function(res) {
    let $ipList = $('#medicationList div#inpatient ul');
    Object.keys(res.message).forEach(function(key) {
      let legendhtml= '<legend>' + key + '</legend>';
      $ipList.append(legendhtml);
      res.message[key].forEach(function(item) {
        let itemhtml = '<li>' + item + '</li>';
        $ipList.append(itemhtml);
      });
    });

    if(!$ipList.find('li').length) {
      $ipList.append('<legend>No medications found</legend>');
    }
  });

  // Vitals
  // Inpatient
  messageObj = {
    service: 'ewd-vista-pharmacy',
    type: 'getLatestVitals',
    params: { DFN: DFN },
  };
  EWD.send(messageObj, function(res) {
    let $vitals = $('#patientInfoTabContent #vitals');
    if (!res.message.data.length) {
      $vitals.html('<strong>No vitals found</strong>');
      return;
    }
    $vitals.html('<table class="table"><thead></thead><tbody></tbody></table>');
    $thead = $vitals.find('table thead');
    $tbody = $vitals.find('table tbody');

    let theading = '<tr>';
    for (let h in res.message.headers) theading += '<th>' + res.message.headers[h] + '</th>';
    theading += '</tr>';
    $thead.html(theading);
    console.log('foo');

    res.message.data.forEach(function(datum) 
    {
      let row = '<tr id="' + datum[0] + '">';
      datum.shift();
      datum.forEach(function(cell) {row += '<td>' + cell + '</td>';});
      row += '</tr>';
      $tbody.append(row);
    });
  });
};

