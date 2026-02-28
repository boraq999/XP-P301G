const http = require('http');
const escpos = require('escpos');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { createCanvas } = require('canvas');

const port = 3333;
const PRINTER_PATH = "\\\\localhost\\XP80";

const PRINTER_WIDTH_PX = 560;
const PADDING = 20;

/**
 * يرسم فاتورة كاملة على Canvas ويعيدها كـ PNG Buffer
 * data: { company, title, invoiceNo, date, items:[{name,qty,total}], grandTotal, footer1, footer2 }
 */
function renderInvoiceToImage(data) {
    // أحجام خطوط ضخمة بناءً على طلب المستخدم
    const FONT_COMPANY = 38;
    const FONT_TITLE = 34;
    const FONT_HEADER = 28;
    const FONT_ITEMS = 32;
    const FONT_INFO = 24;
    const FONT_TOTAL = 36;
    const FONT_FOOTER = 24;

    const ITEM_LINE_HEIGHT = 65; // زيادة ارتفاع السطر للمنتجات لتجنب التداخل

    const itemsHeight = (data.items || []).length * ITEM_LINE_HEIGHT;
    const totalHeight = 650 + itemsHeight + 200; // زيادة الارتفاع الكلي للملف

    const canvas = createCanvas(PRINTER_WIDTH_PX, totalHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PRINTER_WIDTH_PX, totalHeight);

    let y = PADDING;

    function drawCentered(text, fontSize, bold = false, color = '#000000') {
        ctx.font = `${bold ? 'bold' : 'normal'} ${fontSize}px "Segoe UI", Arial`;
        ctx.textAlign = 'center';
        ctx.direction = 'rtl';
        ctx.fillStyle = color;
        ctx.fillText(text, PRINTER_WIDTH_PX / 2, y + fontSize); // الرسم بناءً على موضع علوي تقريبي
        y += fontSize + 25; // زيادة التباعد بين الأسطر
    }

    function drawDotLine() {
        y += 15;
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(PADDING, y);
        ctx.lineTo(PRINTER_WIDTH_PX - PADDING, y);
        ctx.stroke();
        ctx.setLineDash([]);
        y += 25;
    }

    function drawSolidLine() {
        y += 15;
        ctx.setLineDash([]);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(PADDING, y);
        ctx.lineTo(PRINTER_WIDTH_PX - PADDING, y);
        ctx.stroke();
        y += 25;
    }

    // اسم الشركة
    y += 20;
    drawCentered(data.company || 'شركة', FONT_COMPANY, true);

    // عنوان الفاتورة على خلفية سوداء
    const titleText = data.title || 'فاتورة';
    ctx.font = `bold ${FONT_TITLE}px "Segoe UI", Arial`;
    const titleWidth = ctx.measureText(titleText).width + 60;
    ctx.fillStyle = '#000000';
    ctx.fillRect((PRINTER_WIDTH_PX - titleWidth) / 2, y, titleWidth, FONT_TITLE + 25);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(titleText, PRINTER_WIDTH_PX / 2, y + FONT_TITLE + 5);
    y += FONT_TITLE + 60; // فجوة كبيرة بعد العنوان لتجنب التداخل مع الرقم

    // رقم الفاتورة والتاريخ
    ctx.fillStyle = '#000000';
    drawCentered(data.invoiceNo || '', FONT_INFO);
    drawCentered(data.date || '', FONT_INFO);

    drawDotLine();

    // رأس الجدول
    ctx.font = `bold ${FONT_HEADER}px "Segoe UI", Arial`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'right';
    ctx.direction = 'rtl';
    ctx.fillText('المنتج', PRINTER_WIDTH_PX - PADDING, y + FONT_HEADER);
    ctx.textAlign = 'center';
    ctx.fillText('كمية', PRINTER_WIDTH_PX / 2, y + FONT_HEADER);
    ctx.textAlign = 'left';
    ctx.fillText('إجمالي', PADDING, y + FONT_HEADER);
    y += FONT_HEADER + 30; // تباعد كافٍ قبل الخط الصلب
    drawSolidLine();

    // أسطر المنتجات
    (data.items || []).forEach(item => {
        ctx.font = `${FONT_ITEMS}px "Segoe UI", Arial`;
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'right';
        ctx.direction = 'rtl';
        ctx.fillText(item.name, PRINTER_WIDTH_PX - PADDING, y + FONT_ITEMS);
        ctx.textAlign = 'center';
        ctx.fillText(String(item.qty), PRINTER_WIDTH_PX / 2, y + FONT_ITEMS);
        ctx.textAlign = 'left';
        ctx.fillText(String(item.total), PADDING, y + FONT_ITEMS);
        y += ITEM_LINE_HEIGHT;
    });

    drawDotLine();

    // المجموع النهائي
    ctx.font = `normal ${FONT_INFO}px "Segoe UI", Arial`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'right';
    ctx.direction = 'rtl';
    ctx.fillText('المجموع النهائي:', PRINTER_WIDTH_PX - PADDING, y + FONT_INFO);
    ctx.font = `bold ${FONT_TOTAL}px "Segoe UI", Arial`;
    ctx.textAlign = 'left';
    ctx.fillText(data.grandTotal || '', PADDING, y + FONT_TOTAL);
    y += FONT_TOTAL + 60;

    // تذييل
    drawCentered(data.footer1 || '', FONT_FOOTER);
    drawCentered(data.footer2 || '', FONT_FOOTER);

    return canvas.toBuffer('image/png');
}


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
                const data = JSON.parse(body);
                const { image, invoice } = data;

                console.log("📥 Received print request. Processing...");

                if (image) {
                    fs.writeFileSync(tempPng, Buffer.from(image, 'base64'));
                    processImageAndPrint(tempPng, tempRaw, res);
                } else if (invoice) {
                    console.log("🖊️ Rendering HUGE invoice via Canvas...");
                    const pngBuffer = renderInvoiceToImage(invoice);
                    fs.writeFileSync(tempPng, pngBuffer);
                    processImageAndPrint(tempPng, tempRaw, res);
                } else {
                    throw new Error("No image or invoice data provided");
                }

            } catch (err) {
                handleError(err, res);
            }
        });
    }
});

