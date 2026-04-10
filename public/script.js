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

function converterImagemParaBase64(arquivo) {
    return new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.readAsDataURL(arquivo);

        leitor.onload = () => resolve(leitor.result);
        leitor.onerror = (erro) => reject(erro);
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

    meuNome = nome;
    let fotoBase64 = null;

    if (arquivoFoto) {
        try {
            fotoBase64 = await converterImagemParaBase64(arquivoFoto);
        } catch (erro) {
            console.error("Erro ao converter imagem:", erro);
            alert("Erro ao carregar a foto.");
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

        const popupHTML = `
            <div class="popup-usuario">
                <strong>${usuario.nome}</strong>
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