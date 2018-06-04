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
        
        var imm = smart.patient.api.fetchAll({
                    type: 'Immunization'
                  });
        
        var diagRpt = smart.patient.api.fetchAll({
                    type: 'DiagnosticReport'
                  });

        $.when(pt, obv, imm, diagRpt).fail(onError);

        $.when(pt, obv, imm, diagRpt).done(function(patient, obv, imm, diagRpt) {
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

          p.imms = immunuzations;
          
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
      reference: {value: ''},
    };
  }
  
  function buildDiagnosticReportList(diagRpt){
    var diagnosticReports = new Array();;
          
    if(diagRpt != null && Array.isArray(diagRpt)) {
            
      for (var i = 0; i < diagRpt.length; i++) {
        var dRpt = new diagnosticReport();
        dRpt.status = diagRpt[i].status;
        if(diagRpt[i].text != null){
          dRpt.reference = '';
          dRpt.result = diagRpt[i].text.div;
        }else if(diagRpt[i].result != null && Array.isArray(diagRpt[i].result)){
          dRpt.textstatus = '';
          dRpt.textdiv = '';
        }else{
          dRpt.reference = '';
          dRpt.result = '';
        }
        
        diagnosticReports.push(dRpt);
      }
            
    }
    
    return diagnosticReports;
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
    
    if(imms != null && Array.isArray(imms)) {
      
      for (var i = 0; i < imms.length; i++) {
        
        var row0 = document.createElement('tr');
        var cell0 = document.createElement('td');
        cell0.innerHTML =  imms[i].textdiv;
        row0.appendChild(cell0);        
        tbl.appendChild(row0);
        
        var row1 = document.createElement('tr');
        var cell1 = document.createElement('td');
        cell1.innerHTML =  imms[i].date;
        row1.appendChild(cell1);
        tbl.appendChild(row1);
        
      }
      
    }else{
      
      var row = document.createElement('tr');
      var cell = document.createElement('td');
      cell.textContent = "N/A";
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

    buildImmunizationsTable(p.imms);    
  };

})(window);
