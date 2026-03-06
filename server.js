const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const http = require("http");

const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "bingo",
  password: "127127",
  port: 5432,
});

// Generate cartelle if empty (same as before)
function getUniqueNumbers(min, max, count){ const nums = new Set(); while(nums.size<count){nums.add(Math.floor(Math.random()*(max-min+1))+min);} return Array.from(nums); }
function generateCartellaGrid(){ const B=getUniqueNumbers(1,15,5), I=getUniqueNumbers(16,30,5), N=getUniqueNumbers(31,45,5), G=getUniqueNumbers(46,60,5), O=getUniqueNumbers(61,75,5); const grid=[]; for(let row=0; row<5; row++){grid[row]=[B[row],I[row],N[row],G[row],O[row]];} grid[2][2]=0; return grid;}
function flattenCartella(grid){return grid.flat();}
async function generateCartelleIfEmpty(){ const res = await pool.query("SELECT COUNT(*) FROM cartelle"); if(parseInt(res.rows[0].count)>0) return; for(let i=1;i<=200;i++){ const grid=generateCartellaGrid(); await pool.query("INSERT INTO cartelle(name,numbers) VALUES($1,$2)",[`Cartella ${i}`, flattenCartella(grid)]);} console.log("200 cartelle generated");}
generateCartelleIfEmpty();

// ------------------- API ------------------- //
app.get("/api/cartelle", async (req,res)=>{
  try{
    const result = await pool.query("SELECT id,name,numbers FROM cartelle ORDER BY id");
    res.json(result.rows);
  } catch(err){ res.status(500).json({error:"Failed to fetch cartelle"}); }
});

// ------------------- Socket.IO for real-time ------------------- //
let gameInProgress = false;
let calledNumbers = [];
let players = []; // {userId, cartellaIds}

io.on("connection", (socket)=>{
  console.log("User connected", socket.id);

  // Player joins
  socket.on("joinGame", ({userId, cartellaIds})=>{
    if(gameInProgress){
      socket.emit("gameFull","Game already started");
      return;
    }
    players.push({userId, cartellaIds});
    socket.userId = userId;
    socket.cartellaIds = cartellaIds;
    console.log(`Player ${userId} joined`);
  });

  // Start game (admin or first player triggers)
  socket.on("startGame", ()=>{
    if(gameInProgress) return;
    gameInProgress = true;
    calledNumbers = [];
    const numbersPool = Array.from({length:75},(_,i)=>i+1).sort(()=>Math.random()-0.5);
    let idx=0;
    const interval = setInterval(()=>{
      if(idx>=numbersPool.length){ clearInterval(interval); gameInProgress=false; players=[]; io.emit("gameEnded"); return; }
      const n = numbersPool[idx++];
      calledNumbers.push(n);
      io.emit("numberCalled", n); // broadcast to all
    },1000);
  });

  socket.on("disconnect", ()=>{ console.log("User disconnected", socket.id); });
});

// ------------------- Start server ------------------- //
const PORT = 3000;
server.listen(PORT, ()=>console.log(`Server running at http://localhost:${PORT}`));