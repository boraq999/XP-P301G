const http = require('http');
const escpos = require('escpos');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const port = 3333;
const PRINTER_PATH = "\\\\localhost\\XP80";

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200); res.end(); return;
    }

    if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'running', method: "Shared Path via Windows", target: PRINTER_PATH }));
        return;
    }

    if (req.method === 'POST' && req.url === '/print') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            const tempPng = path.join(__dirname, 'temp_print.png');
            const tempRaw = path.join(__dirname, 'print.raw');

            try {
                const { image } = JSON.parse(body);
                if (!image) throw new Error("No image data");

                console.log("📥 Received print request. Processing...");
                fs.writeFileSync(tempPng, Buffer.from(image, 'base64'));

                // Dummy Adapter to collect buffer
                const dummyAdapter = { write: (data, cb) => cb && cb() };
                const printer = new escpos.Printer(dummyAdapter);

                escpos.Image.load(tempPng, (img) => {
                    try {
                        // Use raster for faster and more reliable thermal printing
                        printer.align('ct').raster(img).cut();

                        // Extract the generated raw data
                        const rawData = printer.buffer.flush();
                        fs.writeFileSync(tempRaw, rawData);

                        console.log("📤 Sending RAW data to shared path...");
                        // Copy binary file to the printer's shared path
                        exec(`copy /b "${tempRaw}" "${PRINTER_PATH}"`, (error) => {
                            if (error) {
                                console.error("❌ Print Error:", error.message);
                                res.writeHead(500);
                                res.end(JSON.stringify({ error: "تأكد من مشاركة الطابعة باسم XP80" }));
                            } else {
                                console.log("✅ Printed Successfully!");
                                res.writeHead(200);
                                res.end(JSON.stringify({ success: true }));
                            }
                            // Cleanup
                            setTimeout(() => {
                                try { if (fs.existsSync(tempPng)) fs.unlinkSync(tempPng); if (fs.existsSync(tempRaw)) fs.unlinkSync(tempRaw); } catch (e) { }
                            }, 500);
                        });
                    } catch (err) {
                        console.error("❌ Processing Error:", err.message);
                        res.writeHead(500);
                        res.end(JSON.stringify({ error: err.message }));
                    }
                });

            } catch (err) {
                console.error("❌ Server Error:", err.message);
                res.writeHead(500);
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    }
});

server.listen(port, () => {
    console.log(`\n🚀 Stable Silent Server: http://localhost:${port}`);
    console.log(`📌 Targeted Path -> ${PRINTER_PATH}\n`);
});
