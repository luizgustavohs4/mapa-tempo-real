let socket = io();

const formCadastro = document.getElementById("formCadastro");
const nomeInput = document.getElementById("nome");
const fotoInput = document.getElementById("foto");
const statusSpan = document.getElementById("status");
const onlineSpan = document.getElementById("online");
const btnSair = document.getElementById("btnSair");

let meuNome = "";
let meusMarcadores = {};
let meuWatchId = null;
let minhaPrimeiraLocalizacao = true;
let estouNoMapa = false;

const map = L.map("map").setView([-14.2350, -51.9250], 4);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
}).addTo(map);

function prepararImagem(arquivo) {
    return new Promise((resolve, reject) => {
        const leitor = new FileReader();

        leitor.onload = (evento) => {
            const img = new Image();

            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");

                const tamanhoMaximo = 150;
                let largura = img.width;
                let altura = img.height;

                if (largura > altura) {
                    if (largura > tamanhoMaximo) {
                        altura = altura * (tamanhoMaximo / largura);
                        largura = tamanhoMaximo;
                    }
                } else {
                    if (altura > tamanhoMaximo) {
                        largura = largura * (tamanhoMaximo / altura);
                        altura = tamanhoMaximo;
                    }
                }

                canvas.width = largura;
                canvas.height = altura;

                ctx.drawImage(img, 0, 0, largura, altura);

                const imagemBase64 = canvas.toDataURL("image/jpeg", 0.6);
                resolve(imagemBase64);
            };

            img.onerror = () => reject(new Error("Erro ao carregar a imagem."));
            img.src = evento.target.result;
        };

        leitor.onerror = () => reject(new Error("Erro ao ler o arquivo."));
        leitor.readAsDataURL(arquivo);
    });
}

function criarIconeUsuario(usuario) {
    let conteudoHTML = "";

    if (usuario.foto) {
        conteudoHTML = `
            <div class="avatar-marker">
                <img src="${usuario.foto}" alt="${usuario.nome}">
            </div>
        `;
    } else {
        conteudoHTML = `
            <div class="avatar-marker" style="background: ${usuario.cor};">
                <span class="avatar-letra">${usuario.inicial}</span>
            </div>
        `;
    }

    return L.divIcon({
        html: conteudoHTML,
        className: "icone-personalizado",
        iconSize: [56, 56],
        iconAnchor: [28, 28],
        popupAnchor: [0, -28]
    });
}

function iniciarGeolocalizacao() {
    if (!navigator.geolocation) {
        statusSpan.textContent = "Seu navegador não suporta geolocalização.";
        return;
    }

    statusSpan.textContent = "Solicitando localização...";

    meuWatchId = navigator.geolocation.watchPosition(
        (posicao) => {
            const latitude = posicao.coords.latitude;
            const longitude = posicao.coords.longitude;

            statusSpan.textContent = "Localização em tempo real ativa.";

            socket.emit("atualizarLocalizacao", {
                lat: latitude,
                lng: longitude
            });

            if (minhaPrimeiraLocalizacao) {
                map.setView([latitude, longitude], 15);
                minhaPrimeiraLocalizacao = false;
            }
        },
        (erro) => {
            console.error("Erro de geolocalização:", erro);

            if (erro.code === 1) {
                statusSpan.textContent = "Permissão de localização negada.";
            } else if (erro.code === 2) {
                statusSpan.textContent = "Localização indisponível.";
            } else if (erro.code === 3) {
                statusSpan.textContent = "Tempo de localização esgotado.";
            } else {
                statusSpan.textContent = "Erro ao obter localização.";
            }
        },
        {
            enableHighAccuracy: true,
            maximumAge: 3000,
            timeout: 10000
        }
    );
}

function sairDoMapa() {
    if (!estouNoMapa) return;

    if (meuWatchId !== null) {
        navigator.geolocation.clearWatch(meuWatchId);
        meuWatchId = null;
    }

    socket.emit("sairDoMapa");

    formCadastro.style.display = "flex";
    btnSair.style.display = "none";
    statusSpan.textContent = "Você saiu do mapa.";
    minhaPrimeiraLocalizacao = true;
    estouNoMapa = false;

    nomeInput.value = "";
    fotoInput.value = "";
    meuNome = "";
}

formCadastro.addEventListener("submit", async function (event) {
    event.preventDefault();

    const nome = nomeInput.value.trim();
    const arquivoFoto = fotoInput.files[0];

    if (!nome) {
        alert("Digite seu nome.");
        return;
    }

    if (arquivoFoto && arquivoFoto.size > 5 * 1024 * 1024) {
        alert("Escolha uma imagem menor que 5MB.");
        return;
    }

    meuNome = nome;
    let fotoBase64 = null;

    if (arquivoFoto) {
        try {
            statusSpan.textContent = "Preparando foto...";
            fotoBase64 = await prepararImagem(arquivoFoto);
            console.log("Tamanho da imagem em Base64:", fotoBase64.length);
        } catch (erro) {
            console.error("Erro ao preparar imagem:", erro);
            alert("Erro ao carregar a foto.");
            statusSpan.textContent = "Erro ao carregar a foto.";
            return;
        }
    }

    socket.emit("entrar", {
        nome: nome,
        foto: fotoBase64
    });

    formCadastro.style.display = "none";
    btnSair.style.display = "block";
    estouNoMapa = true;

    iniciarGeolocalizacao();
});

btnSair.addEventListener("click", sairDoMapa);

socket.on("usuariosAtualizados", (usuarios) => {
    onlineSpan.textContent = Object.keys(usuarios).length;

    for (const id in meusMarcadores) {
        if (!usuarios[id]) {
            map.removeLayer(meusMarcadores[id]);
            delete meusMarcadores[id];
        }
    }

    for (const id in usuarios) {
        const usuario = usuarios[id];

        if (usuario.lat === null || usuario.lng === null) {
            continue;
        }

        const icone = criarIconeUsuario(usuario);
        const nomeExibido = id === socket.id ? "Você" : usuario.nome;

        const popupHTML = `
            <div class="popup-usuario">
                <strong>${nomeExibido}</strong>
                <span>Usuário online</span>
            </div>
        `;

        if (meusMarcadores[id]) {
            meusMarcadores[id].setLatLng([usuario.lat, usuario.lng]);
            meusMarcadores[id].setIcon(icone);
            meusMarcadores[id].setPopupContent(popupHTML);
        } else {
            meusMarcadores[id] = L.marker([usuario.lat, usuario.lng], {
                icon: icone
            })
                .addTo(map)
                .bindPopup(popupHTML);
        }
    }
});