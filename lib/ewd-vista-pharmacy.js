// ICR 10103 for *^XLFDT functions used throughout)
// Various other ICRs/IAs are noted where they are used
/* Load infrastructure */
let vista = require('ewd-vista');

/* Set-up module.export.handlers structure */
module.exports          = {};
module.exports.handlers = {};

/* Sets up Symbol Table management
 * Called when module is loaded by QEWD */
module.exports.init = function() {
  vista.init.call(this);
};

// Pre handler security checks - security keys mainly
module.exports.beforeHandler = vista.beforeHandler;

// Get Inpatient Pharmacy Orders Summary
// Call CNTORDRS^PSGVBWU API in Inpatient Package
// IOSL must be large because this guy pages using ^DIR
module.exports.handlers.inpatientOrdersSummary = function(messageObj, session, send, finished) {
  this.db.symbolTable.restore(session);
  this.db.procedure({procedure: 'ENCV^PSGSETU'});
  this.db.symbolTable.setVar('IOSL', '999999');
  this.db.procedure({procedure: 'CNTORDRS^PSGVBWU'});
  let dashboardData = new this.documentStore.DocumentNode('TMP',['PSJ',process.pid]).getDocument();
  finished(dashboardData);
  //Intentionally not saving the symbol table
};

// Get Outpatient Pharmacy Orders Summary
// Search ACL index in 52.41
// IA 10103 for FMTE^XLFDT
module.exports.handlers.outpatientOrdersSummary = function(messageObj, session, send, finished) {
  var aclIX = new this.documentStore.DocumentNode('PS',['52.41','ACL']);

  var clinicCounts = {};
  var institutionCounts = {};

  aclIX.forEachChild( (clinic, node) =>
    node.forEachChild( (fmdt, node2) =>
      node2.forEachChild( (ien, node3) => {
        var z = new this.documentStore.DocumentNode('PS',['52.41',ien,0]).value;
        if (!z) return;
        if (!['NW','RNW','RF'].includes(z.$p(3))) return;  // New, Renew, Refills only. No DCs etc.
        var hospitalLocationIEN = z.$p(13);
        var orderPlacementDate =  parseFloat(z.$p(12));
        var flagged = z.$p(23);
        var institutionIEN = new this.documentStore.DocumentNode('PS',['52.41',ien,'INI']).value;
        if (institutionIEN) institutionIEN = institutionIEN.$p(1);
        if (!institutionIEN) {
          var divisionIEN = new this.documentStore.DocumentNode('SC',[hospitalLocationIEN, 0]).value.$p(15);
          institutionIEN = new this.documentStore.DocumentNode('DG', ['40.8',divisionIEN,0]).value.$p(7);
        }

        let routeName = z.$p(17);

        // Grab sort groups
        var clinicSortGroups = [];
        new this.documentStore.DocumentNode('PS',['59.8']).forEachChild({range: {from: 1, to: ' '}}, (sortGroupIEN, sortNode) => {
          if (sortNode.$('1').$('B').$(hospitalLocationIEN).exists) {
            var clinicSortGroup = {};
            clinicSortGroup.name = sortNode.$(0).value.$p(1);
            clinicSortGroup.ien = sortGroupIEN;
            clinicSortGroups.push(clinicSortGroup);
          }
        });

        var institutionName = new this.documentStore.DocumentNode('DIC', [4, institutionIEN, 0]).value.$p(1);

        // This takes too long...
        //var hospitalLocationName = this.db.function({function: 'EXTERNAL^DILFD', arguments: ['52.41','1.1','',hospitalLocationIEN]}).result;
        // Replacement:
        var hospitalLocationName = new this.documentStore.DocumentNode('SC',[hospitalLocationIEN, 0]).value.$p(1);

        if (clinicCounts[hospitalLocationIEN] === undefined) {
          clinicCounts[hospitalLocationIEN] = {};
          clinicCounts[hospitalLocationIEN].ien  = hospitalLocationIEN;
          clinicCounts[hospitalLocationIEN].name = hospitalLocationName;
          clinicCounts[hospitalLocationIEN].institutionName  = institutionName;
          clinicCounts[hospitalLocationIEN].institutionIEN   = institutionIEN;
          clinicCounts[hospitalLocationIEN].clinicSortGroups = clinicSortGroups;
          clinicCounts[hospitalLocationIEN].count = 0;
          clinicCounts[hospitalLocationIEN].flagged = 0;
          clinicCounts[hospitalLocationIEN].routing = {};
          clinicCounts[hospitalLocationIEN].earliestOrderDateTime = Number.POSITIVE_INFINITY;
          clinicCounts[hospitalLocationIEN].latestOrderDateTime   = Number.NEGATIVE_INFINITY;
        }
        clinicCounts[hospitalLocationIEN].count++;

        // Count orders for each institution
        if (institutionCounts[institutionIEN] === undefined) institutionCounts[institutionIEN] = 0;
        institutionCounts[institutionIEN]++;

        // Count orders for each route by clinic
        if (clinicCounts[hospitalLocationIEN].routing[routeName] === undefined) clinicCounts[hospitalLocationIEN].routing[routeName] = 0;
        clinicCounts[hospitalLocationIEN].routing[routeName]++;

        if (flagged) clinicCounts[hospitalLocationIEN].flagged++;
        if (orderPlacementDate < clinicCounts[hospitalLocationIEN].earliestOrderDateTime) {
          clinicCounts[hospitalLocationIEN].earliestOrderDateTime = orderPlacementDate;
        }
        if (orderPlacementDate > clinicCounts[hospitalLocationIEN].latestOrderDateTime) {
          clinicCounts[hospitalLocationIEN].latestOrderDateTime = orderPlacementDate;
        }
      })
    )
  );

  // Transform Fileman dates into Human Readable Ones
  // Also, in the same iteration, apply the intitution counts as a datum
  Object.keys(clinicCounts).map( (IEN) => {
    let d = clinicCounts[IEN].earliestOrderDateTime;
    clinicCounts[IEN].earliestOrderDateTime = this.db.function({function: 'FMTE^XLFDT', arguments: [d, '7Z']}).result;

    d = clinicCounts[IEN].latestOrderDateTime;
    clinicCounts[IEN].latestOrderDateTime   = this.db.function({function: 'FMTE^XLFDT', arguments: [d, '7Z']}).result;

    clinicCounts[IEN].institutionCount = institutionCounts[clinicCounts[IEN].institutionIEN];
  });

  finished(clinicCounts);
};

