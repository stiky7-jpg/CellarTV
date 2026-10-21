const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const axios = require("axios");

// Il link della tua lista automatica su Pastebin
const PASTEBIN_URL = "https://pastebin.com/raw/2H8u433W";

// Configurazione del Manifest dell'Add-on
const manifest = {
    id: "org.francesco.listapastebin",
    version: "1.0.0",
    name: "Mia Lista Automatica (Pastebin)",
    description: "Legge dinamicamente i domini aggiornati da Pastebin",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"]
};

const builder = new addonBuilder(manifest);

// Funzione per scaricare i siti dal tuo Pastebin
async function getListaSiti() {
    try {
        const response = await axios.get(PASTEBIN_URL, { timeout: 5000 });
        const righe = response.data
            .split(/\r?\n/)
            .map(sito => sito.trim())
            .filter(sito => sito.startsWith("http"));
        return righe;
    } catch (error) {
        console.error("Errore lettura Pastebin:", error.message);
        return [];
    }
}

// Funzione per ricavare il titolo tramite Cinemeta
async function getTitoloDaImdb(type, imdbId) {
    try {
        const cleanId = imdbId.split(":")[0];
        const url = `https://v3-cinemeta.strem.io/meta/${type}/${cleanId}.json`;
        const res = await axios.get(url);
        return res.data?.meta?.name || null;
    } catch {
        return null;
    }
}

// Gestore delle richieste di Stremio
builder.defineStreamHandler(async ({ type, id }) => {
    const siti = await getListaSiti();
    const titolo = await getTitoloDaImdb(type, id);

    if (!titolo || siti.length === 0) {
        return { streams: [] };
    }

    const streams = [];

    for (const dominio of siti) {
        const nomeDominio = dominio.replace(/^https?:\/\//, "").replace(/\/$/, "");
        
        streams.push({
            name: `Lista Auto\n${nomeDominio}`,
            title: `Cerca "${titolo}" su ${nomeDominio}`,
            externalUrl: `${dominio}/?s=${encodeURIComponent(titolo)}`
        });
    }

    return { streams };
});

// Gestione della porta dinamica fornita da Render (o default 7000)
const port = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port: port });