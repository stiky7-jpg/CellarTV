const http = require('http');
const https = require('https');

const PASTEBIN_URL = "https://pastebin.com/raw/2H8u433W";
const PORT = process.env.PORT || 7000;

// Funzione helper per scaricare dati via HTTPS
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', err => reject(err));
    });
}

// Scarica la lista da Pastebin
async function getListaSiti() {
    try {
        const rawData = await fetchUrl(PASTEBIN_URL);
        return rawData
            .split(/\r?\n/)
            .map(sito => sito.trim())
            .filter(sito => sito.startsWith("http"));
    } catch (error) {
        console.error("Errore lettura Pastebin:", error.message);
        return [];
    }
}

// Ottiene il titolo da Cinemeta
async function getTitoloDaImdb(type, imdbId) {
    try {
        const cleanId = imdbId.split(":")[0];
        const url = `https://v3-cinemeta.strem.io/meta/${type}/${cleanId}.json`;
        const resData = await fetchUrl(url);
        const json = JSON.parse(resData);
        return json?.meta?.name || null;
    } catch {
        return null;
    }
}

// Crea il server HTTP che risponde direttamente alle chiamate di Stremio
const server = http.createServer(async (req, res) => {
    // Imposta gli header CORS per permettere a Stremio di comunicare col server
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');

    const urlPath = req.url.split('?')[0];

    // 1. Risposta al Manifest dell'Add-on
    if (urlPath === '/manifest.json') {
        const manifest = {
            id: "org.francesco.listapastebin",
            version: "1.0.2",
            name: "Mia Lista Automatica (Pastebin)",
            description: "Add-on nativo per lista Pastebin",
            resources: ["stream"],
            types: ["movie", "series"],
            idPrefixes: ["tt"],
            catalogs: []
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(manifest));
        return;
    }

    // 2. Risposta alle richieste di Stream
    if (urlPath.startsWith('/stream/')) {
        // Esempio path: /stream/movie/tt1234567.json
        const parts = urlPath.split('/');
        if (parts.length >= 4) {
            const type = parts[2];
            const idWithExt = parts[3]; // es. tt1234567.json
            const id = idWithExt.replace('.json', '');

            const siti = await getListaSiti();
            const titolo = await getTitoloDaImdb(type, id);

            const streams = [];
            if (titolo && siti.length > 0) {
                for (const dominio of siti) {
                    const nomeDominio = dominio.replace(/^https?:\/\//, "").replace(/\/$/, "");
                    streams.push({
                        name: `Lista Auto\n${nomeDominio}`,
                        title: `Cerca "${titolo}" su ${nomeDominio}`,
                        externalUrl: `${dominio}/?s=${encodeURIComponent(titolo)}`
                    });
                }
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ streams }));
            return;
        }
    }

    // Fallback per altre rotte
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`Server nativo Stremio avviato sulla porta ${PORT}`);
});