// Walk all of 52.41
module.exports.handlers.outpatientOrdersAll = function(messageObj, session, send, finished) {
  let patients = {};
  this.db.symbolTable.restore(session);
  this.db.use('PS', '52.41').forEachChild({range: {from: 1, to: ' '}}, (ien, node) => {
    processEachOrder.call(this, ien, patients);
  });

  finished(messagePatientData.call(this, patients));
};

// Query 59.8 for sort groups and then by look for orders by clinic (52.41, ACL
// index)
module.exports.handlers.outpatientOrdersByClinicSortGroup = function(messageObj, session, send, finished) {
  let patients = {};
  this.db.symbolTable.restore(session);
  this.db.use('PS', '59.8', messageObj.params.clinicSortGroupIEN, '1').forEachChild((ien2, node) =>
    this.db.use('PS', '52.41', 'ACL', node.$(0).value.$p(1)).forEachChild((fmdt, node2) => 
      node2.forEachChild((ien, node3) => 
        processEachOrder.call(this, ien, patients)
      )
    )
  );

  finished(messagePatientData.call(this, patients));
};

// Query 52.41 for data by institution (AOR index)
module.exports.handlers.outpatientOrdersByInstitution = function(messageObj, session, send, finished) {
  let patients = {};
  this.db.symbolTable.restore(session);
  this.db.use('PS', '52.41', 'AOR').forEachChild((DFN, node) => {
    node.forEachChild((institutionIEN, node2) => {
      if (institutionIEN.toString() !== messageObj.params.institutionIEN) return;
      node2.forEachChild((ien, node3) => processEachOrder.call(this, ien, patients));
    });
  });

  finished(messagePatientData.call(this, patients));
};

// Query 52.41 for data by clinic (ACL index)
module.exports.handlers.outpatientOrdersByClinic = function(messageObj, session, send, finished) {

  let aclIX = new this.documentStore.DocumentNode('PS',['52.41','ACL', messageObj.params.hospitalLocationIEN]);

  let patients = {};

  this.db.symbolTable.restore(session);

  aclIX.forEachChild((fmdt, node) => {
    node.forEachChild((ien, node2) => {
      processEachOrder.call(this, ien, patients);
    });
  });
 
  finished(messagePatientData.call(this, patients));
};


/* Local Helper Functions */

/* Fixes up patient data to be sent in return */
function messagePatientData(patients)
{
  applyTimeElapsed.call(this, patients);
  return createFinalResponseData.call(this, patients);
}

