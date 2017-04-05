/******************************************/
/* Whiteboard Server                     **/
/******************************************/
const express = require('express')
const app = express()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const crypto = require('crypto')
const pkg = require('./package.json')

// Read package.json for configuration
const site = pkg.whiteboard.server || 'http://localhost'
const port = pkg.whiteboard.port || 2000
const version = pkg.version;

// Read HTML template
const pug = require('pug')
const html = pug.renderFile('./src/index.pug',{ site: site, port: port});

const getSettings = () => {
    let s = {}
    s.config = {
        background: 255, users: { system: 0, you: 1, other: 2 }, events: { end: 0, drawing: 1 },
        shapes: { square: 0, circle: 1, line: 2 }, types: { chat: 0, draw: 1, image: 2, text:3, update:4 }
    }
    s.data = {
        uid:0,  //unique id for user
        id: 0,  //socket id
        name: '', // users name
        type: s.config.types.chat,  //type of info
        chat: { to: s.config.users.other, from: s.config.users.you, message: '' },
        image: { id: 0 , url : '' },
        text: {id: 0,x: 0,y: 0,msg: '',color: '#000000'}
    }
    return s
}

let settings = getSettings()
let whiteboard = []
let clients = []

app.use(express.static('public'))
app.get('/', function(req, res) { res.send(html) })


http.listen(port, function() {
    console.log('-------------------------------------')
    console.log(' Whiteboard v'+version)
    console.log(' By Gary Storey (EPT)')
    console.log('-------------------------------------')
    console.log(' - Running at '+site+':'+port)
    console.log('-------------------------------------')
    console.log(' ')

})

io.on('connection', function(socket) {

    socket.on('init', function(data) {
        console.log('-BEGIN INITILIZATION FOR NEW CLIENT------------')
        let usersettings = settings
        const prevMessages = [];
        const drawings = [], pics = [], txt=[]

        usersettings.uid = data.uid || createUniqueID()
        usersettings.id = socket.id
        usersettings.name = data.name
        usersettings.chat.from = socket.id

        console.log(' - Adding '+data.name+' to client list as '+socket.id)
        clients.push({id:socket.id, name: data.name, uid: data.uid})

        this.emit('settings', usersettings)

        if (whiteboard.length) {
            whiteboard.forEach( (entry) => {
                switch(entry.type) {
                    case usersettings.config.types.draw:
                        drawings.push(entry.draw)
                        break
                    case usersettings.config.types.image:
                        pics.push(entry.image)
                        break
                    case usersettings.config.types.text:
                        txt.push(entry.text)
                        break
                    default:
                        prevMessages.push(processChatData(entry))
                        break
                }
            })
        }

        console.log(' - Sending message that '+data.name +' has joined whiteboard session')

        socket.broadcast.emit('chat',[{id:0, message:'<li class="message-system"><em><strong>'+data.name+'</strong> has joined the whiteboard session.</em></li>'}])

        if (prevMessages.length) {
            console.log(' - Sending '+prevMessages.length +' chat message(s) to '+data.name)
            prevMessages.push({id:0, message:'<li class="message-system"><em>You have joined the whiteboard session.</em></li>'});
            this.emit('chat', prevMessages)
        } else {
            this.emit('chat',[{id: 0, message:'<li class="message-system"><em>You have joined the whiteboard session.</em></li>'}])
        }

        if (drawings.length) {
            console.log(' - Sending '+drawings.length +' drawing(s) to '+data.name)
            this.emit('refreshWB', drawings)
        } else {
            console.log(' - No Drawings')
        }

        if (pics.length) {
            console.log(' - Sending '+pics.length +' image(s) to '+data.name)
            pics.forEach( (pic) => {
                this.emit('image', pic.url)
            })
        } else {
            console.log(' - No Images')
        }

        if (txt.length) {
            console.log(' - Sending '+txt.length +' text(s) to '+data.name)
            txt.forEach( (entry) => {
                this.emit('text',entry)
            })
        } else {
            console.log(' - No Images')
        }
        console.log('-END INITILIZATION FOR NEW CLIENT------------')
        console.log(' ')
        console.log(' ')
    })

    socket.on('send', (data) => {
        const typesName = ['chat','draw','image','text','update'];
        console.log('-BEGIN SEND---------------------')
        console.log(' - Sending '+typesName[data.type]+ ' data')
        switch(data.type) {
            case settings.config.types.draw:
                sendDraw(socket,data)
                break;
            case settings.config.types.image:
                sendImage(socket,data)
                break
            case settings.config.types.text:
                sendText(socket,data)
                break
            case settings.config.types.update:
                sendUpdate(socket,data)
                break
            default:
                sendChat(data)
                break;
        }
        console.log('-END SEND---------------------')
        console.log(' ')
    })

    socket.on('removeuser', (settings) =>{
        console.log('-DiSCONNECT---------------------')
        console.log(' - Sending disconnect message to everyone')
        io.emit('chat', [{id:0,message:'<li class="message-system"><em><strong>'+settings.name+'</strong> has left the whiteboard session.</em></li>'}])

        console.log(' - Removing '+settings.name+' from client list')
        for (var i = clients.length - 1; i >= 0; i--) {
            if (clients[i].id == settings.id) {
                clients.splice(i, 1);
            }
        }
        if (!clients.length) {
            console.log(' - All users have left.  Reseting Whiteboard')
            whiteboard.length=0
        } else {
            console.log(' - There are '+clients.length+' users.')
        }

        console.log('-END DISCONNECT-----------------')
        console.log(' ')
    })

    socket.on('clear',(name) => {
        whiteboard = whiteboard.filter(function(entry) { return entry.type === settings.config.types.chat })
        socket.broadcast.emit('erase')
        io.emit('chat', [{id:0,message:'<li class="message-system"><em><strong>'+name+'</strong> has erased the whiteboard.</em></li>'}])
    })

    socket.on('getID', () =>{ socket.emit('id', createUniqueID()) })

})

function createUniqueID() { return crypto.randomBytes(20).toString('hex');}

function processChatData(data){
    var message = '<li data-id="{{id}}" class="{{messagetype}}"><span class="name">{{from}}: </span><span class="arrow">◄</span><span class="message">{{message}}</span></li>'
    var sysmessage = '<li class="message-system"><em>{{message}}</em></li>'

    if (data.chat.from === 0 ) { message = sysmessage }
    message = message.replace('{{from}}', data.name)
    message = message.replace('{{id}}',data.id)
    message = message.replace('{{message}}', data.chat.message)
    return { id: data.id, message : message }
}

function sendDraw(socket,data){
    whiteboard.push(data)
    socket.broadcast.emit('draw',data.draw);
}
function sendImage(socket,data) {
    whiteboard.push(data)
    socket.broadcast.emit('image', data.image)
}

function sendChat(data){
    if ( data.chat.from !== settings.config.users.system || data.chat.message !== '') {
        whiteboard.push(data)
    }
    io.emit('chat', [processChatData(data)])
}
function sendText(socket,data){
    whiteboard.push(data)
    socket.emit('text',data)
}
function sendUpdate(socket,data) {
    whiteboard.push(data)
    socket.broadcast.emit('update',data)
}
