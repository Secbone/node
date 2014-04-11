var LINE_SEGMENT = 0;
var CHAT_MESSAGE = 1;
var GAME_LOGIC = 2;

var WAITING_TO_START = 0;
var GAME_START = 1;
var GAME_OVER = 2;
var GAME_RESTART = 3;

var conn_sockets = new Array();

var fs = require('fs')
	, http = require('http')
	,url = require('url')
	,path = require('path')
	, socketio = require('socket.io');
  
var playerTurn = -1;

var wordsList = Array();//['apple','idea','wisdom','angry','happy','cry','angel','woman','ladygaga','dog','jordan','cat','smile','jump','panda'];

fs.readFile('wordlist.txt',function(err,data){
	if(err){
		console.log('**********************'+err+'*********************');
	}else{
		var str = data.toString();
		wordsList = str.split('\n');
		//console.log(wordList);
	}
});



var currentAnswer = undefined;

var currentGameState = WAITING_TO_START;

var gameOverTimeOut;
 
var server = http.createServer(function(req, res) {
	
	var pathname = __dirname + url.parse(req.url).pathname;
	if (path.extname(pathname) == "") {
		pathname += "/";
	}
	if (pathname.charAt(pathname.length - 1) == "/") {
		pathname += "index.html";
	}

	path.exists(pathname, function (exists) {
		if (exists) {
			switch (path.extname(pathname)) {
			case ".html":
				res.writeHead(200, {
					"Content-Type": "text/html"
				});
				break;
			case ".js":
				res.writeHead(200, {
					"Content-Type": "text/javascript"
				});
				break;
			case ".css":
				res.writeHead(200, {
					"Content-Type": "text/css"
				});
				break;
			case ".gif":
				res.writeHead(200, {
					"Content-Type": "image/gif"
				});
				break;
			case ".jpg":
				res.writeHead(200, {
					"Content-Type": "image/jpeg"
				});
				break;
			case ".png":
				res.writeHead(200, {
					"Content-Type": "image/png"
				});
				break;
			default:
				res.writeHead(200, {
					"Content-Type": "application/octet-stream"
				});
			}

			fs.readFile(pathname, function (err, data) {
				res.end(data);
			});
		}else {
			res.writeHead(404, {
				"Content-Type": "text/html"
			});
			res.end("<h1>404 Not Found</h1>");
		}
	});
}).listen(8080, function() {
	console.log('Listening at: http://localhost:8080');
	//console.log('--------------------------------------------------------');
	//console.log('connections : ',socket.manager.connected);
	//console.log('--------------------------------------------------------');
});
 
socketio.listen(server).on('connection', function (socket) {

   
	
	//console.log('server : ',server);
	//console.log('socketio : ',socketio);
	//console.log('socket : ',socket.manager.sockets.sockets);
	
	//for(var key in socket.manager.sockets.sockets){
	//	socket.manager.sockets.sockets[key].emit('test_r',key);
	//}
	socket.on('setname',function(name){
		socket.set('nickname',name);
		socket.get('nickname',function(err,name){
			socket.nickname = name;

			//console.log('-----------------'+socket.nickname+'===================');
			var message = "欢迎 "+socket.nickname+" 加入!";
			var data = {};
			data.dataType = CHAT_MESSAGE;
			data.secder = "Server";
			data.message = message;
			socket.broadcast.emit('welcome',JSON.stringify(data));
			
			var socket_info = {};
			socket_info.id = socket.id;
			socket_info.nickname = socket.nickname;
			socket_info.ready = 0;
			socket_info.score = 0;
			conn_sockets.push(socket_info);
			
			sendPlayerInfo(socket);
		});
	});
	

	
	
	//发送游戏状态给所有玩家
	var gameLogicData = {};
	gameLogicData.dataType = GAME_LOGIC;
	gameLogicData.gameState = WAITING_TO_START;
	socket.emit('message',JSON.stringify(gameLogicData));
	socket.broadcast.emit('message',JSON.stringify(gameLogicData));
	
  
	
	socket.on('message', function (msg) {
		//console.log('Message Received: ', msg);
		var data = JSON.parse(msg);
		if(data.dataType == CHAT_MESSAGE){
			data.sender = socket.nickname;
			
		}
		socket.broadcast.emit("message",JSON.stringify(data));
		
		if(data.dataType == CHAT_MESSAGE){
			//console.log('game_state : '+currentGameState+" Message : "+data.message+" Answer: "+currentAnswer+"------------------------");
			if(currentGameState == GAME_START && data.message == currentAnswer){
				if(isPlayer(socket)){
				}else{
					getScore(socket);
					var gameLogicData = {};
					gameLogicData.dataType = GAME_LOGIC;
					gameLogicData.gameState = GAME_OVER;
					gameLogicData.winner = socket.nickname;
					gameLogicData.answer = currentAnswer;
					socket.broadcast.emit('message',JSON.stringify(gameLogicData));
					socket.emit('message',JSON.stringify(gameLogicData));
					
					//currentGameState = WAITING_TO_START;
					nextTurn(socket);
					
					clearTimeout(gameOverTimeOut);
				}
			}
		}
		
		if(data.dataType == GAME_LOGIC && data.gameState == GAME_RESTART){
			startGame(socket);
		}
		
		//var displayMessage = socket.nickname + " says: " + msg;
		//socket.broadcast.emit('message', displayMessage);
	});
	
	socket.on('disconnect',function(){
		remove_socket(socket.id);
		console.log(socket.nickname+" has disconnect ! ----------------");
		sendPlayerInfo(socket);
	});
	
	
	socket.on('getReady',function(data){
		for(var key in conn_sockets){
			if(conn_sockets[key].id == socket.id){
				if(data == 'ready'){
					//console.log(socket.nickname+' is ready----------');
					conn_sockets[key].ready = 1;
				}else if(data == 'cancel'){
					//console.log(socket.nickname+' is cancel----------');
					conn_sockets[key].ready = 0;
				}
				break;
			}
		}
		if(isAllReady() && currentGameState == WAITING_TO_START){
			clearScore();
			console.log('------------is all ready-------');
			playerTurn = (playerTurn + 1) % conn_sockets.length;
			//console.log('fffffffffffffffff : '+playerTurn);
			startGame(socket, playerTurn);
		}
		sendPlayerInfo(socket);
		//console.log('---------------------ready ?????????----- : ');
	});
});

