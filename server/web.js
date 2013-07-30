var fs = require('fs')
  , nconf = require('nconf')
  , serialport = require("serialport")
  , sqlite3 = require('sqlite3')
  , express = require('express')
  ;

// Configuration
nconf.argv()
     .env()
     .file({ file: 'config.json' });
nconf.defaults({
    'DEVICE': '/dev/ttyACM0',
    'PORT': '4000'
});

// Database setup
var db = new sqlite3.Database('checkinout.db');
db.serialize(function() {
    db.run("CREATE TABLE people (name VARCHAR(60), cardid VARCHAR(25) PRIMARY KEY, checkin DATETIME, checkinid INTEGER)",
	   function(err) {
	       if (err) {
		   console.log('Database already exists')
	       }
	   });
  
    db.run("CREATE TABLE checkinlist (id INTEGER PRIMARY KEY NOT NULL, cardid VARCHAR(25), eventtime DATETIME, eventtype INTEGER, FOREIGN KEY(cardid) REFERENCES people(cardid))",
	   function(err) {
	       if (err) {
		   console.log('Database already exists')
	       }
	   });
});

// Serial Port setup
var SerialPort = serialport.SerialPort;
var serialPort = new SerialPort(nconf.get('DEVICE'), {
    baudrate: 115200,
    parser: serialport.parsers.readline("\n") 
});

serialPort.on("open", function () {
    console.log("SerialPort Open")
    serialPort.on('data', function(data) {
	var chkdata = data.split(",");
	var ID = chkdata[0];
	var event = chkdata[1];
	console.log("ID: "+ID);
	console.log("Event: "+event);
	addCheckinEvent(ID, event);
    });  
});

var addCheckinEvent = function(id, event) {
    var date = new Date();

    db.serialize(function() {
	db.get("SELECT * FROM people WHERE cardid=? LIMIT 1", id, function(err, row) {
    	    if (typeof row === 'undefined') {
		db.run("INSERT INTO people VALUES(?, ?, ?, ?)", "", id, "", "");
		console.log("Added new card: "+id);
    	    } else {
		console.log("Exisiting card: "+row.cardid);
	    }
	});

	db.run("INSERT INTO checkinlist (cardid, eventtime, eventtype) VALUES(?, ?, ?)", id, date, event, function (err, row) { 
	    if (err) {
		console.log("Error inserting event!")
	    };
	});

	db.get("SELECT id FROM checkinlist WHERE cardid=? AND eventtime=? LIMIT 1", id, date, function(err, row) {
	    if (err) {
		console.log("Event insertion consitency fail");
	    } else {
		var checkinid = row.id;
		var eventdate = date;
		if (event == 1) {
		    console.log("CHECKIN!");
		} else if (event == 2) {
		    console.log("CHECKOUT!");
		    eventdate = null;
		}
		db.run("UPDATE people SET checkin=?,checkinid=? WHERE cardid=?", eventdate, checkinid, id, function(err){
		    if (err) {
			console.log("People database consistency fail");
		    }
		})
	    };
	});
    });
}

console.log("Arduino on: "+nconf.get('DEVICE'));

// Set up web interface
var app = express();

app.get('/inspace', function(req, res){
    db.get("SELECT name,checkin FROM people WHERE checkin IS NOT NULL", function(err, row) {
	var out = {}
	if (typeof row !== 'undefined') {
	    out = row;
	}
	res.send(out);
    });
});

var port = nconf.get('PORT');
app.listen(port);
console.log('Listening on port '+port);
