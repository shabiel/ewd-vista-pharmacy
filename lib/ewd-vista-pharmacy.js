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

module.exports.handlers.outpatientOrdersAll = function(messageObj, session, send, finished) {
  let patients = {};
  this.db.symbolTable.restore(session);
  this.db.use('PS', '52.41').forEachChild({range: {from: 1, to: ' '}}, (ien, node) => {
    processEachOrder.call(this, ien, patients);
  });

  finished(messagePatientData.call(this, patients));
};

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
