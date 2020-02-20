const express = require('express');
const scrapper = require('website-scraper');
const zipFolder = require('zip-folder');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const scrappedPath = './scrapped/';
let name;
let requestNumber;
let buildPathPdf;

const buildPaths = {
    buildPathHtml: path.resolve('./build.html')
};

let data = [];


const createRow = (item) => `
  <tr>
    <td>${item.nameFile}</td>
    <td>${item.fileSize} KB</td>
  </tr>
`;

const createTable = (rows) => `
  <table>
    <tr>
        <th>Nombre de archivo</td>
        <th>Tamaño de archivo</td>
    </tr>
    ${rows}
  </table>
`;

const createHtml = (table) => `
  <html>
    <head>
      <style>
        table {
          width: 100%;
        }
        tr {
          text-align: left;
          border: 1px solid black;
        }
        th, td {
          padding: 15px;
        }
        tr:nth-child(odd) {
          background: #CCC
        }
        tr:nth-child(even) {
          background: #FFF
        }
        .no-content {
          background-color: red;
        }
      </style>
    </head>
    <body>
      ${table}
    </body>
  </html>
`;

/* GET home page. */
router.get('/', function (req, res) {
    res.render('index', {title: 'Express'});
});

const doesFileExist = (filePath) => {
    try {
        fs.statSync(filePath); // get information of the specified file path.
        return true;
    } catch (error) {
        return false;
    }
};

const printPdf = async () => {
    console.log('Starting: Generating PDF Process, Kindly wait ..');
    /** Launch a headleass browser */
    const browser = await puppeteer.launch();
    /* 1- Ccreate a newPage() object. It is created in default browser context. */
    const page = await browser.newPage();
    /* 2- Will open our generated `.html` file in the new Page instance. */
    await page.goto(buildPaths.buildPathHtml, {waitUntil: 'networkidle0'});
    /* 3- Take a snapshot of the PDF */
    const pdf = await page.pdf({
        format: 'A4',
        margin: {
            top: '20px',
            right: '20px',
            bottom: '20px',
            left: '20px'
        }
    });
    /* 4- Cleanup: close browser. */
    await browser.close();
    console.log('Ending: Generating PDF Process');
    return pdf;
};

const init = async (res) => {
    try {
        const pdf = await printPdf();
        fs.writeFileSync(buildPathPdf, pdf);
        console.log('Succesfully created an PDF table');
        zipFolder(scrappedPath + name, './zips/request#' + requestNumber + '.zip', function (err) {
            if (err) {
                console.log('oh no!', err);
            } else {
                console.log('EXCELLENT');
                res.sendFile(path.join(__dirname, '../zips/request#' + requestNumber + '.zip'));

            }
        });
    } catch (error) {
        console.log('Error generating PDF', error);
    }
};

// General function
function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ?
            walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

router.get('/:requestNumber' + ".zip", function (req, res) {
    res.sendFile(path.join(__dirname, '../zips/request#' + req.params.requestNumber + ".zip"));
});

router.get('/pagina', function (req, res) {
    name = req.body.url.replace('https://', '').replace('http://', '').replace('www.', '').replace('.com', '').replace('/', '');
    requestNumber = req.body.requestNumber;
    buildPathPdf = path.resolve(scrappedPath + name + '/Report.pdf');
    console.log(name);
    scrapper({
        urls: [req.body.url],
        directory: scrappedPath + name + '/assets',
        sources: [
            {selector: 'img', attr: 'src'},
            {selector: 'link[rel="stylesheet"]', attr: 'href'},
            {selector: 'script', attr: 'src'}
        ],
        subdirectories: [
            {directory: 'img', extensions: ['.jpg', '.png', '.svg']},
            {directory: 'js', extensions: ['.js']},
            {directory: 'css', extensions: ['.css']}
        ]
    }, (error, result) => {
        if (error) {
            console.log(error)
        } else {
            const directoryPath = path.join(scrappedPath + name + '/assets');
            walkDir(directoryPath, function (filePath) {
                const fileContents = fs.statSync(filePath);
                var name = filePath.replace(/\\/g, '/');
                var name2 = '';
                const countSlash = (name.split('/').length - 1);
                var count = 0;
                for (var i = 0; i < name.length; i++) {
                    if (count === countSlash) {
                        name2 += name.charAt(i);
                    }
                    if (name.charAt(i) === '/') {
                        count++;
                    }
                }
                data.push({
                    nameFile: name2,
                    fileSize: Math.trunc((fileContents.size) * 0.0009765625)
                })
            });

            data.sort((a, b) => {
                return b.fileSize - a.fileSize;
            });

            try {
                /* Check if the file for `html` build exists in system or not */
                if (doesFileExist(buildPaths.buildPathHtml)) {
                    console.log('Deleting old build file');
                    /* If the file exists delete the file from system */
                    fs.unlinkSync(buildPaths.buildPathHtml);
                }
                /* generate rows */
                const rows = data.map(createRow).join('');
                /* generate table */
                const table = createTable(rows);
                /* generate html */
                const html = createHtml(table);
                /* write the generated html to file */
                fs.writeFileSync(buildPaths.buildPathHtml, html);
                console.log('Succesfully created an HTML table');
            } catch (error) {
                console.log('Error generating table', error);
            }

            init(res);
        }
    });

});

module.exports = router;