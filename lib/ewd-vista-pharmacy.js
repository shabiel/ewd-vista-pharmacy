/* Set-up module.export.handlers structure */
module.exports          = {};
module.exports.handlers = {};

// Get orders Summary dashboard
module.exports.handlers.ordersSummaryDashboard = function(messageObj,  session, send, finished) {
  this.db.symbolTable.restore(session);
  this.db.function({function: 'D^ewdVistAUtils', arguments: ['ENCV^PSGSETU']});
  this.db.function({function: 'SetVar^ewdVistAUtils', arguments: ['IOSL=999999']});
  this.db.function({function: 'D^ewdVistAUtils', arguments: ['CNTORDRS^PSGVBWU']});
  let dashboardData = new this.documentStore.DocumentNode('TMP',['PSJ',process.pid]).getDocument();
  finished(dashboardData);
  //Intentionally not saving the symbol table
};

// Get tasks from ^%ZTSK
module.exports.handlers.tasks = function(messageObj, session, send, finished) {
  let dateTimeHorolog = this.db.function({function: 'GetVar^ewdVistAUtils', arguments: ['$H']}).result;
  let dateHorolog = dateTimeHorolog.piece(1,',');

  let tasksNode = new this.documentStore.DocumentNode('%ZTSK');

  tasksNode.forEachChild(function(subscript, node) {
    if (subscript > 0) {
      let task = {};
      task.number = subscript;
      task.fields = node.getDocument();

      let taskStatus = task.fields['0.1'] ? task.fields['0.1'].$p(1) : task.fields['.1'].$p(1);

      if (taskStatus != '6') {
        send({task: task});
      }
    }
  });

  finished({});
};