function processImageAndPrint(pngPath, rawPath, res) {
    const dummyAdapter = { write: (data, cb) => cb && cb() };
    const printer = new escpos.Printer(dummyAdapter);

    escpos.Image.load(pngPath, (img) => {
        try {
            printer.align('ct').raster(img).cut();
            const rawData = printer.buffer.flush();
            fs.writeFileSync(rawPath, rawData);
            sendToPrinter(rawPath, res);
        } catch (err) {
            handleError(err, res);
        }
    });
}

function sendToPrinter(filePath, res) {
    console.log("📤 Sending RAW data to shared path...");
    exec(`copy /b "${filePath}" "${PRINTER_PATH}"`, (error) => {
        if (error) {
            console.error("❌ Print Error:", error.message);
            res.writeHead(500);
            res.end(JSON.stringify({ error: "تأكد من مشاركة الطابعة باسم XP80" }));
        } else {
            console.log("✅ Printed Successfully!");
            res.writeHead(200);
            res.end(JSON.stringify({ success: true }));
        }
        setTimeout(() => {
            try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) { }
            try { if (fs.existsSync(filePath.replace('.raw', '.png'))) fs.unlinkSync(filePath.replace('.raw', '.png')); } catch (e) { }
        }, 500);
    });
}

function handleError(err, res) {
    console.error("❌ Error:", err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
}

server.listen(port, () => {
    console.log(`\n🚀 Huge Invoice Server: http://localhost:${port}`);
    console.log(`📌 Targeted Path -> ${PRINTER_PATH}`);
    console.log(`✅ Canvas HUGE Invoice Rendering: ENABLED\n`);
});
