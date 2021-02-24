const httpServer = require("http").createServer();
const io = require("socket.io")(httpServer, {
  cors: {
    origin: '*',
  }
});

let DANGER = [10,13,25,30,40,60,62,63,65,70,80,90,98];
let GamesInProgress = [];
let Restart = [];
let pending = [];
let Turn = [];

io.on("connection", (socket) => {

  socket.on('exit',function(data){
    console.log(data)
  let {id,username} = data;
  if (id != '' && username != '') {
    let res = GamesInProgress.find((item)=>item.id == id);
    let resp = pending.find((item)=>item.ID == id);
  
    if(res != undefined || res != null){
      console.log(res)
    let p1 = res.player1.socketID;
    let p2 = res.player2.socketID;
    io.to(p1).emit('exit',username);
    io.to(p2).emit('exit',username);

    }
    else if(resp != undefined || resp != null){
      io.to(resp.SOCKETID).emit('exit','k15')
    }
   removeSocket(id);
    

  }

 })
  socket.on("join",function (data) {

  	let id = data.gameID;
  	let username = data.username;
  	if(isIdInProgress(id)){
  		socket.emit('join','error1');
  		return;
  	}
  	else if(isUsernameInProgress(id,username)){
  		socket.emit('join','error2');
  		return;
  	}
  	let res = addToPending(id,username,socket.id);
  	if(res == null){
  		// joined, but waiting for second player to join
  		socket.emit('join',res);
  		Turn = [...Turn,{"id":id,"turn":username}];
  	}
  	else{
  		// second player joined, game starts
  		let p1 = res.player1.socketID;
  		let p2 = res.player2.socketID;
  		io.to(p1).emit('join',res);
  		io.to(p2).emit('join',res);

  		// emit client details
  		let d1 = {
  			"socketId":res.player1.socketID,
  			"username":res.player1.username,
  			"opponent":username,
  			"srcPlayer":"assets/green.png",
  			"srcOpponent":"assets/blue.png"
  		};
  		let d2 = {
  			"socketId":res.player2.socketID,
  			"username":username,
  			"opponent":res.player1.username,
  			"srcPlayer":"assets/blue.png",
  			"srcOpponent":"assets/green.png"
  		};
  		// data required to start game, two players connected successfully
  		io.to(p1).emit('details',d1);
  		io.to(p2).emit('details',d2);

  		// decide turn
  		let pTurn = Turn.find((item)=> item.id == id).turn;
  	
  		io.to(p1).emit('turn',pTurn);
  		io.to(p2).emit('turn',pTurn);

  	}
  	

  })
  socket.on('restart',function(data){
  	// get sockets 
  	let res = GamesInProgress.find((item)=>item.id == data.id);
  	let p1 = res.player1.socketID;
  	let p2 = res.player2.socketID;
  	let resID = Restart.find((item)=>item.id == data.id);
  	if(resID == undefined){
  		Restart = [...Restart,{"id":data.id}];

  		// valid username indicates the player that shoud wait for other player
  		io.to(p1).emit('restart',data.username);
  		io.to(p2).emit('restart',data.username);

  	}
  	else{
  		// delete player that was waiting from the socket
  		let index = Restart.indexOf(resID);
  		Restart.splice(index,1);
  		// restart game
  		// null indicates that game should start, no wait expected
  		io.to(p1).emit('restart',null);
  		io.to(p2).emit('restart',null);

  	}
  })
  socket.on('play',function(data){
  	let {socketID,squareId} = data;
  	let res = GamesInProgress.find((item)=>item.player1.socketID == socketID || item.player2.socketID == socketID);
  	let p1 = res.player1.socketID;
  	let p2 = res.player2.socketID;
  	let turn1 = res.player1.username;
  	let turn2 = res.player2.username;
  	let pTurn;
  	let winner = null;
  	let boardData1 = {
  		"playerSquareNumber":'',
  		"opponentSquareNumber":'',
  		"prevPlayerSquareNumber":0,
  		"prevOpponentSquareNumber":0
  	}

  	let boardData2 = {
  		"playerSquareNumber":'',
  		"opponentSquareNumber":'',
  		"prevPlayerSquareNumber":0,
  		"prevOpponentSquareNumber":0
  	}


  	if(socketID == p1){
  		if(squareId == 6){
  			pTurn = turn1;
  		}
  		else{
  			pTurn = turn2;
  		}
  		// save pevious squares ids
  		boardData1.prevPlayerSquareNumber = res.player1.squareId; //current player prev square id
  		boardData2.prevOpponentSquareNumber = res.player1.squareId; // make it the same to opponent

  		// dont want it to exceed 100 
  		if(parseInt(res.player1.squareId) + parseInt(squareId) <= 100){
  			res.player1.squareId = parseInt(res.player1.squareId) + parseInt(squareId);
  		}
  		
  		
  		// check fire

  		if(DANGER.includes(res.player1.squareId)){
  			// reset to 0
  			res.player1.squareId = 0;
  			
  		}
  		else if(res.player1.squareId == res.player2.squareId){
  			// kill other player
  			pTurn = turn1;
  			res.player2.squareId = 0;
  		}
  		if(res.player1.squareId == 100){
  			winner = turn1;
  			pTurn = turn1;
  			res.player2.squareId = 0;
  			res.player1.squareId = 0;
  		}

  		// player 
  		
  		boardData1.playerSquareNumber = res.player1.squareId;
  		boardData1.opponentSquareNumber = res.player2.squareId;

		// opponent
  		boardData2.playerSquareNumber = res.player2.squareId;
  		boardData2.opponentSquareNumber = res.player1.squareId;


  	}
  	else{
  		if(squareId == 6){
  			pTurn = turn2;
  		}
  		else{
  			pTurn = turn1;
  		}
  		// save pevious squares ids
  		boardData2.prevPlayerSquareNumber = res.player2.squareId;
  		boardData1.prevOpponentSquareNumber = res.player2.squareId;

  		if(parseInt(res.player2.squareId) + parseInt(squareId) <= 100){
  			res.player2.squareId = parseInt(res.player2.squareId) + parseInt(squareId);
  		}
  		
  		

  		if(DANGER.includes(res.player2.squareId)){
  			
  			res.player2.squareId = 0;
  			
  		}
  		else if(res.player2.squareId == res.player1.squareId){
  			// kill other player
  			pTurn = turn2;
  			res.player1.squareId = 0;
  		}
  		// win
  		if(res.player2.squareId == 100){
  			winner = turn2;
  			pTurn = turn2;
  			res.player2.squareId = 0;
  			res.player1.squareId = 0;
  		}
  		// player 
  		boardData2.playerSquareNumber = res.player2.squareId;
  		boardData2.opponentSquareNumber = res.player1.squareId; 

  		// opponent
  		boardData1.playerSquareNumber = res.player1.squareId;
  		boardData1.opponentSquareNumber = res.player2.squareId;

  	}
  	

  	// square id update
  	io.to(p1).emit('progress',boardData1);
  	io.to(p2).emit('progress',boardData2);


  	// turn
  
  	io.to(p1).emit('turn',pTurn);
  	io.to(p2).emit('turn',pTurn);

  	// winner
  	
  	io.to(p1).emit('win',winner);
  	io.to(p2).emit('win',winner);




  })

});
function addToPending(id,username,socketID){
	let res = pending.find(item=>item.ID == id);
	let obj = null;
	if(res){
		 obj = {
			"id":res.ID,
			"player1":{"socketID":res.SOCKETID,"username":res.USERNAME,"squareId":0},
			"player2":{"socketID":socketID,"username":username,"squareId":0}
			};
		GamesInProgress = [...GamesInProgress,obj];
		let index = pending.indexOf(res);
		if(index != -1)
			// delete pending data
			pending.splice(index,1);
		return obj;
	}
	else{
		pending = [...pending,{"ID":id,"USERNAME":username,"SOCKETID":socketID}]
	}
	return null;
}
function isIdInProgress(id){
	let inprogress = GamesInProgress.find((item)=>item.id == id);
	if(inprogress == undefined || inprogress == null){
		return false;
	}
	return true;
}
function isUsernameInProgress(id,username){

	let inprogress = pending.find((item)=>item.ID == id && item.USERNAME == username);
	if(inprogress == undefined || inprogress == null){
		return false;
	}
	return true;
}
function removeSocket(id){
  let pend = pending.find((item)=>item.ID == id);
  let progress = GamesInProgress.find((item)=>item.id == id);

  let index1 = pending.indexOf(pend);
  let index2 = GamesInProgress.indexOf(progress);

    if(index1 != -1){
      
      pending.splice(index1,1);
    }
    if(index2 != -1){
      GamesInProgress.splice(index2,1);

    }
      
}


httpServer.listen(4000);