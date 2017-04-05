'use strict';

/* eslint-disable no-unused-vars */
var socket,
    settings,
    $messages,
    $msg,
    drawings = [],
    canvas,
    availableId;

var canvassize = { top: 0, bottom: 0, left: 0, right: 0, height: 0, width: 0 };

$(function () {
    initialize();
});

// Execute immediately!!
setupCanvasSize(document.getElementById('whiteboard'));

function setupCanvasSize(el) {
    var width = el.offsetWidth - 25;
    if (width > 980) {
        width = 980;
    }
    var height = Math.round(width / 16 * 9, 2);
    canvassize.top = 0; //el.offsetTop
    canvassize.left = 0; //el.offsetLeft
    canvassize.height = height;
    canvassize.width = width;
    canvassize.bottom = canvassize.top + height;
    canvassize.right = canvassize.left + width;
}

function initialize() {
    $messages = $('#messages');
    $msg = $('#msg');
    window.onunload = disconnectMe;
    setupCanvas();
    setupSockets();
    setupUIEvents();
}

function setupSockets() {
    socket = io();
    socket.on('connect', connectToServer);
    socket.on('settings', updateSettings);
    socket.on('chat', appendChatMsg);
    socket.on('draw', draw);
    socket.on('image', addImageToCanvas);
    socket.on('text', addText);
    socket.on('update', addUpdate);
    socket.on('refreshWB', refreshWB);
    socket.on('id', function (d) {
        availableId = d;
    });
    socket.on('erase', function () {
        canvas.clear();
    });
}

function setActiveMenuItem(e) {
    var el = $(e.delegateTarget);
    var erase = $('#erasedraw');
    var $menu = $('#wbcontrols .primary li[id]');
    $menu.removeClass('selected');
    el.addClass('selected').addClass('animated');
}

function setupUIEvents() {

    $('.primary li:not(.empty)').on('click', setActiveMenuItem).on('transitionend', function () {
        $(this).removeClass('animated');
    });

    $('#edit').on('click', function () {
        var $t = $(this);
        var current = !canvas.isDrawingMode;
        canvas.isDrawingMode = current;
        if (current) {
            $t.addClass('selected');
        } else {
            $t.removeClass('selected');
        }
    });

    $('#color').spectrum({
        color: "#000",
        showButtons: false,
        preferredFormat: 'rgb',
        hideAfterPaletteSelect: true,
        showPaletteOnly: false,
        showPalette: true,
        palette: [['black', 'darkgray', 'gray', 'lightgray', 'white'], ['blue', 'green', 'red', 'purple', 'brown'], ['lightblue', 'lightgreen', 'pink', 'violet', 'orange'], ['rgb(225,26,43)', 'rgb(164,18,20)', 'rgb(89,44,130)']],
        change: function change(color) {
            var r = parseInt(color._r, 10);
            var g = parseInt(color._g, 10);
            var b = parseInt(color._b, 10);
            canvas.freeDrawingBrush.color = color.toHexString();
            settings.text.color = color.toHexString();
        }
    });

    $('#range').on('change', function () {
        var val = $(this).val();
        val = parseInt(val, 10);
        canvas.freeDrawingBrush.width = val;
    });

    $('#undo').on('click', function () {
        console.log('undo');
        $(this).removeClass('selected');
    });

    $('#addImage').on('click', function () {
        var imgUrl = window.prompt('Paste in the URL below.  Local images WILL NOT WORK.');
        if (imgUrl) {
            addImageToCanvas(imgUrl);
            settings.type = settings.config.types.image;
            settings.image.url = imgUrl;
            settings.image.id = availableId;
            socket.emit('getID');
            socket.emit('send', settings);
        }
        $(this).removeClass('selected');
    });

    $('#erase').on('click', function () {
        var $t = $(this);
        window.setTimeout(function () {
            var clearWB = confirm('Erase the entire whiteboard for all users?');
            $t.removeClass('selected');
            if (clearWB) {
                socket.emit('clear', settings.name);
                canvas.clear();
            }
        }, 200);
    });

    $('#erasedraw').on('click', function () {
        var $t = $(this);
        settings.draw.isErase = !settings.draw.isErase;
        if (settings.draw.isErase) {
            $t.addClass('selected');
        } else {
            $t.removeClass('selected');
        }
    });

    $('#save').on('click', function () {
        document.getElementById('canvas').toBlob(function (blob) {
            saveAs(blob, 'whiteboard.png');
        }, 'image/png');
        $(this).removeClass('selected');
    });

    $('#addText').on('click', function () {
        settings.type = settings.config.types.text;
    });

    /* chat UI */
    $('#send').on('click', sendMsg);

    $msg.on('keyup', function (ev) {
        ev.preventDefault();
        ev.which === 13 && sendMsg(readChatMessage());
    });
}