/* Process each Outpatient Pharmacy Order for Display */
// ICR 10061 for PID^VADPT
function processEachOrder(ien, patients)
{
  let z = new this.documentStore.DocumentNode('PS',['52.41',ien,0]).value;
  if (!z) return;
  if (!['NW','RNW','RF'].includes(z.$p(3))) return;  // New, Renew, Refills only. No DCs etc.
  let renewal = z.$p(3) === 'RNW';
  let hospitalLocationIEN = z.$p(13);
  let dfn = z.$p(2);
  let orderPlacementDate =  parseFloat(z.$p(12));
  this.db.symbolTable.setVar('DFN', dfn);
  this.db.procedure({procedure: 'PID^VADPT'});
  let bid = this.db.symbolTable.getVar('VA("BID")');

  let name = this.db.function({function: 'GET1^DIQ', arguments: ['2', dfn, '.01']}).result;
  let dob  = this.db.function({function: 'GET1^DIQ', arguments: ['2', dfn, 'DOB']}).result;
  let routeName = this.db.function({function: 'GET1^DIQ', arguments: ['52.41', ien, 'PICKUP ROUTING']}).result;
  let priorityName = this.db.function({function: 'GET1^DIQ', arguments: ['52.41', ien, 'PRIORITY']}).result;
  let flagged = this.db.function({function: 'GET1^DIQ', arguments: ['52.41', ien, 'FLAG', 'I']}).result;
  let flagNode = this.db.use('PS', '52.41', ien, 'FLG').value;

  // Provider internal and external
  let provider = {};
  this.db.symbolTable.killVar('OUT');
  this.db.procedure({procedure: 'GETS^DIQ', arguments: ['52.41', ien, 'PROVIDER', 'EI', 'OUT']});
  let iens = ien.toString() + ',';
  let provInt = `OUT(52.41,"${iens}","PROVIDER","I")`;
  let provExt = `OUT(52.41,"${iens}","PROVIDER","E")`;
  provider.ien  = this.db.symbolTable.getVar(provInt);
  provider.name = this.db.symbolTable.getVar(provExt);
  
  // Drug internal and external
  let drug = {};
  this.db.symbolTable.killVar('OUT');
  this.db.procedure({procedure: 'GETS^DIQ', arguments: ['52.41', ien, 'DRUG', 'EI', 'OUT']});
  let drugInt = `OUT(52.41,"${iens}","DRUG","I")`;
  let drugExt = `OUT(52.41,"${iens}","DRUG","E")`;
  drug.ien  = this.db.symbolTable.getVar(drugInt);
  drug.name = this.db.symbolTable.getVar(drugExt);

  // VA Drug Class
  let vaDrugClassCode = this.db.function({function: 'GET1^DIQ', arguments: ['52.41', ien, 'DRUG:VA CLASSIFICATION']}).result;
  let vaDrugClassIEN    = this.db.function({function: 'FIND1^DIC', arguments: ['50.605', '', 'QX', vaDrugClassCode]}).result;
  let vaDrugClassName   = this.db.function({function: 'GET1^DIQ', arguments: ['50.605', vaDrugClassIEN, 1]}).result;

  // Non formulary!
  let localNonFormulary = this.db.function({function: 'GET1^DIQ', arguments: ['52.41', ien, 'DRUG:LOCAL NON-FORMULARY', 'I']}).result == '1'; 

  // The flag business
  let flagReason, unflagReason, unflagged;
  
  // Are we flagged?
  if (flagged) flagReason = this.db.function({function: 'GET1^DIQ', arguments: ['52.41', ien, 'REASON FOR FLAG']}).result;
  // Are we UNflagged?
  if (!flagged && flagNode) {
    unflagged = true;
    unflagReason = flagNode.$p(6);
  }

  // I +$P(OR0,"^",9) S PDEA=$P($G(^PSDRUG($P(OR0,"^",9),0)),"^",3),PDEA=$S(PDEA[2:1,PDEA[3!(PDEA[4)!(PDEA[5):2,1:0)
  // E  S PDEA=$$OIDEA^PSSUTLA1($P(OR0,"^",8),"O")
  let drugIEN    = this.db.function({function: 'GET1^DIQ', arguments: ['52.41', ien, 'DRUG', 'I']}).result;
  let oiIEN      = this.db.function({function: 'GET1^DIQ', arguments: ['52.41', ien, 'PHARMACY ORDERABLE ITEM', 'I']}).result;
  let isC2,isC345 = false;
  if (drugIEN) {
    let pdea = this.db.function({function: 'GET1^DIQ', arguments: ['50', drugIEN, 'DEA, SPECIAL HDLG', 'I']}).result.toString();
    if (['2'].some(n => pdea.includes(n))) isC2 = true;
    if (['3','4','5'].some(n => pdea.includes(n))) isC345 = true;
  }
  else {
    let isCS = this.db.function({function: 'OIDEA^PSSUTLA1', arguments: [oiIEN, 'O']}).result;
    if (isCS === 1) isC2 = true;
    if (isCS === 2) isC345 = true;
  }
  // Count for each patient: by priority; by flag; by route; by CS (2 and 345)
  if (patients[dfn] === undefined) {
    patients[dfn] = {};
    patients[dfn].dob = dob;
    patients[dfn].dfn = dfn;
    patients[dfn].bid = bid;
    patients[dfn].name = name;
    patients[dfn].count = 0;
    patients[dfn].flagged = 0;
    patients[dfn].flagReasons = [];
    patients[dfn].priority = {};
    patients[dfn].routing = {};
    patients[dfn].c2 = 0;
    patients[dfn].c345 = 0;
    patients[dfn].providers = {};
    patients[dfn].drugs = {};
    patients[dfn].vaDrugClasses = {};
    patients[dfn].earliestOrderDateTime = Number.POSITIVE_INFINITY;
    patients[dfn].latestOrderDateTime   = Number.NEGATIVE_INFINITY;
    patients[dfn].renewals = 0;
    patients[dfn].nonform = 0;
  }
  patients[dfn].count++;
  if (orderPlacementDate < patients[dfn].earliestOrderDateTime) {
    patients[dfn].earliestOrderDateTime = orderPlacementDate;
  }

  if (orderPlacementDate > patients[dfn].latestOrderDateTime) {
    patients[dfn].latestOrderDateTime = orderPlacementDate;
  }

  patients[dfn].providers[provider.ien] = provider.name;
  patients[dfn].drugs[drug.ien] = drug.name;
  patients[dfn].vaDrugClasses[vaDrugClassCode] = vaDrugClassName;

  if (patients[dfn].routing[routeName] === undefined) patients[dfn].routing[routeName] = 0;
  patients[dfn].routing[routeName]++;

  if (patients[dfn].priority[priorityName] === undefined) patients[dfn].priority[priorityName] = 0;
  patients[dfn].priority[priorityName]++;

  // Ewww... I couldn't figure out a better way to do that rather than embed
  // the html in the return.
  if (flagged) {
    patients[dfn].flagged++;
    patients[dfn].flagReasons.push(`<i class="fa fa-flag flag-red" title="${flagReason}"></i>`);
  }

  if (unflagged) {
    patients[dfn].flagReasons.push(`<i class="fa fa-flag flag-blue" title="${unflagReason}"></i>`);
  }

  if (isC2) patients[dfn].c2++;
  if (isC345) patients[dfn].c345++;
  if (renewal) patients[dfn].renewals++;
  if (localNonFormulary) patients[dfn].nonform++;
}

