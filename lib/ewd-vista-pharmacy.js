/* Set-up module.export.handlers structure */
let vista = require('ewd-vista');
require('ewd-vista/lib/mFunctions');
module.exports          = {};
module.exports.handlers = {};

//TODO: Move this logic to a central location
module.exports.init = function() {
  if (!this.db.symbolTable) this.db.symbolTable = this.sessions.symbolTable(this.db);
  // Additions for VistA to the core QEWD Symbol Table Code
  var that = this;
  if (!this.db.symbolTable.set) this.db.symbolTable.set = function (MName, value) {
    that.db.function({function: 'SetVar^ewdVistAUtils', arguments: [MName, value]});
  };

  if (!this.db.symbolTable.get) this.db.symbolTable.get = function (MName, value) {
    return that.db.function({function: 'GetVar^ewdVistAUtils', arguments: [MName] }).result;
  };
};

// Get Inpatient Pharmacy Orders Summary
module.exports.handlers.inpatientOrdersSummary = function(messageObj, session, send, finished) {
  this.db.symbolTable.restore(session);
  this.db.function({function: 'D^ewdVistAUtils', arguments: ['ENCV^PSGSETU']});
  this.db.function({function: 'SetVar^ewdVistAUtils', arguments: ['IOSL', '999999']});
  this.db.function({function: 'D^ewdVistAUtils', arguments: ['CNTORDRS^PSGVBWU']});
  let dashboardData = new this.documentStore.DocumentNode('TMP',['PSJ',process.pid]).getDocument();
  finished(dashboardData);
  //Intentionally not saving the symbol table
};

// Get Outpatient Pharmacy Orders Summary
module.exports.handlers.outpatientOrdersSummary = function(messageObj, session, send, finished) {
  var aclIX = new this.documentStore.DocumentNode('PS',['52.41','ACL']);

  var counts = {};

  aclIX.forEachChild( (clinic, node) =>
    node.forEachChild( (fmdt, node2) =>
      node2.forEachChild( (ien, node3) => {
        var z = new this.documentStore.DocumentNode('PS',['52.41',ien,0]).value;
        if (!z) return;
        if (!['NW','RNW','RF'].includes(z.$p(3))) return;  // New, Renew, Refills only. No DCs etc.
        var hospitalLocationIEN = z.$p(13);
		var orderPlacementDate =  parseFloat(z.$p(12));
        var flagged = z.$p(23);
        var institutionIEN = new this.documentStore.DocumentNode('PS',['52.41',ien,'INI']).value.toString();
        if (institutionIEN) institutionIEN = institutionIEN.$p(1);
        if (!institutionIEN) {
          var divisionIEN = new this.documentStore.DocumentNode('SC',[hospitalLocationIEN, 0]).value.$p(15);
          institutionIEN = new this.documentStore.DocumentNode('DG', ['40.8',divisionIEN,0]).value.$p(7);
        }

        // Grab sort groups
        var clinicSortGroups = [];
        new this.documentStore.DocumentNode('PS',['59.8']).forEachChild({range: {from: 1, to: ' '}}, (sortGroupIEN, sortNode) => {
          if (sortNode.$("1").$("B").$(hospitalLocationIEN).exists) clinicSortGroups.push(sortNode.$(0).value.$p(1))
        });

        var institutionName = new this.documentStore.DocumentNode('DIC', [4, institutionIEN, 0]).value.$p(1);

        // This takes too long...
        //var hospitalLocationName = this.db.function({function: 'EXTERNAL^DILFD', arguments: ['52.41','1.1','',hospitalLocationIEN]}).result;
        // Replacement:
        var hospitalLocationName = new this.documentStore.DocumentNode('SC',[hospitalLocationIEN, 0]).value.$p(1);

        if (counts[hospitalLocationIEN] === undefined) {
          counts[hospitalLocationIEN] = {};
          counts[hospitalLocationIEN].ien  = hospitalLocationIEN;
          counts[hospitalLocationIEN].name = hospitalLocationName;
          counts[hospitalLocationIEN].institutionName  = institutionName;
          counts[hospitalLocationIEN].institutionIEN   = institutionIEN;
          counts[hospitalLocationIEN].clinicSortGroups = clinicSortGroups;
          counts[hospitalLocationIEN].count = 0;
		  counts[hospitalLocationIEN].flagged = 0;
		  counts[hospitalLocationIEN].earliestOrderDateTime = Number.POSITIVE_INFINITY;
		  counts[hospitalLocationIEN].latestOrderDateTime   = Number.NEGATIVE_INFINITY;
        }
        counts[hospitalLocationIEN].count++;
		if (flagged) counts[hospitalLocationIEN].flagged++;
		if (orderPlacementDate < counts[hospitalLocationIEN].earliestOrderDateTime) {
          counts[hospitalLocationIEN].earliestOrderDateTime = orderPlacementDate;
		}
		if (orderPlacementDate > counts[hospitalLocationIEN].latestOrderDateTime) {
		  counts[hospitalLocationIEN].latestOrderDateTime = orderPlacementDate;
		}
      })
      )
    );

  // Transform Fileman dates into Human Readable Ones
  Object.keys(counts).map( (IEN) => {
    let d = counts[IEN].earliestOrderDateTime;
    counts[IEN].earliestOrderDateTime = this.db.function({function: 'FMTE^XLFDT', arguments: [d, '7Z']}).result;

    d = counts[IEN].latestOrderDateTime;
    counts[IEN].latestOrderDateTime   = this.db.function({function: 'FMTE^XLFDT', arguments: [d, '7Z']}).result;
  });

  finished(counts);
};