function connectToServer() {
    var data = JSON.parse(localStorage.getItem('whiteboard')) || { name: '', uid: 0 };
    var name = data.name || getName();
    var uid = data.uid || 0;
    socket.emit('init', { name: name, uid: uid });
    socket.emit('getID'); //go get a unique id for use with objects added/modified in wb
}

function getName() {
    var name = window.prompt('What is your name?');
    if (!name) {
        name = 'Anonymous';
    }
    return name;
}

function updateSettings(data) {
    localStorage.setItem('whiteboard', '{"name":"' + data.name + '", "uid":"' + data.uid + '"}');
    settings = data;
}

function appendChatMsg(data) {
    var message = '';
    data.forEach(function (entry) {
        var type = entry.id === settings.id ? 'message-you' : 'message-other';
        message += entry.message.replace('{{messagetype}}', type);
    });
    $messages = $messages || $('#messages');
    $messages.append(message);
    window.location.href = '#wb';
}

function sendMsg(msg) {
    settings.chat.message = msg;
    settings.chat.to = settings.config.users.other;
    settings.chat.from = settings.id;
    settings.type = settings.config.types.chat;
    socket.emit('send', settings);
}

function readChatMessage() {
    $msg = $msg || $('#msg');
    var txt = $msg.val();
    $msg.val('');
    return txt;
}

function disconnectMe() {
    socket.emit('removeuser', settings);
}

/*******************************************************************/
/*   FABRICJS FUNCTIONS
/*******************************************************************/

function setupCanvas() {
    canvas = canvas || new fabric.Canvas('canvas', {
        backgroundColor: '#fff',
        height: canvassize.height,
        width: canvassize.width,
        isDrawingMode: false
    });
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = '#000';
    canvas.freeDrawingBrush.width = 10;

    canvas.on('path:created', function (e) {
        settings.type = settings.config.types.draw;
        settings.draw = e;
        settings.draw.id = availableId;
        socket.emit('getID');
        socket.emit('send', settings);
    });

    canvas.on('object:modified', function (e) {
        settings.type = settings.config.types.update;
        settings.data = e.target;
        settings.draw.id = availableId;
        socket.emit('getID');
        socket.emit('send', settings);
    });

    /*
        canvas.on('mouse:down', function(e){
            if (settings.type === settings.config.types.text) {
                var txt = prompt('Add your text here')
                if (txt) {
                    settings.text.x = e.e.offsetX
                    settings.text.y = e.e.offsetY
                    settings.text.data = e.e;
                    settings.text.msg = txt || ''
                    socket.emit('send',settings)
                }
            }
        })
    */
}

function draw(data) {
    console.log(data);
    var path = new fabric.Path();
    path.set(data.path);
    canvas.add(path);
    canvas.renderAll();
}

function refreshWB(data) {
    data.forEach(function (entry) {
        draw(entry);
    });
}

function addImageToCanvas(url) {
    fabric.Image.fromURL(url, function (img) {
        var size = scaleImage(img.height, img.width);
        img.setHeight(size.h);
        img.setWidth(size.w);
        canvas.add(img);
    }, {
        selectable: true
    });
    canvas.renderAll();
}

function scaleImage(h, w) {
    var size = {};
    if (h > w) {
        size.w = parseInt(w / h * 200, 10);
        size.h = 200;
    } else {
        size.h = parseInt(h / w * 200);
        size.w = 200;
    }
    return size;
}

function addText(data) {
    var txt = new fabric.Text(data.text.msg, {
        left: data.text.x || 5,
        top: data.text.y || 5,
        stroke: data.text.color,
        selectable: true,
        id: data.text.id
    });
    canvas.add(txt);
    settings.type = settings.config.types.chat;
}

function addUpdate(data) {
    console.log(data);
}