/* Calculate the time elapsed from the earliest order for the patient */
function applyTimeElapsed(patients) {
  Object.keys(patients).map( (dfn) => {
    var now = this.db.function({function: 'NOW^XLFDT'}).result;
    var elapsed = this.db.function({
      function:  'FMDIFF^XLFDT',
      arguments: [now, patients[dfn].earliestOrderDateTime, 3]
    }).result;
    elapsed = elapsed.split(' ')[0] + 'd' + ' ' + elapsed.split(' ')[1];
    patients[dfn].timeElpased = elapsed;
  });
}

function createFinalResponseData(patients) {
  let header = [];
  header.push('Name (PID)');
  header.push('DOB');
  header.push('STAT');
  header.push('WINDOW');
  header.push('MAIL');
  header.push('C II');
  header.push('C III-V');
  header.push('Flags');
  header.push('Time since Earliest');
  header.push('TOTAL');

  let tableData = [];

  Object.keys(patients).forEach(dfn => {
    let datum = [];
    datum.push(
      patients[dfn].dfn = dfn, // This is deleted after insertion
      patients[dfn].name + ' (' + patients[dfn].bid + ')',
      patients[dfn].dob,
      patients[dfn].priority.EMERGENCY || 0 + patients[dfn].priority.STAT || 0,
      patients[dfn].routing.WINDOW || 0,
      patients[dfn].routing.MAIL || 0,
      patients[dfn].c2,
      patients[dfn].c345,
      patients[dfn].flagReasons.join('\n'),
      patients[dfn].timeElpased,
      patients[dfn].count
    );
    tableData.push(datum);
  });

  let metaProviders = [];
  Object.keys(patients).forEach(dfn => metaProviders.push(patients[dfn].providers));

  let metaDrugs = [];
  Object.keys(patients).forEach(dfn => metaDrugs.push(patients[dfn].drugs));

  let metaVaDrugClasses = [];
  Object.keys(patients).forEach(dfn => metaVaDrugClasses.push(patients[dfn].vaDrugClasses));

  let renewals = [];
  Object.keys(patients).forEach(dfn => renewals.push(patients[dfn].renewals > 0));

  let nonFormulary = [];
  Object.keys(patients).forEach(dfn => nonFormulary.push(patients[dfn].nonform > 0));

  let earliestOrdersTimes = [];
  Object.keys(patients).forEach(dfn => earliestOrdersTimes.push(patients[dfn].earliestOrderDateTime));
  let latestOrdersTimes = [];
  Object.keys(patients).forEach(dfn => latestOrdersTimes.push(patients[dfn].latestOrderDateTime));

  let finalResult = {
    header: header, 
    data: tableData, 
    metaProviders: metaProviders,
    metaDrugs: metaDrugs,
    metaVaDrugClasses: metaVaDrugClasses,
    renewals: renewals,
    nonFormulary: nonFormulary,
    earliestOrdersTimes: earliestOrdersTimes,
    latestOrdersTimes: latestOrdersTimes,
  };

  return finalResult;
}

