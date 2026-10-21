const http = require('http');
const https = https = require('https');

const PASTEBIN_URL = "https://pastebin.com/raw/2H8u433W";
const PORT = process.env.PORT || 7000;

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', err => reject(err));
    });
}

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

const server = http.createServer(async (req, res) => {
    // Header CORS obbligatori per Stremio
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const urlPath = req.url.split('?')[0];

    // Rotta Manifest
    if (urlPath === '/manifest.json') {
        const manifest = {
            id: "org.francesco.cellartv",
            version: "1.0.3",
            name: "CellarTV Lista Auto",
            description: "Add-on Stremio per lista Pastebin",
            resources: ["stream"],
            types: ["movie", "series"],
            idPrefixes: ["tt"],
            catalogs: []
        };
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(manifest));
        return;
    }

    // Rotta Stream
    if (urlPath.startsWith('/stream/')) {
        const parts = urlPath.split('/');
        if (parts.length >= 4) {
            const type = parts[2];
            const idWithExt = parts[3];
            const id = idWithExt.replace('.json', '');

            const siti = await getListaSiti();
            const titolo = await getTitoloDaImdb(type, id);

            const streams = [];
            if (titolo && siti.length > 0) {
                for (const dominio of siti) {
                    const nomeDominio = dominio.replace(/^https?:\/\//, "").replace(/\/$/, "");
                    streams.push({
                        name: `CellarTV\n${nomeDominio}`,
                        title: `Cerca "${titolo}" su ${nomeDominio}`,
                        externalUrl: `${dominio}/?s=${encodeURIComponent(titolo)}`
                    });
                }
            }

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ streams }));
            return;
        }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`CellarTV server avviato sulla porta ${PORT}`);
});

server.listen(PORT, () => {
    console.log(`Server nativo Stremio avviato sulla porta ${PORT}`);
});