function startGame(socket){
	
	console.log('--------------Game Start!------------');
	var turning = arguments[1] ? arguments[1] : 0;
	
	var answerIndex = Math.floor(Math.random() * wordsList.length);
	currentAnswer = wordsList[answerIndex];
	
	sendPlayerInfo(socket);
	
	var gameLogicData1 = {};
	gameLogicData1.dataType = GAME_LOGIC;
	gameLogicData1.gameState = GAME_START;
	gameLogicData1.isPlayerTurn = false;
	socket.emit('message',JSON.stringify(gameLogicData1));
	socket.broadcast.emit('message',JSON.stringify(gameLogicData1));




	for(var key in socket.manager.sockets.sockets){
		if(key == conn_sockets[turning].id){
			socket.manager.sockets.sockets[key].broadcast.emit('message',JSON.stringify(gameLogicData1));
			gameLogicData1.isPlayerTurn = true;
			gameLogicData1.answer = currentAnswer;
			socket.manager.sockets.sockets[key].emit('message',JSON.stringify(gameLogicData1));
			break;
		}
	}
	
	//依次回答
	var index = 0;
	//--------------------------------------------to be continue !
	
	gameOverTimeOut = setTimeout(function(){
		var gameLogicData = {};
		gameLogicData.dataType = GAME_LOGIC;
		gameLogicData.gameState = GAME_OVER;
		gameLogicData.winner = "时间到！\n没有人";
		gameLogicData.answer = currentAnswer;
		socket.emit('message',JSON.stringify(gameLogicData));
		socket.broadcast.emit('message',JSON.stringify(gameLogicData));
		
		nextTurn(socket);
		
		//currentGameState = WAITING_TO_START;
	},60*1000);
	
	currentGameState = GAME_START;
}

function remove_socket(id){
	for(var index in conn_sockets){
		if(conn_sockets[index].id == id){
			conn_sockets.splice(index,1);
			break;
		}
	}
}

function isAllReady(){
	console.log('-----------------check ready---------------');
	//console.log('-------check : ',conn_sockets);
	if(conn_sockets.length < 2) return 0;
	var isReady = 1;
	for(var key in conn_sockets){
		isReady *= conn_sockets[key].ready;
	}
	return isReady;
}

function clearReady(){
	for(var key in conn_sockets){
		conn_sockets[key].ready = 0;
	}
}

function clearScore(){
	for(var key in conn_sockets){
		conn_sockets[key].score = 0;
	}
}

function nextTurn(socket){
	playerTurn = (playerTurn + 1) % conn_sockets.length;
	var data={};
	if(playerTurn == 0){
		playerTurn = -1;
		data.msg = '游戏结束! 请重新准备!';
		data.isOver = true;
		clearReady();
		currentGameState = WAITING_TO_START;
		sendPlayerInfo(socket);
	}else{
		data.msg = '5秒钟后下一位!';
		data.isOver = false;
		console.log('--------------------next time out---------------');
		var nextTimeout = setTimeout(startGame, 5*1000, socket, playerTurn);
	}
	socket.emit('endmsg',JSON.stringify(data));
	socket.broadcast.emit('endmsg',JSON.stringify(data));
}

function sendPlayerInfo(socket){
	var data = {};
	data.playerinfo = conn_sockets;
	data.playturn = playerTurn;
	socket.emit('playerinfo',JSON.stringify(data));
	socket.broadcast.emit('playerinfo',JSON.stringify(data));
}

function getScore(socket){
	for(var index in conn_sockets){
		if(index == playerTurn){
			conn_sockets[index].score += 2;
		}
		if(conn_sockets[index].id == socket.id){
			conn_sockets[index].score += 1;
		}
	}
	sendPlayerInfo(socket);
}

function isPlayer(socket){
	for(var index in conn_sockets){
		if(conn_sockets[index].id == socket.id){
			if(index == playerTurn)
				return true;
			return false;
		}
	}
}

//重写setTimeout函数
var _st = setTimeout;
//fRef 是test函数,mDelay是时间
setTimeout = function(fRef, mDelay) {
   if(typeof fRef == 'function'){ 
	   var argu = Array.prototype.slice.call(arguments,2);
	   var f = (
			function(){
				fRef.apply(null, argu);
			}); 
	   return _st(f, mDelay);
	}
	return _st(fRef,mDelay);
}