// Use DEM^VADPT & IN5^VADPT to get the patient demographics (ICR 10061)
// Other information using PSOORUT2 API for List Manager
module.exports.handlers.getPatientDemographics = function(messageObj, session, send, finished) {

  // set DFN and kill the output variables of the VADPT calls.
  this.db.symbolTable.restore(session);
  this.db.symbolTable.setVar('DFN', messageObj.params.DFN);
  this.db.symbolTable.killVar('VADM');
  this.db.symbolTable.killVar('VAIN');
  this.db.symbolTable.killVar('VAIP');
  this.db.symbolTable.killVar('VA');
  this.db.symbolTable.killVar('VAERR');

  // Call VADPT
  this.db.procedure({procedure: 'DEM^VADPT'});
  this.db.procedure({procedure: 'IN5^VADPT'});
  
  // get the Data
  let name = this.db.symbolTable.getVar('VADM(1)');
  let ID   = this.db.symbolTable.getVar('VA("PID")');
  let DOB  = this.db.symbolTable.getVar('VADM(3)').$p(2);
  let age  = this.db.symbolTable.getVar('VADM(4)');
  let sex  = this.db.symbolTable.getVar('VADM(5)').$p(2);
  let admissionIEN = +this.db.symbolTable.getVar('VAIP(1)');
  let episodeType = admissionIEN ? 'Inpatient' : 'Outpatient';
  let bed  = '';
  let ward = '';
  if (admissionIEN) {
    ward = this.db.symbolTable.getVar('VAIP(5)').$p(2);
    bed  = this.db.symbolTable.getVar('VAIP(6)').$p(2);
  }

  // Other information using PSOORUT2 API for List Manager
  this.db.symbolTable.setVar('PSODFN', messageObj.params.DFN);
  this.db.procedure({procedure: '^PSOORUT2'});

  let weight = this.db.use('TMP', 'PSOHDR', process.pid, 6, 0).value;
  let height = this.db.use('TMP', 'PSOHDR', process.pid, 7, 0).value;
  let BSA    = this.db.use('TMP', 'PSOHDR', process.pid,12, 0).value;
  let crcl   = this.db.use('TMP', 'PSOHDR', process.pid,13, 0).value.$p(2,'CrCL: ');

  // And send back
  finished({
    name: name,
    ID: ID,
    DOB: DOB,
    age: age,
    sex: sex,
    episodeType: episodeType,
    ward: ward,
    bed: bed,
    height: height,
    weight: weight,
    BSA: BSA,
    crcl: crcl, 
  });
};

// Get VA information (eligibilities + disability rating + Patient Status)
// Disabilities obtained using ICR 4807 combined with ICR 142
// Eligibility using ICR 10061 ELIG^VAPDT
module.exports.handlers.getPatientVAInfo = function(messageObj, session, send, finished) {
  this.db.symbolTable.restore(session);

  // Patient status stanza
  // $$GET1^DIQ(55,PSODFN,3)
  let rxStatus = this.db.function({function: 'GET1^DIQ',
    arguments: [55, messageObj.params.DFN, 3]}).result;
  
  // Disabilities stanza
  //ICR 4807
  let ratedDisabilities = new Object();
  ratedDisabilities.headers = new Array();
  ratedDisabilities.headers.push('Disability', 'Disability %', 'SC?', 'Extremeity');
  ratedDisabilities.data = new Array();
  this.db.symbolTable.killVar('DGARR');
  this.db.symbolTable.setVar('DGDFN', messageObj.params.DFN);
  this.db.function({function: 'D^ewdVistAUtils', arguments: 
      ['RDIS^DGRPDB(DGDFN,.DGARR)']});

  for (let i = '';;) {
    i = this.db.symbolTable.getVar(`$O(DGARR("${i}"))`);
    if (i === '') break;
    // return: 370^30^1^^^
    // piece 1 - Disability IEN (in file 31)
    // piece 2 - Disability %
    // piece 3 - SC? (1,0)
    // piece 4 - extremity affected
    // piece 5 - original effective date
    // piece 6 - current effective date
    //
    let datum = this.db.symbolTable.getVar(`DGARR("${i}")`);
    let ien = datum.$p(1);
    let name = this.db.function({function: 'GET1^DIQ',
      arguments: [31, ien , .01]}).result;
    let percentage = datum.$p(2);
    let sc = +datum.$p(3) ? true : false;
    let extremity = datum.$p(4);
    let row = [];
    row.push(ien, name, percentage, sc, extremity);
    ratedDisabilities.data.push(row);
  }

  // Eligibilities Stanza
  // ICR 10061
  this.db.symbolTable.setVar('DFN', messageObj.params.DFN);
  this.db.symbolTable.killVar('VAEL');
  this.db.symbolTable.killVar('VAERR');
  this.db.procedure({procedure: 'ELIG^VADPT'});
  
  let eligibility = {};
  eligibility.type = this.db.symbolTable.getVar('VAEL(1)').$p(2);
  eligibility.scPercentage = this.db.symbolTable.getVar('VAEL(3)').$p(2);

  // ES6 object literal, instead of rxStatus: rxStatus
  finished({rxStatus, ratedDisabilities, eligibility});
};