module.exports.handlers.outpatientOrdersByClinic = function(messageObj, session, send, finished) {

  let aclIX = new this.documentStore.DocumentNode('PS',['52.41','ACL', messageObj.params.hospitalLocationIEN]);

  let patients = {};

  this.db.symbolTable.restore(session);

  aclIX.forEachChild((fmdt, node) => {
    node.forEachChild((ien, node2) => {
      let z = new this.documentStore.DocumentNode('PS',['52.41',ien,0]).value;
      if (!z) return;
      if (!['NW','RNW','RF'].includes(z.$p(3))) return;  // New, Renew, Refills only. No DCs etc.
      let hospitalLocationIEN = z.$p(13);
      let dfn = z.$p(2);
      let orderPlacementDate =  parseFloat(z.$p(12));
      this.db.symbolTable.set('DFN', dfn);
      this.db.function({function: 'D^ewdVistAUtils', arguments: ['PID^VADPT']});
      let bid = this.db.symbolTable.get('VA("BID")');

      let name = this.db.function({function: 'GET1^DIQ', arguments: ['2', dfn, '.01']}).result;
      let dob  = this.db.function({function: 'GET1^DIQ', arguments: ['2', dfn, 'DOB']}).result;
      let routeName = this.db.function({function: 'GET1^DIQ', arguments: ['52.41', ien, 'PICKUP ROUTING']}).result;
      let priorityName = this.db.function({function: 'GET1^DIQ', arguments: ['52.41', ien, 'PRIORITY']}).result;
      let flagged = this.db.function({function: 'GET1^DIQ', arguments: ['52.41', ien, 'FLAG', 'I']}).result;
      let flagReason;
      if (flagged) flagReason = this.db.function({function: 'GET1^DIQ', arguments: ['52.41', ien, 'REASON FOR FLAG']}).result;

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
	    patients[dfn].earliestOrderDateTime = Number.POSITIVE_INFINITY;
      }
      patients[dfn].count++;
	  if (orderPlacementDate < patients[dfn].earliestOrderDateTime) {
	    patients[dfn].earliestOrderDateTime = orderPlacementDate;
	  }

      if (patients[dfn].routing[routeName] === undefined) patients[dfn].routing[routeName] = 0;
      patients[dfn].routing[routeName]++;

      if (patients[dfn].priority[priorityName] === undefined) patients[dfn].priority[priorityName] = 0;
      patients[dfn].priority[priorityName]++;

      if (flagged) {
        patients[dfn].flagged++;
        patients[dfn].flagReasons.push(`<i class="fa fa-flag" title="${flagReason}"></i>`);
      }

      if (isC2) patients[dfn].c2++;
      if (isC345) patients[dfn].c345++;
    });
  });

  Object.keys(patients).map( (dfn) => {
    console.log(patients[dfn].earliestOrderDateTime);
	var now = this.db.function({function: 'NOW^XLFDT'}).result;
    var elpased = this.db.function({
	  function:  'FMDIFF^XLFDT',
	  arguments: [now, patients[dfn].earliestOrderDateTime, 3]
	}).result;
	patients[dfn].timeElpased = elpased;
  });

  let header = [];
  header.push('Name (PID)');
  header.push('DOB');
  header.push('Priority /STAT');
  header.push('Routing /WINDOW');
  header.push('Routing /MAIL');
  header.push('Schedule II');
  header.push('Schedule III-V');
  header.push('Flags');
  header.push('Time since Earliest');
  header.push('TOTAL');

  let data = [];

  Object.keys(patients).forEach(dfn => {
    let datum = [];
    datum.push(
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
    data.push(datum);
  });

  let finalResult = {header: header, data: data};
  finished(finalResult);
};
