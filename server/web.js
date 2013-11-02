var fs = require('fs')
  , nconf = require('nconf')
  , serialport = require("serialport")
  , sqlite3 = require('sqlite3')
  , express = require('express')
  , io = require('socket.io')
  , http = require('http')
  , cronJob = require('cron').CronJob
  ;

// Configuration
nconf.argv()
     .env()
     .file({ file: 'config.json' });
nconf.defaults({
    'DEVICE': '/dev/ttyACM0',
    'PORT': '12000'
});

// Database setup
var db = new sqlite3.Database('checkinout.db');
db.serialize(function() {
    db.run("CREATE TABLE people (id INTEGER PRIMARY KEY NOT NULL, name VARCHAR(60), cardid VARCHAR(25) UNIQUE, checkin DATETIME, checkinid INTEGER)",
	   function(err) {
	       if (err) {
		   console.log('People database already exists')
	       }
	   });

    db.run("CREATE TABLE checkinlist (id INTEGER PRIMARY KEY NOT NULL, cardid VARCHAR(25), eventtime DATETIME, eventtype INTEGER, FOREIGN KEY(cardid) REFERENCES people(cardid))",
	   function(err) {
	       if (err) {
		   console.log('Checkin list database already exists')
	       }
	   });
});

var cleanStaleCheckins = function() {
    var now = new Date()
    var threshold = now - 16 * 60 * 60 * 1000;  // that's 16h ago

    db.serialize(function() {
	db.run("UPDATE people SET checkin=NULL WHERE id in (SELECT id FROM people WHERE checkin<?)", threshold, function (err, row) {
	    if (err) {
		console.log("Error removing stale checkins!")
	    };
	});
	db.all("SELECT name,checkin FROM people WHERE checkin IS NOT NULL", function(err, rows) {
	    var out = { people:  [] };
	    for (var i = 0; i < rows.length; i++) {
		out.people.push(rows[i]);
	    }
	    sio.sockets.emit('people', out);
	});
    });
}

// Set up web interface
var app = express();
app.use(express.logger());
app.use(express.bodyParser());
app.use(express.static(__dirname + '/public'));

var port = nconf.get('PORT');
var server = http.createServer(app);
server.listen(port, function(){
  console.log("Express server listening on port " + port);
});

var sio = io.listen(server);
sio.set('transports', [
    'websocket'
  , 'xhr-polling'
  , 'jsonp-polling'
]);

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
		db.run("INSERT INTO people (name, cardid) VALUES(?, ?)", "", id);
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
	    db.serialize(function() {
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
		    });
		};

		db.all("SELECT name,checkin FROM people WHERE checkin IS NOT NULL", function(err, rows) {
		    var out = { people:  [] };
		    for (var i = 0; i < rows.length; i++) {
			out.people.push(rows[i]);
		    }
		    sio.sockets.emit('people', out);
		});
	    });
	});
    });
}

console.log("Arduino on: "+nconf.get('DEVICE'));

sio.sockets.on('connection', function(socket){
    var hs = socket.handshake;

    db.all("SELECT name,checkin FROM people WHERE checkin IS NOT NULL", function(err, rows) {
	var out = { people:  [] };
	for (var i = 0; i < rows.length; i++) {
	    out.people.push(rows[i]);
	}
	socket.emit('people', out);
    });

    socket.on('disconnect', function(){
	console.log('A socket with sessionID '+hs.sessionID+' disconnected.');
    });
});

var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', "*");
    next();
};
app.use(allowCrossDomain);

app.get('/inspace', function(req, res){
    var out = { people: [] }
    db.all("SELECT name,checkin FROM people WHERE checkin IS NOT NULL", function(err, rows) {
	for (var i = 0; i < rows.length; i++) {
	    out.people.push(rows[i]);
	}
	res.jsonp(out);
    });
});

app.get('/', function(req, res){
    res.send("Not quite there yet.");
});

cleanStaleCheckins(); // Clean stale on startup
var job = new cronJob({  cronTime: '*/15 * * * *'  // do a cleaning every 15 minutes
		       , onTick: cleanStaleCheckins
		       , start: true
		      });