// Get allergies using ICR 10099 EN2^GMRADPT
module.exports.handlers.getPatientAllergies = function(messageObj, session, send, finished) {
  this.db.symbolTable.restore(session);
  this.db.symbolTable.setVar('DFN', messageObj.params.DFN);
  this.db.symbolTable.killVar('GMRA');
  this.db.symbolTable.killVar('GMRAL');
  this.db.procedure({procedure: 'EN2^GMRADPT'});
  
  let adrs = [];
  let mainStatusOutput = this.db.symbolTable.getVar('GMRAL');
  let mainStatusHuman;
  if (mainStatusOutput === '') {
    mainStatusHuman = 'No Allergy Assessment';
    finished({status: mainStatusHuman});
    return;
  }
  else if (+mainStatusOutput === 0) {
    mainStatusHuman = 'No Known Allergies';
    finished({status: mainStatusHuman});
    return;
  }
  else {
    // M for loop on a local
    for (let i = '""';;) {
      i = this.db.symbolTable.getVar(`$O(GMRAL(${i}))`);
      if (i === '') break;
      let datum = this.db.symbolTable.getVar(`GMRAL(${i})`);
      // piece 1 is the DFN
      let reactant =  datum.$p(2);
      // piece 3 is not used
      let verified =  this.db.function({function: 'EXTERNAL^DILFD',
        arguments: ['120.8', '19', '', datum.$p(4)]}).result;
      let isAllergy = +datum.$p(5) ? true : false;
      let allergyType = this.db.function({function: 'EXTERNAL^DILFD',
        arguments: ['120.8', '3.1', '', datum.$p(7)]}).result;
      let mechanism = datum.$p(8).$p(1,';');
      // Piece 9 is the pointer to the allergen
      let obsHist = datum.$p(10).$p(1,';');

      let signsSymptoms = [];
      for (let j = '""';;) {
        j = this.db.symbolTable.getVar(`$O(GMRAL(${i},"S",${j}))`);
        if (j === '') break;
        let datum = this.db.symbolTable.getVar(`GMRAL(${i},"S",${j})`);
        let reaction = datum.$p(1).$p(1,';');
        signsSymptoms.push(reaction);
      }

      let siteInfo = this.db.symbolTable.getVar(`$G(GMRAL(${i},"SITE"))`);
      let remoteSiteNameNStation = '';
      if (siteInfo) remoteSiteNameNStation = siteInfo.$p(2) + ' (' + siteInfo.$p(3).toString() + ') ';

      let adr = [];
      adr.push(i); //ien
      adr.push(reactant);
      adr.push(signsSymptoms);
      adr.push(allergyType);
      adr.push(verified);
      adr.push(mechanism);
      adr.push(obsHist);
      adr.push(remoteSiteNameNStation);
      adrs.push(adr);
    }
  }
  finished({
    status: `${adrs.length} ADRs present`,
    headers: [ 'Reactant', 'Signs and Symptoms', 'Allergy Type', 'Verified',
      'Mechanism', 'Observed/Historical',
      'Remote Allergy Source' ],
    data: adrs,
  });
};

// Use IA 1641 for remote procedure ORQQAL DETAIL
module.exports.handlers.adrDetailsByIEN = function(messageObj, session, send, finished) {
  this.db.symbolTable.restore(session);
  this.db.function({function: 'D^ewdVistAUtils', arguments: 
      [`DETAIL^ORQQAL(.ORAY,,${messageObj.params.adrIEN})`]});

  let result = [];
  for (let i = 1; i !== ''; i = this.db.symbolTable.getVar(`$O(ORAY(${i}))`)) {
    result.push(this.db.symbolTable.getVar(`ORAY(${i})`));
  }
  finished(result);
};
// Code uses ^PSOBUILD to get outpatient medications
// MY package. No ICR necessary.
module.exports.handlers.getOutpatientMedications = function(messageObj, session, send, finished) {
  let result = {};
  this.db.symbolTable.restore(session);
  this.db.symbolTable.setVar('PSODFN', messageObj.params.DFN);
  let today = this.db.symbolTable.getVar('DT');
  let cutDate = this.db.function({
    function: 'FMADD^XLFDT',
    arguments: [today, -120]
  }).result;
  this.db.symbolTable.setVar('PSODTCUT', cutDate);
  this.db.procedure({procedure:'^PSOBUILD'});

  for (let medStatus = '';;) {
    medStatus = this.db.symbolTable.getVar(`$O(PSOSD("${medStatus}"))`);
    if (medStatus === '') break;
    result[medStatus] = [];
    for (let medName = '';;) {
      medName = this.db.symbolTable.getVar(`$O(PSOSD("${medStatus}","${medName}"))`);
      if (medName === '') break;
      result[medStatus].push(medName);
    }
  }
  finished(result);
};

