const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    maxHttpBufferSize: 10 * 1024 * 1024
});

app.use(express.static(path.join(__dirname, "public")));

const usuarios = {};

function gerarCorAleatoria() {
    const letras = "0123456789ABCDEF";
    let cor = "#";

    for (let i = 0; i < 6; i++) {
        cor += letras[Math.floor(Math.random() * 16)];
    }

    return cor;
}

io.on("connection", (socket) => {
    console.log("Usuário conectado:", socket.id);

    socket.on("entrar", (dados) => {
        const nome = (dados.nome || "Usuário").trim();
        const foto = dados.foto || null;

        console.log("Novo usuário:", nome);
        console.log("Foto recebida?", !!foto);

        usuarios[socket.id] = {
            id: socket.id,
            nome: nome,
            foto: foto,
            inicial: nome.charAt(0).toUpperCase(),
            cor: gerarCorAleatoria(),
            lat: null,
            lng: null
        };

        io.emit("usuariosAtualizados", usuarios);
    });

    socket.on("atualizarLocalizacao", (dados) => {
        if (!usuarios[socket.id]) return;

        usuarios[socket.id].lat = dados.lat;
        usuarios[socket.id].lng = dados.lng;

        io.emit("usuariosAtualizados", usuarios);
    });

    socket.on("sairDoMapa", () => {
        if (usuarios[socket.id]) {
            delete usuarios[socket.id];
            io.emit("usuariosAtualizados", usuarios);
        }
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});