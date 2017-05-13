/* Set-up module.export.handlers structure */
module.exports          = {};
module.exports.handlers = {};

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
        if (!z.$p(13)) return; // Must have clinic. Redundant check as record won't exist w/o it.
        var hospitalLocationIEN = z.$p(13);
        var institutionIEN = this.db.function({function: 'GET1^DIQ', arguments: ['44', hospitalLocationIEN, 'DIVISION:INSTITUTION FILE POINTER', 'I']}).result;
        var duz2 = this.db.function({function: 'GetVar^ewdVistAUtils', arguments: ['DUZ(2)']}).result;
        if (duz2 !== institutionIEN) return;
        var hospitalLocationName = this.db.function({function: 'EXTERNAL^DILFD', arguments: ['52.41','1.1','',hospitalLocationIEN]}).result;
        if (counts[hospitalLocationIEN] === undefined) {
          counts[hospitalLocationIEN] = {};
          counts[hospitalLocationIEN].ien = hospitalLocationIEN;
          counts[hospitalLocationIEN].name = hospitalLocationName;
          counts[hospitalLocationIEN].count = 0;
        }
        counts[hospitalLocationIEN].count++;
      })
      )
    );
  finished(counts);
};