// Translates orderType abbreviation into a text
// See TXT^PSJO and TF^PSJLMHED
function orderTypeTextHelper(orderType) {
  let orderTypeText = '';
  switch (true) {
    case orderType === 'A': // fallthrough intended
    case orderType === 'DF': orderTypeText = this.db.function({function: 'TXT^PSJO', arguments: [ orderType ] }).result; break;
    case orderType.indexOf('CC') > -1: orderTypeText = this.db.function({function: 'TXT^PSJO', arguments: [ 'PR' ] }).result; break;
    case orderType.indexOf('CD') > -1: orderTypeText = this.db.function({function: 'TXT^PSJO', arguments: [ 'PC' ] }).result; break;
    case orderType.indexOf('C') > -1: orderTypeText = this.db.function({function: 'TXT^PSJO', arguments: [ 'P' ] }).result; break;
    case orderType.indexOf('BD') > -1: orderTypeText = this.db.function({function: 'TXT^PSJO', arguments: [ 'NC' ] }).result; break;
    case orderType.indexOf('B') > -1: orderTypeText = this.db.function({function: 'TXT^PSJO', arguments: [ 'N' ] }).result; break;
    case orderType === 'O': orderTypeText = this.db.function({function: 'TXT^PSJO', arguments: [ 'NA' ] }).result; break;
  }
  return orderTypeText;
}

// Code uses EN^PSJO1. My package; no ICR necessary.
module.exports.handlers.getInpatientMedications = function(messageObj, session, send, finished) {
  // In Mumps:
  // D ENCV^PSGSETU S PSGP=100798 D ^PSJAC S PSGOL="S" D EN^PSJO1
  // ^TMP("PSG",8534,"A","C","AMIODARONE TAB^1U")=""
  // ^TMP("PSG",8534,"A","O","KETOROLAC TROMETHAMINE INJ^4U")=""
  // ^TMP("PSG",8534,"A","P","IBUPROFEN TAB^2U")=""
  // ^TMP("PSG",8534,"A","R","TRIAMCINOLONE CREAM,TOP^3U")=""
  let result = new Object();
  this.db.symbolTable.restore(session);
  this.db.procedure({procedure: 'ENCV^PSGSETU'});
  this.db.symbolTable.setVar('PSGP', messageObj.params.DFN);
  this.db.symbolTable.setVar('PSGOL', 'S');
  this.db.procedure({procedure: '^PSJAC'});
  this.db.procedure({procedure: 'EN^PSJO1', arguments: [ '3' ]});
  
  this.db.use('TMP', 'PSJ', process.pid).forEachChild((orderType) => {
    let orderTypeText = '';
    let clinicData = '';
    let resultOrderType = ''; // We do this to put it in the result for clinics (Convert Cz^clinic name^^ to just Cz for presentation)
    // See Routines TXT^PSJO and TF^PSJLMHED for the orderType translation. No table
    // there that is just reusable that I can call directly
    switch (true) {
      case orderType.$p(1) === 'Cz': clinicData = orderType; resultOrderType = 'Cz'; break; 
      default: orderTypeText = orderTypeTextHelper.call(this, orderType); resultOrderType = orderType;
    }

    result[resultOrderType] = {};

    if (clinicData) {
      result[resultOrderType].clinicName = clinicData.$p(2);
      result[resultOrderType].clinicSortPosition = clinicData.$p(3);
      let clinicOrderType = clinicData.$p(4);
      // This call is repeated, b/c the the order type is embedded in the 4th
      // piece.
      orderTypeText = orderTypeTextHelper.call(this, clinicOrderType);
    }
    result[resultOrderType].orderTypeText = orderTypeText;
    result[resultOrderType].medicationData = {};
    this.db.use('TMP', 'PSJ', process.pid, orderType).forEachChild((medType, node) =>{
      let medTypeText = '';
      switch (medType) {
        case 'z': // This shows up, and is presented by pharmacy as "Continous"... Oh well!
        case 'C': medTypeText = 'Continuous'; break;
        case 'P': medTypeText = 'PRN'; break;
        case 'R': medTypeText = 'Fill on Request'; break;
        case 'O': medTypeText = 'One-Time'; break;
        case 'OC': medTypeText = 'On Call'; break;
        default: break;
      }
      result[resultOrderType].medicationData[medTypeText] = new Array();
      node.forEachChild((med_n_on) => result[resultOrderType].medicationData[medTypeText].push(med_n_on.$p(1)));
    });
  });
  finished(result);
};

