var websocketGame = {
	//指示当前是否正在进行绘图
	isDrawing : false,
	isTurnToDraw : false,
	//绘制下一条线的起点
	startX : 0,
	startY : 0,
	color : "#000",
	thickness : 1,
	//常量
	LINE_SEGMENT : 0,
	CHAT_MESSAGE : 1,
	GAME_LOGIC : 2,
	//游戏逻辑状态常量
	WAITING_TO_START : 0,
	GAME_START : 1,
	GAME_OVER : 2,
	GAME_RESTART : 3,
}

var scrolltimer = setInterval(function()
      {$('#incomingChatMessages').get(0).scrollTop+=15;}, 100);


var timer;
var readytimeout;
var canvas = document.getElementById('drawing-pad');
var ctx = canvas.getContext('2d');
$(function(){
	var iosocket = io.connect();

	iosocket.on('connect', function () {
		var name = prompt("请输入姓名：");
		var name = name ? name : "某某";
		iosocket.emit('setname',name);
		var html = $('#incomingChatMessages').text()+"\r";
		$('#incomingChatMessages').text(html+'已连接，请点击准备按钮准备游戏,当所有玩家准备后，游戏开始!');

      readytimeout =
      setTimeout(function(){iosocket.emit('getReady','ready');$('#ready').hide();$('#cancel').show();},60000);

		$('#incomingChatMessages').scrollTop=$('#incomingChatMessages').scrollHeight;
		iosocket.on('welcome',function(data){
			//console.log(data);
			var data = JSON.parse(data);
			var html = $('#incomingChatMessages').text()+"\r";
			$('#incomingChatMessages').text(html +data.message);
			$('#incomingChatMessages').scrollTop=$('#incomingChatMessages').scrollHeight;
		})

		iosocket.on('message', function(message) {
			//console.log(message);
			var data = JSON.parse(message);
			//收到聊天信息
			if(data.dataType == websocketGame.CHAT_MESSAGE){
				var html = $('#incomingChatMessages').text()+"\r";
				$('#incomingChatMessages').text(html +data.sender+" 说: "+data.message);
				$('#incomingChatMessages').scrollTop=$('#incomingChatMessages').scrollHeight; 
			}else if(data.dataType == websocketGame.LINE_SEGMENT){
				//同步其他玩家的线条
				drawLine(ctx, data.startX, data.startY, data.endX, data.endY, data.thickness,data.color);
			}else if(data.dataType == websocketGame.GAME_LOGIC){
				if(data.gameState == websocketGame.GAME_OVER){
					//单个游戏结束
					websocketGame.isTurnToDraw = false;
					$(".color-pad").hide();
					$(".game-info").show();
					var html = $('#incomingChatMessages').text()+"\r";
					$('#incomingChatMessages').text(html+data.winner+" 胜利! 答案是 '"+data.answer+"' !");
					//$('#ready').show();
					$('#incomingChatMessages').scrollTop=$('#incomingChatMessages').scrollHeight;
				}
				if(data.gameState == websocketGame.GAME_START){
					//游戏开始
					//console.log('start');
					showTime(60);
					//清除Canvas
					canvas.width = canvas.width;
					websocketGame.color = "#000";
					websocketGame.thickness = 1;
					$('#ready').hide();
					$('#cancel').hide();
					$('#incomingChatMessages').text("");
					
					//console.log(data.isPlayerTurn);
					
					if(data.isPlayerTurn){
						//当前玩家绘画
						websocketGame.isTurnToDraw = true;
						$(".game-info").hide();
						$(".color-pad").show();
						$('#drawing-pad').removeClass('n_drawing');
						$('#drawing-pad').addClass('drawing');
						var html = $('#incomingChatMessages').text()+"\r";
						$('#incomingChatMessages').text(html+"轮到你画了,你要画的词是 '"+data.answer+"' ");
						$('#incomingChatMessages').scrollTop=$('#incomingChatMessages').scrollHeight;
					}else{
						//其他玩家绘画
						var html = $('#incomingChatMessages').text()+"\r";
						$('#incomingChatMessages').text(html+"游戏开始,你有1分钟的时间来猜词!");
						$('#incomingChatMessages').scrollTop=$('#incomingChatMessages').scrollHeight;
						$('#drawing-pad').removeClass('drawing');
						$('#drawing-pad').addClass('n_drawing');
					}
				}
			}
		});
		//失去连接
		iosocket.on('disconnect', function() {
			var html = $('#incomingChatMessages').text()+"\r";
			$('#incomingChatMessages').text(html+'连接中断');
			$('#incomingChatMessages').scrollTop=$('#incomingChatMessages').scrollHeight;
		});
		iosocket.on('socketsss',function(data){
			var connections = JSON.parse(data);
			var length = 0;
			for( var key in connections){
				//console.log("-------------key : "+key+" value : "+connections[key]);
				length++;
			}
			//console.log("length : "+length);
		});
		
		iosocket.on('test_r',function(data){
			//console.log("my id is : "+data);
		});
		//整轮游戏结束
		iosocket.on('endmsg',function(data){
			var data = JSON.parse(data);
			var html = $('#incomingChatMessages').text()+"\r";
			$('#incomingChatMessages').text(html+data.msg);
			$('#incomingChatMessages').scrollTop=$('#incomingChatMessages').scrollHeight;
			if(data.isOver){
				websocketGame.isTurnToDraw = false;
				$('#drawing-pad').removeClass('drawing');
				$('#drawing-pad').addClass('n_drawing');
				$('#ready').show();
				clearTimeout(timer);
				$('.time-pad').html("");
            readytimeout =
             setTimeout(function(){iosocket.emit('getReady','ready');$('#ready').
                hide();$('#cancel').show();},60000);
			}else{
				//5秒延时
				showTime(5);
			}
		});
		iosocket.on('playerinfo', function(data){
			var data = JSON.parse(data);
			$(".player-box").html('');
			for(var key in data.playerinfo){
				var html = $(".player-box").html();
				if(key == data.playturn){
					$(".player-box").html(html + '<div class="player-info"><div class="player-img player-drawing"></div><div class="player-name">'+data.playerinfo[key].nickname+'</div><div class="player-score">'+data.playerinfo[key].score+'</div></div>');
				}else if(data.playerinfo[key].ready == 1){
					$(".player-box").html(html + '<div class="player-info"><div class="player-img player-ready"></div><div class="player-name">'+data.playerinfo[key].nickname+'</div><div class="player-score">'+data.playerinfo[key].score+'</div></div>');
				}else{
					$(".player-box").html(html + '<div class="player-info"><div class="player-img"></div><div class="player-name">'+data.playerinfo[key].nickname+'</div><div class="player-score">'+data.playerinfo[key].score+'</div></div>');
				}
			}
		});
		
	});
	//发送聊天信息
	$("#send").click(sendMessage);
	$('#outgoingChatMessage').keypress(function(event) {
		if(event.which == 13) {
			event.preventDefault();
			sendMessage();
			/*iosocket.send($('#outgoingChatMessage').val());
			$('#incomingChatMessages').append($('<li></li>').text($('#outgoingChatMessage').val()));
			$('#outgoingChatMessage').val('');
			*/
		}
	});
	
	function sendMessage(){
		var message = $('#outgoingChatMessage').val();
      if(!message) return;
		var data = {};
		data.dataType = websocketGame.CHAT_MESSAGE;
		data.message = message;
		iosocket.send(JSON.stringify(data));
		var html = $('#incomingChatMessages').text()+"\r";
		$('#incomingChatMessages').text(html+$('#outgoingChatMessage').val());
		$('#incomingChatMessages').scrollTop=$('#incomingChatMessages').scrollHeight;
		$('#outgoingChatMessage').val('');
	}
	
	//canvas绘图的逻辑
	$('#drawing-pad').mousedown(function(e){
		var canvasPosition = $(this).offset();
		var mouseX = (e.pageX - canvasPosition.left)  || 0;
		var mouseY = (e.pageY - canvasPosition.top) || 0;
		websocketGame.startX = mouseX;
		websocketGame.startY = mouseY;
		websocketGame.isDrawing = true;
	});
	
	$('#drawing-pad').mousemove(function(e){
		if( websocketGame.isTurnToDraw  && websocketGame.isDrawing){
			var canvasPosition = $(this).offset();
			var mouseX = (e.pageX - canvasPosition.left) || 0;
			var mouseY = (e.pageY - canvasPosition.top) || 0;
			
			if(!(mouseX == websocketGame.startX && mouseY == websocketGame.startY)){
				drawLine(ctx, websocketGame.startX, websocketGame.startY, mouseX, mouseY, websocketGame.thickness,websocketGame.color);
				//发送线段数据到服务器
				var data = {};
				data.dataType = websocketGame.LINE_SEGMENT;
				data.startX = websocketGame.startX;
				data.startY = websocketGame.startY;
				data.endX = mouseX;
				data.endY = mouseY;
				data.color = websocketGame.color;
				data.thickness = websocketGame.thickness;
				iosocket.send(JSON.stringify(data));
				websocketGame.startX = mouseX;
				websocketGame.startY = mouseY; 
			}
		}
	});
	
	$('#drawing-pad').mouseup(function(e){
		websocketGame.isDrawing = false;
	});
	
	$('#ready').click(function(){
		iosocket.emit('getReady','ready');
		$('#ready').hide();
		$('#cancel').show();
      clearTimeout(readytimeout);
	});
	
	$('#cancel').click(function(){
		iosocket.emit('getReady','cancel');
		$('#ready').show();
		$('#cancel').hide();
      readytimeout = setTimeout(function(){iosocket.emit('getReady','ready');$('#ready').hide();$('#cancel').show();},60000);
	});
	
	$(".color-item").click(function(){
		websocketGame.color = $(this).attr("color-value");
		if(websocketGame.color == "#fff"){
			websocketGame.thickness = 8;
			$('#drawing-pad').removeClass('drawing');
			$('#drawing-pad').addClass('rubber');
		}else{
			websocketGame.thickness = 1;
			$('#drawing-pad').removeClass('rubber');
			$('#drawing-pad').addClass('drawing');
		}
		//console.log("color : "+websocketGame.color);
		$(this).addClass("c-selected").siblings().removeClass("c-selected");
	});
});
function drawLine(ctx, x1, y1, x2, y2, thickness, color){
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.lineWidth = thickness;
	ctx.strokeStyle = color;
	ctx.stroke();
}
function showTime(time){
	clearTimeout(timer);
	if(time < 0){
		$(".time-pad").html("");
	}else{
		if(time <= 10){
			$(".time-pad").html('<span style="color : red">'+time+'</span>');
		}else{
			$(".time-pad").html(time);
		}
		time = time -1;
		timer = setTimeout(showTime,1000,time);
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
