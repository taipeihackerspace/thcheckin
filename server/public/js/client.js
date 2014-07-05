// Convert numbers to words
// copyright 25th July 2006, by Stephen Chapman http://javascript.about.com
// permission to use this Javascript on your web page is granted
// provided that all of the code (including this copyright notice) is
// used exactly as shown (you can change the numbering system if you wish)
// http://javascript.about.com/library/bltoword.htm

// American Numbering System
var th = ['','thousand','million', 'billion','trillion'];
// uncomment this line for English Number System
// var th = ['','thousand','million', 'milliard','billion'];

var dg = ['zero','one','two','three','four', 'five','six','seven','eight','nine']; var tn = ['ten','eleven','twelve','thirteen', 'fourteen','fifteen','sixteen', 'seventeen','eighteen','nineteen']; var tw = ['twenty','thirty','forty','fifty', 'sixty','seventy','eighty','ninety']; function toWords(s){s = s.toString(); s = s.replace(/[\, ]/g,''); if (s != parseFloat(s)) return 'not a number'; var x = s.indexOf('.'); if (x == -1) x = s.length; if (x > 15) return 'too big'; var n = s.split(''); var str = ''; var sk = 0; for (var i=0; i < x; i++) {if ((x-i)%3==2) {if (n[i] == '1') {str += tn[Number(n[i+1])] + ' '; i++; sk=1;} else if (n[i]!=0) {str += tw[n[i]-2] + ' ';sk=1;}} else if (n[i]!=0) {str += dg[n[i]] +' '; if ((x-i)%3==0) str += 'hundred ';sk=1;} if ((x-i)%3==1) {if (sk) str += th[(x-i-1)/3] + ' ';sk=0;}} if (x != s.length) {var y = s.length; str += 'point '; for (var i=x+1; i<y; i++) str += dg[n[i]] +' ';} return str.replace(/\s+/g,' ');}


var serverbase = 'https://taipeihack.org'
var serverurl = serverbase+'/checkin'
var checkinlink = serverurl+'/inspace';
var peopleheader = '<tr id="peoplelistheader"><td><strong>Name</strong></td><td><strong>Arrival</strong></td></tr>';
var peopleupdateinterval = 2 * 1000;  //ms
var getPeople = function() {
    $.ajax({
	url: checkinlink,
	crossDomain: true
    }).done(function(data) {
	var people = data.people;
	if (people.length > 0) {
	    var table = peopleheader;
	    for (var i = 0; i < people.length; i++) {
		var name = people[i].name;
		var date = moment(people[i].checkin);
		if (name == '') { name = 'No name person'; }
		table += "<tr><td>"+name+"</td><td><span>"+date.fromNow()+" ("+date.format('MMMM Do YYYY, h:mm:ss a')+")</td></tr>\n";
	    }
	    $("#peopletable").html(table);
	    $('#peopletable').show();
	    $('#noone').hide();
	} else {
	    $('#peopletable').hide();
	    $('#noone').show();
	}
	// <!-- setTimeout(function() { getPeople(); }, peopleupdateinterval); -->
    });
};

$(document).ready(function() {
    // $('#peopletable').hide();
    // $('#noone').show();

    var andJoin = function(list) {
	if (list.length > 1) {
	    var partlist = list.slice(0, list.length-1);
	    out = partlist.join(', ')+', and '+list[list.length-1];
	} else if (list.length == 1) {
	    out = list[0];
	} else {
	    out = '';
	}
	return(out);
    }

    var displayCheckin = function(people) {
	var names = [];
	var nonames = 0;
	for (var i = 0; i < people.length; i++) {
	    if (people[i].name == '') {
		nonames++;
	    } else {
		names.push("<strong>"+people[i].name+"</strong>");
	    }
	}
	var text = '';
	var totalcount = nonames + names.length;
	if (totalcount == 0) {
	    text = 'Right now <strong>no-one</strong> is checked in the Hackerspace.';
	} else {
	    var verb = 'are';
	    var noun = 'people';
	    if (totalcount == 1) {
		verb = 'is';
		noun = 'person';
	    }
	    text = 'Right now there '+verb+' <strong>'+toWords(totalcount)+' '+noun+'</strong> checked in the Hackerspace';
	    if (names.length == 0) {
		text += '.';
	    } else {
		var noun = 'people';
		if (nonames == 1) {
		    noun = 'person'
		}
		if (nonames > 0) {
		    var otherpeople = toWords(nonames) + ' other ' + noun;
		    names.push(otherpeople);
		}
		text += ": "+andJoin(names)+'.';
	    }
	}
	$("#checkinlist").html(text);
    }

    var socket = io.connect(serverbase);
    socket.on('people', function (data) {
	displayCheckin(data.people);
    });
});