// ICR 1647: RPC ORQQVI VITALS
module.exports.handlers.getLatestVitals = function(messageObj, session, send, finished) {
  this.db.symbolTable.restore(session);
  this.db.symbolTable.killVar('ZZZ');
  this.db.symbolTable.setVar('DFN', messageObj.params.DFN);
  this.db.function({function: 'D^ewdVistAUtils', arguments: ['FASTVIT^ORQQVI(.ZZZ,DFN)']});

  result = new Object();
  result.headers = new Array();
  result.dataTypes = new Array();
  result.headers.push('Type', 'Imperial Value', 'Metric Value', 'Time Taken');
  result.dataTypes.push('string', 'string', 'string', 'date');
  result.data = new Array();
  if (this.db.symbolTable.getVar('$O(ZZZ(0))')) {
    for (let i = 1; i !== ''; i = this.db.symbolTable.getVar(`$O(ZZZ(${i}))`)) {
      let vital = this.db.symbolTable.getVar(`ZZZ(${i})`);
      let ien = vital.$p(1);
      let type = vital.$p(2);
      let datetime = vital.$p(4);
      let imperial = vital.$p(5);
      let metric = vital.$p(6);
      let datum = new Array();
      datum.push(ien);
      datum.push(type);
      datum.push(imperial);
      datum.push(metric);
      datum.push(Number(datetime).dateFromTimson());

      result.data.push(datum);
    }
  }
  finished(result);
};

// IA 2503 for D RR^LR7OR1(DFN,,,,"CH",,,1000)
module.exports.handlers.getLatestLabs = function(messageObj, session, send, finished) {
  this.db.symbolTable.restore(session);
  this.db.procedure({procedure: 'RR^LR7OR1', arguments: [messageObj.params.DFN, '', '', '', 'CH', '', '', 1000]});
  result = new Object();
  result.headers = new Array();
  result.dataTypes = new Array();
  result.headers.push('Lab Name', 'Value-Units', 'Flag', 'Range', 'Time Taken');
  result.dataTypes.push('string', 'string', 'string', 'string', 'date');
  result.data = new Array();
  //^TMP("LRRR",2862,2,"CH",7039179.897657,51.6) = 210^2.3^^ug/mL^10 - 20^F^^^81235.0000^Dilantin^99NLT^10958^^T^DILANTI^TOX 0819 4^^^72
  this.db.use('TMP', 'LRRR', process.pid, messageObj.params.DFN, 'CH').forEachChild((inverseDate, node) => {
    node.forEachChild((num, node2) => {
      if (!node2.hasValue) return; // could be a comment node
      let v = node2.value;
      let timsonDate = 9999999.999999-inverseDate;
      let printName = v.$p(15);
      let dateTime = Number(timsonDate).dateFromTimson();
      let labValue = v.$p(2);
      let flag = v.$p(3);
      let units = v.$p(4);
      let range = v.$p(5);
      let datum = [];
      datum.push(num, printName, labValue + ' ' + units, flag, range, dateTime);
      result.data.push(datum);
    });
  });
  this.db.use('TMP', 'LRRR', process.pid).delete();
  finished(result);
};

// IA 3198 for D CONTEXT^TIUSRVLO(.ZZZ,3,1,4,"","",100,"D")
module.exports.handlers.getLatestNotes = function(messageObj, session, send, finished) {
  result = new Object();
  result.headers = new Array();
  result.dataTypes = new Array();
  result.headers.push('Title', 'Date/Time', 'Author', 'Location');
  result.dataTypes.push('string', 'date', 'string', 'string');
  result.data = new Array();
  this.db.symbolTable.restore(session);
  this.db.procedure({procedure: 'CONTEXT^TIUSRVLO', arguments: ['', 3, 1, messageObj.params.DFN, '', '', '', 100, 'D']});
  this.db.use('TMP', 'TIUR', process.pid).forEachChild((recNum, node) => {
    let v = node.value;
    let ien = v.$p(1);
    let title = v.$p(2);
    let dateTime = Number(v.$p(3)).dateFromTimson();
    let author = v.$p(5).$p(3,';');
    let noteLocation = v.$p(6);
    let datum = [ien, title, dateTime, author, noteLocation];
    result.data.push(datum);
  });
  this.db.use('TMP', 'TIUR', process.pid).delete();
  finished(result);
};

// IA 1635 for D TGET^TIUSRVR1(.ZZZ,11359)
module.exports.handlers.getNoteText = function(messageObj, session, send, finished) {
  let result = [];
  this.db.procedure({procedure: 'TGET^TIUSRVR1', arguments: ['', messageObj.params.noteIEN]});
  
  this.db.use('TMP', 'TIUVIEW', process.pid).forEachChild((num, node) => {
    result.push(node.value);
  });
  this.db.use('TMP', 'TIUVIEW', process.pid).delete();
  finished(result);
};

/*
  Copyright 2017 Sam Habiel, Pharm.D.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.;
*/
