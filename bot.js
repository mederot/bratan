var net = require('net'),
    config = require('./config'),
    irc = {
          info:{}
        , listeners : []
        , socket : new net.Socket()
        , ops : config['god'].concat( config['admins'] )
        , god : config['god']
        , modules : {}
    },
    names = ['AxeMurderer', 'KZombie', 'Minotauro', 'KrazyHorse'],
    name = names[Math.floor(Math.random()*names.length)],
    name = "Doflmingo",
    db = require('vendor/db/db'), 
    Youtube = require('./vendor/youtube/youtube'),
    Utils = require("./vendor/utils/utils"),
    Parser = require('./vendor/parser/parser')

irc.modules.youtube = new Youtube;
irc.modules.utils = new Utils;
irc.modules.parser = new Parser;

config['user']['nick'] = name;
config['user']['user'] = name;

(function() {

    var DEBUG = false;

    irc.socket.on('data', function(data) {
        data = data.split(/\r\n/);
        for ( var i = 0, l = data.length, message; i < l; ++i ) {
            //console.log('RECV -', data[i]);
            if (data !== '') {
                line = data[i];
                //line = data[i].slice(0,-1);

                if ( DEBUG ) console.log(line);
                message = irc.modules.parser.buildMessage( line );

                if ( message ) {
                    irc.handle( message )
                    if ( DEBUG ) console.log( message );
                }

                //irc.handle(data[i].slice(0, -1));
            }
        }
    });

    irc.socket.on('connect', function() {
        console.log('Established connection, registering');

        on( 'ping', /^PING :(.+)$/i, function ( message ) {
            console.log('sending ' + message.matches[1] );
            irc.raw('PONG :' + message.matches[1]);
        });

        setTimeout(function() {
            irc.raw('NICK ' + config.user.nick);
            irc.raw('USER ' + config.user.user + ' 8 * :' + config.user.real);
            config.chans.forEach(function( value, index ) {
                irc.join( value )
            });
        }, 1000);
    });

    irc.isOp = function( message ) {
        return irc.ops.indexOf( message.handle ) !== -1 || irc.ops.indexOf( message.handle.replace(/^~/, '') ) !== -1;
    };

    irc.isGod = function( message ) {
        return irc.god.indexOf( message.handle ) !== -1 || irc.god.indexOf( message.handle.replace(/^~/, '') ) !== -1;
    }

    irc.handle = function( message ) {

        for (var i = 0, item; i < irc.listeners.length; i++) {

            item = irc.listeners[i];

            if ( message.command == item.command ) {
                switch ( message.command ) {

                    case 'privmsg':
                        var match = message.text.match( item.what )
                        if ( match ) {
                            message['matches'] = match;
                            item.callback.call( this, message )
                            if ( item.once )
                                irc.listeners.splice(i, 1);
                        }
                    break;

                    case 'join':
                        if ( message.channel == item.what ) {
                            item.callback.call( this, message )
                            if ( item.once )
                                irc.listeners.splice(i, 1);
                        }
                    break;
                    case 'ping':
                            item.callback.call( this, message )
                    break;
                }
            }
            
            /*
        irc.listeners.push({
            command: command,
            what: what,
            callback: callback,
            once: false
        })
        */

        }
    }

    function on( command, what, callback ) {

        if ( command == 'msg' ) command = 'privmsg';

        irc.listeners.push({
            command: command,
            what: what,
            callback: callback,
            once: false
        })
    }

    function on_once( command, what, callback ) {
        if ( command == 'msg' ) command = 'privmsg';

        irc.listeners.push({
            command: command,
            what: what,
            callback: callback,
            once: true
        })
    }

    irc.raw = function(data) {
        irc.socket.write(data + '\r\n', 'ascii', function() {
            console.log('SENT -', data);
        });
    }

    irc.join = function (chan, callback) {
        if (callback !== undefined) {
            irc.on_once(new RegExp('^:' + irc.info.nick + '![^@]+@[^ ]+ JOIN :' + chan), callback);
        }
        //irc.info.names[chan] = {};
        irc.raw('JOIN ' + chan);
    };

    irc.say = function( channel, text ) {
        irc.raw('PRIVMSG ' + channel + ' :' + text );
    }

    irc.op = function( message ) {
        irc.raw('MODE ' + message.channel + ' +o ' + message.nick );
    }


    // custom events

    on( 'join', '#alpha', function( message ) {
        if ( irc.isOp( message ) )
            irc.op ( message )
    });

    on( 'msg', /^\.op/, function( message ) {

        if ( irc.isOp( message ) )
            irc.op ( message )
    });

    on( 'msg', /^\.topic$/, function( message ) {
        irc.raw( 'TOPIC ' + message.channel );
    });

    on( 'msg', /^\.topic (.+)/, function( message ) {
        irc.raw('TOPIC ' + message.channel + ' :' + message.matches[1] );
    });

    on( 'msg', /^(?:\.note\s*|`)([\w]+)/, function( message ) {
        db.model('Note').findOne({ key: message.matches[1] }, function( err, response ) { 
            if ( !err && response )
                irc.say( message.channel, response.value );
            else
                irc.say( message.channel, 'could not find key, sorry' )
        })
    });

    on( 'msg', /^(?:\+|\.addnote|\.setnote) ([\w]+) (.*)/, function(message) {
        var note = new db.Note({
            key: message.matches[1],
            value : message.matches[2]
        })

        note.save(function(err, arr){
            console.log(err)

            if ( arr ) {
                irc.say( message.channel, 'note saved.' )
            }
        })
    });

    on( 'msg', irc.modules.parser.linkRx, function( message ) {
      irc.modules.utils.title( message.matches[0], function(results ) {
	  //if ( results.length ) irc.say( message.channel, '\u0002' + results )
	  if ( results.length ) irc.say( message.channel, results )

	  //message.say( results.length )
	  //message.say ( results )
	  for ( var i = results.length; i--; ) {
	      var code = results[i].charCodeAt();
	      if ( code > 255 ) {
		  //console.log('found')
		  //console.log( code )
		  //console.log( results[i].charCodeAt() )
	      }
	  }

      })
    });

    on( 'msg', /^\.y(?:o?u?)?t?(?:u?b?e)? ([^@]+)(?:\s*@\s*([-\[\]|_\w]+))?/, function(message) {
        irc.modules.youtube.search( message.matches[1], function(results) {
            if ( !results || results.length === 0  ) irc.say( message.channel, message.username + ": Sorry, no results for '" + message.matches[1] + "'")
            else irc.say( message.channel, message.username + ": " + results[0].title + " - " + results[0].player['default'])
        })
    })

    on( 'msg', /debug/, function ( message ) {
        if ( irc.isGod( message ) ) {
            DEBUG = !DEBUG;
            irc.say( message.channel, ' debug mode toggled.' )
        }
        console.log( message )
    });

    // start the bot
    irc.socket.setEncoding('ascii');
    irc.socket.setNoDelay();
    irc.socket.connect(config.server.port, config.server.addr);

})();
