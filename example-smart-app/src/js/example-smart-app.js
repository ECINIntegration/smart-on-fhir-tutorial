(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

    function onReady(smart)  {
      if (smart.hasOwnProperty('patient')) {
        
        var patient = smart.patient;
        
        var pt = patient.read();
        
        var obv = smart.patient.api.fetchAll({
          type: 'Observation',
          query: {
            code: {
              $or: ['http://loinc.org|8302-2', 'http://loinc.org|8462-4',
                    'http://loinc.org|8480-6', 'http://loinc.org|2085-9',
                    'http://loinc.org|2089-1', 'http://loinc.org|55284-4']
            }
          }
        });
        
        var im = smart.patient.api.fetchAll({
          type: 'Immunization'
        });
        
        var dr = smart.patient.api.fetchAll({
          type: 'DiagnosticReport'
        });
        
        var ma = smart.patient.api.fetchAll({
          type: 'MedicationAdministration'
        });
        
        var mo = smart.patient.api.fetchAll({
          type: 'MedicationOrder'
        });
        
        var ms = smart.patient.api.fetchAll({
          type: 'MedicationStatement'
        });
        
        /*
        var allobv = smart.patient.api.fetchAll({
          type: 'Observation'
        });
        var docref = smart.patient.api.fetchAll({
          type: 'DocumentReference'
        });*/
        
        $.when(pt, obv, im, dr, ma, mo, ms).fail(onError);

        $.when(pt, obv, im, dr, ma, mo, ms).done(function(patient, obv, imm, diagRpt, medicAdmin, medicOrder, medicStmnt) {
          var byCodes = smart.byCodes(obv, 'code');
          var gender = patient.gender;
          var dob = new Date(patient.birthDate);
          var day = dob.getDate();
          var monthIndex = dob.getMonth() + 1;
          var year = dob.getFullYear();

          var dobStr = monthIndex + '/' + day + '/' + year;
          var fname = '';
          var lname = '';

          if (typeof patient.name[0] !== 'undefined') {
            fname = patient.name[0].given.join(' ');
            lname = patient.name[0].family.join(' ');
          }

          var height = byCodes('8302-2');
          var systolicbp = getBloodPressureValue(byCodes('55284-4'),'8480-6');
          var diastolicbp = getBloodPressureValue(byCodes('55284-4'),'8462-4');
          var hdl = byCodes('2085-9');
          var ldl = byCodes('2089-1');

          var pid = patient.id;
          var tkn = smart.tokenResponse;
          
          var p = defaultPatient();
          p.birthdate = dobStr;
          p.gender = gender;
          p.fname = fname;
          p.lname = lname;
          p.age = parseInt(calculateAge(dob));
          p.height = getQuantityValueAndUnit(height[0]);

          if (typeof systolicbp != 'undefined')  {
            p.systolicbp = systolicbp;
          }

          if (typeof diastolicbp != 'undefined') {
            p.diastolicbp = diastolicbp;
          }

          p.hdl = getQuantityValueAndUnit(hdl[0]);
          p.ldl = getQuantityValueAndUnit(ldl[0]);

          p.imms = buildImmunizations(imm);
          p.diagRpts = buildDiagnosticReportList(diagRpt, pid, tkn);
          p.medicOrders = buildMedicationOrderList(medicOrder);
          p.medicAdmins = buildMedicationAdministrationList(medicAdmin);
          p.medicStmnts = buildMedicationStatementList(medicStmnt);

          ret.resolve(p);
        });
      } else {
        onError();
      }
    }

    FHIR.oauth2.ready(onReady, onError);
    
    return ret.promise();

  };

  function defaultPatient(){
    return {
      fname: {value: ''},
      lname: {value: ''},
      gender: {value: ''},
      birthdate: {value: ''},
      age: {value: ''},
      height: {value: ''},
      systolicbp: {value: ''},
      diastolicbp: {value: ''},
      ldl: {value: ''},
      hdl: {value: ''},
      imms: {value: ''},
      diagRpts: {value: ''},
      medicOrders: {value: ''},
      medicAdmins: {value: ''},
      medicStmnts: {value: ''},
    };
  }

  function immunization(){
    return {
      date: {value: ''},
      textstatus: {value: ''},
      textdiv: {value: ''},
    };
  }

  function diagnosticReport(){
    return {
      status: {value: ''},
      result: {value: ''},
      patid: {value: ''},
      accesstkn: {value: ''},
      forms: {value: ''},
    };
  }

  function diagnosticForm(){
    return {
      url: {value: ''},
      contenttype: {value: ''},
    };
  }
  
  function medicationOrder(){
    return {
      date: {value: ''},
      text: {value: ''},
      status: {value: ''},
    };
  }

  function medicationAdministration(){
    return {
      date: {value: ''},
      dosage: {value: ''},
      text: {value: ''},
      status: {value: ''},
    };
  }

  function medicationStatement(){
    return {
      date: {value: ''},
      dosage: {value: ''},
      text: {value: ''},
      status: {value: ''},
    };
  }
  
  function buildImmunizations(imm){
    var immunuzations = new Array();;
          
    if(imm != null && Array.isArray(imm)) {
      for (var i = 0; i < imm.length; i++) {
        var im = new immunization();
        im.date = imm[i].date;
        if(imm[i].text != null){
          im.textstatus = imm[i].text.status;
          im.textdiv = imm[i].text.div;
        }else if(imm[i].vaccineCode != null){
          im.textstatus = '';
          im.textdiv = imm[i].vaccineCode.text;
        }else{
          im.textstatus = '';
          im.textdiv = '';
        }
        immunuzations.push(im);
      }
    }

    return immunuzations;
  }

  function buildDiagnosticReportList(diagRpt, pid, tkn){
    var diagnosticReports = new Array();
          
    if(diagRpt != null && Array.isArray(diagRpt)) {
            
      for (var i = 0; i < diagRpt.length; i++) {
        
        var dRpt = new diagnosticReport();
        
        dRpt.status = diagRpt[i].status;
        dRpt.patid = pid;
        dRpt.accesstkn = tkn.access_token;
        
        if(diagRpt[i].text != null){
          dRpt.result = diagRpt[i].text.div;
        }else if(diagRpt[i].result != null && Array.isArray(diagRpt[i].result)){
          dRpt.result = joinDiagnosticReportResults(diagRpt[i].result);
        }else{
          dRpt.result = '';
        }

        dRpt.forms = buildForms(diagRpt[i].presentedForm);
        
        diagnosticReports.push(dRpt);
      }
            
    }
    
    return diagnosticReports;
  }

  function joinDiagnosticReportResults(results){
    var diagnosticResults = '';
    if(results != null && Array.isArray(results)) {
      for (var i = 0; i < results.length; i++) {   
        if(results[i].display != null && results[i].reference != null) {
          diagnosticResults = diagnosticResults + ' ' + results[i].display + ' (' + results[i].reference +  ')<br>'
        }
      }
    }
    return diagnosticResults;
  }
  
  function buildForms(form){
    var diagnosticForms = new Array();
    
    if(form != null && Array.isArray(form)) {
      for (var i = 0; i < form.length; i++) {
        var diagForm = new diagnosticForm();
        diagForm.url = form[i].url;
        diagForm.contenttype = form[i].contentType;
        diagnosticForms.push(diagForm);        
      }
    }      
    return diagnosticForms;
  }
    
  function buildMedicationOrderList(medicOrders){
    var medicationOrders = new Array();
          
    if(medicOrders != null && Array.isArray(medicOrders)) {
            
      for (var i = 0; i < medicOrders.length; i++) {
        var medicOrder = new medicationOrder();
        
        medicOrder.date = medicOrders[i].dateWritten;
        medicOrder.status = medicOrders[i].status;
        
        if(medicOrders[i].text != null){
          medicOrder.text = medicOrders[i].text.div;
        }else if(medicOrders[i].medicationReference != null){
          medicOrder.text = medicOrders[i].medicationReference.display;
        }else if(medicOrders[i].medicationCodeableConcept != null){
          medicOrder.text = medicOrders[i].medicationCodeableConcept.text;
        }else{
          medicOrder.text = '';
        }
        
        medicationOrders.push(medicOrder);
        
      }
    }
    
    return medicationOrders;
  }
  
  function buildMedicationAdministrationList(medicAdmins){
    var medicationAdministrations = new Array();
          
    if(medicAdmins != null && Array.isArray(medicAdmins)) {
            
      for (var i = 0; i < medicAdmins.length; i++) {

        var medicAdmin = new medicationAdministration();
        
        medicAdmin.date = medicAdmins[i].effectiveTimeDateTime;
        medicAdmin.status = medicAdmins[i].status;
        
        if(medicAdmins[i].dosage != null){
          medicAdmin.dosage = medicAdmins[i].dosage.text;
        }else{
          medicAdmin.dosage = '';
        }
        
        if(medicAdmins[i].text != null){
          medicAdmin.text = medicAdmins[i].text.div;
        }else if(medicAdmins[i].medicationCodeableConcept != null){
          medicAdmin.text = medicAdmins[i].medicationCodeableConcept.text;
        }else{
          medicAdmin.text = '';
        }
        
        medicationAdministrations.push(medicAdmin);        
      }
    }
    
    return medicationAdministrations;
  }
  
  function buildMedicationStatementList(medicStmnts){
    var medicationStatements = new Array();
          
    if(medicStmnts != null && Array.isArray(medicStmnts)) {
            
      for (var i = 0; i < medicStmnts.length; i++) {
        var medicStmnt = new medicationStatement();
        
        medicStmnt.date = medicStmnts[i].dateAsserted;
        medicStmnt.status = medicStmnts[i].status;
        
        if(medicStmnts[i].dosage != null && Array.isArray(medicStmnts[i].dosage)){
          medicStmnt.dosage = joinMedicationStatementDosages(medicStmnts[i].dosage);
        }else{
          medicStmnt.dosage = '';
        }
        
        if(medicStmnts[i].text != null){
          medicStmnt.text = medicStmnts[i].text.div;
        }else if(medicStmnts[i].medicationReference != null){
          medicStmnt.text = medicStmnts[i].medicationReference.display;
        }else if(medicStmnts[i].medicationCodeableConcept != null){
          medicStmnt.text = medicStmnts[i].medicationCodeableConcept.text;
        }else{
          medicStmnt.text = '';
        }
        
        medicationStatements.push(medicStmnt);
        
      }
    }
    
    return medicationStatements;
  }

  function joinMedicationStatementDosages(dosages){
    var statementDosages = '';
    if(dosages != null && Array.isArray(dosages)) {
      for (var i = 0; i < dosages.length; i++) {
        if(dosages[i].text != null) {
          statementDosages = statementDosages + ' ' + dosages[i].text + '<br>'
        }
      }
    }
    return statementDosages;
  }
  
  function getBloodPressureValue(BPObservations, typeOfPressure) {
    var formattedBPObservations = [];
    BPObservations.forEach(function(observation){
      var BP = observation.component.find(function(component){
        return component.code.coding.find(function(coding) {
          return coding.code == typeOfPressure;
        });
      });
      if (BP) {
        observation.valueQuantity = BP.valueQuantity;
        formattedBPObservations.push(observation);
      }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
  }

  function isLeapYear(year) {
    return new Date(year, 1, 29).getMonth() === 1;
  }

  function calculateAge(date) {
    if (Object.prototype.toString.call(date) === '[object Date]' && !isNaN(date.getTime())) {
      var d = new Date(date), now = new Date();
      var years = now.getFullYear() - d.getFullYear();
      d.setFullYear(d.getFullYear() + years);
      if (d > now) {
        years--;
        d.setFullYear(d.getFullYear() - 1);
      }
      var days = (now.getTime() - d.getTime()) / (3600 * 24 * 1000);
      return years + days / (isLeapYear(now.getFullYear()) ? 366 : 365);
    }
    else {
      return undefined;
    }
  }

  function getQuantityValueAndUnit(ob) {
    if (typeof ob != 'undefined' &&
        typeof ob.valueQuantity != 'undefined' &&
        typeof ob.valueQuantity.value != 'undefined' &&
        typeof ob.valueQuantity.unit != 'undefined') {
          return ob.valueQuantity.value + ' ' + ob.valueQuantity.unit;
    } else {
      return undefined;
    }
  }
  
  function buildImmunizationsTable(imms) {
    
    var tbl = document.getElementById('tblImmunizations');
    
    if(imms != null && Array.isArray(imms) && imms.length > 0) {
      
      for (var i = 0; i < imms.length; i++) {
        
        var row0 = document.createElement('tr');
        var cell0 = document.createElement('td');
        cell0.innerHTML =  imms[i].date;
        cell0.style.textAlign = "left";
        cell0.style.verticalAlign = "top";
        row0.appendChild(cell0);
        var cell1 = document.createElement('td');
        cell1.innerHTML =  imms[i].textdiv;
        cell1.style.textAlign = "left";
        cell1.style.verticalAlign = "top";
        row0.appendChild(cell1);
        tbl.appendChild(row0);
        
      }
      
    }else{
      
      var row = document.createElement('tr');
      var cell = document.createElement('td');
      cell.textContent = "N/A";
      cell.style.textAlign = "center";
      cell.style.verticalAlign = "top";
      row.appendChild(cell);
      tbl.appendChild(row);
      
    }

  }
  
  function buildDiagnosticsReportTable(diagRpts) {
    var tbl = document.getElementById('tblDiagnosticsReports');
    
    if(diagRpts != null && Array.isArray(diagRpts) && diagRpts.length > 0) {
      for (var i = 0; i < diagRpts.length; i++) {
        var row0 = document.createElement('tr');
        
        var cell0 = document.createElement('td');
        cell0.innerHTML =  diagRpts[i].status;
        cell0.style.textAlign = "left";
        cell0.style.verticalAlign = "top";
        row0.appendChild(cell0);        

        var cell1 = document.createElement('td');
        cell1.innerHTML =  diagRpts[i].result;
        cell1.style.textAlign = "left";
        cell1.style.verticalAlign = "top";
        row0.appendChild(cell1);
        
        if(diagRpts[i].forms != null && Array.isArray(diagRpts[i].forms)) {
          var cell = document.createElement('td');
          cell.style.textAlign = "left";
          cell.style.verticalAlign = "top";
          
          var k = 0
          var tkn = diagRpts[i].accesstkn;
          
          for (var j = 0; j < diagRpts[i].forms.length; j++) {
            var type = diagRpts[i].forms[j].contenttype;
            if(type == 'text/html')
            {
              //html docs only
              k = k + 1;
              var url = diagRpts[i].forms[j].url;
              var a = document.createElement('a');
              var linkText = document.createTextNode('Form ' + k.toString());
              a.appendChild(linkText);
              a.title = 'Form ' + k.toString();
              //a.href = 'javascript: getDocument("' + tkn + '", "' +  url + '", "' +  type + '");'
              a.href = '#';

              a.onclick = (function(tkn, url, type){
                return function(){
                  getDocument(tkn, url, type);
                }
              })(tkn, url, type); //Immediately-Invoked Function Expression (IIFE)
              
              cell.appendChild(a);
              var space = document.createTextNode(" ");
              cell.appendChild(space);
            }
          }
          row0.appendChild(cell);
        }
        
        tbl.appendChild(row0); 
      }
    }else{
      var row = document.createElement('tr');
      var cell = document.createElement('td');
      cell.textContent = "N/A";
      cell.style.textAlign = "center";
      cell.style.verticalAlign = "top";
      row.appendChild(cell);
      tbl.appendChild(row); 
    }
  }

  function buildMedicationOrderTable(medicOrders) {
    var tbl = document.getElementById('tblMedicationOrders');
    
    if(medicOrders != null && Array.isArray(medicOrders) && medicOrders.length > 0) {
      for (var i = 0; i < medicOrders.length; i++) {
        var row0 = document.createElement('tr');
        
        var cell0 = document.createElement('td');
        cell0.innerHTML =  medicOrders[i].status;
        cell0.style.textAlign = "left";
        cell0.style.verticalAlign = "top";
        row0.appendChild(cell0);        

        var cell1 = document.createElement('td');
        cell1.innerHTML =  medicOrders[i].date;
        cell1.style.textAlign = "left";
        cell1.style.verticalAlign = "top";
        row0.appendChild(cell1);
        
        var cell2 = document.createElement('td');
        cell2.innerHTML =  medicOrders[i].text;
        cell2.style.textAlign = "left";
        cell2.style.verticalAlign = "top";
        row0.appendChild(cell2);
        
        tbl.appendChild(row0); 
      }
    }else{
      var row = document.createElement('tr');
      var cell = document.createElement('td');
      cell.textContent = "N/A";
      cell.style.textAlign = "center";
      cell.style.verticalAlign = "top";
      row.appendChild(cell);
      tbl.appendChild(row); 
    }
  }

  function buildMedicationAdministrationTable(medicAdmins) {
    var tbl = document.getElementById('tblMedicationAdministration');
    
    if(medicAdmins != null && Array.isArray(medicAdmins) && medicAdmins.length > 0) {
      for (var i = 0; i < medicAdmins.length; i++) {
        var row0 = document.createElement('tr');
        
        var cell0 = document.createElement('td');
        cell0.innerHTML =  medicAdmins[i].status;
        cell0.style.textAlign = "left";
        cell0.style.verticalAlign = "top";
        row0.appendChild(cell0);        

        var cell1 = document.createElement('td');
        cell1.innerHTML =  medicAdmins[i].date;
        cell1.style.textAlign = "left";
        cell1.style.verticalAlign = "top";
        row0.appendChild(cell1);

        var cell2 = document.createElement('td');
        cell2.innerHTML =  medicAdmins[i].dosage;
        cell2.style.textAlign = "left";
        cell2.style.verticalAlign = "top";
        row0.appendChild(cell2);
        
        var cell3 = document.createElement('td');
        cell3.innerHTML =  medicAdmins[i].text;
        cell3.style.textAlign = "left";
        cell3.style.verticalAlign = "top";
        row0.appendChild(cell3);
        
        tbl.appendChild(row0); 
      }
    }else{
      var row = document.createElement('tr');
      var cell = document.createElement('td');
      cell.textContent = "N/A";
      cell.style.textAlign = "center";
      cell.style.verticalAlign = "top";
      row.appendChild(cell);
      tbl.appendChild(row); 
    }
  }

  function buildMedicationStatementTable(medicStmnts) {
    var tbl = document.getElementById('tblMedicationStatements');
    
    if(medicStmnts != null && Array.isArray(medicStmnts) && medicStmnts.length > 0) {
      for (var i = 0; i < medicStmnts.length; i++) {
        var row0 = document.createElement('tr');
        
        var cell0 = document.createElement('td');
        cell0.innerHTML = medicStmnts[i].status;
        cell0.style.textAlign = "left";
        cell0.style.verticalAlign = "top";
        row0.appendChild(cell0);        

        var cell1 = document.createElement('td');
        cell1.innerHTML = medicStmnts[i].date;
        cell1.style.textAlign = "left";
        cell1.style.verticalAlign = "top";
        row0.appendChild(cell1);

        var cell2 = document.createElement('td');
        cell2.innerHTML = medicStmnts[i].dosage;
        cell2.style.textAlign = "left";
        cell2.style.verticalAlign = "top";
        row0.appendChild(cell2);
        
        var cell3 = document.createElement('td');
        cell3.innerHTML = medicStmnts[i].text;
        cell3.style.textAlign = "left";
        cell3.style.verticalAlign = "top";
        row0.appendChild(cell3);
        
        tbl.appendChild(row0); 
      }
    }else{
      var row = document.createElement('tr');
      var cell = document.createElement('td');
      cell.textContent = "N/A";
      cell.style.textAlign = "center";
      cell.style.verticalAlign = "top";
      row.appendChild(cell);
      tbl.appendChild(row); 
    }
  }
  
  window.drawVisualization = function(p) {
    $('#holder').show();
    $('#loading').hide();
    $('#fname').html(p.fname);
    $('#lname').html(p.lname);
    $('#gender').html(p.gender);
    $('#birthdate').html(p.birthdate);
    $('#age').html(p.age);
    $('#height').html(p.height);
    $('#systolicbp').html(p.systolicbp);
    $('#diastolicbp').html(p.diastolicbp);
    $('#ldl').html(p.ldl);
    $('#hdl').html(p.hdl);

    buildDiagnosticsReportTable(p.diagRpts);    
    buildImmunizationsTable(p.imms);   
    buildMedicationOrderTable(p.medicOrders);
    buildMedicationAdministrationTable(p.medicAdmins);
    buildMedicationStatementTable(p.medicStmnts)
  };

  window.getDocument = function(accessToken, url, type) {
    
    var jwt = accessToken;
    
    var xmlHttpRequest = new XMLHttpRequest();
    
    xmlHttpRequest.onreadystatechange = function () {
      if (xmlHttpRequest.readyState == 4) {//Done
        console.log('xmlHttpRequest.status: ' + xmlHttpRequest.status);
        if (xmlHttpRequest.status === 200) {
          var content = xmlHttpRequest.response;
          //document.getElementById('ifrmDoc').src = 'data:text/html;charset=utf-8,' + escape(content);
          document.getElementById('ifrmDoc').srcdoc = content;
          document.getElementById('ifrmDoc').setAttribute('style', 'display: block');
        }else{
          console.error('No document returned');
        }
      }
    };

    xmlHttpRequest.open('GET', url, true);
    xmlHttpRequest.setRequestHeader('Authorization', 'Bearer ' + jwt);
    //xmlHttpRequest.setRequestHeader('Accept', 'application/json+fhir');
    xmlHttpRequest.setRequestHeader('Accept', type);
    xmlHttpRequest.send('');
  };
  
})(window);
