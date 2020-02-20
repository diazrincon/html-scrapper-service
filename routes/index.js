var express = require('express');
var pdf = require('html-pdf');
var rimraf = require("rimraf");
const scrape = require('website-scraper');
const path = require('path');
const pathPaginas  = './scrapped/';
var router = express.Router();
var name;
var table;
var requestNumber;
var buildPathPdf;
var zipFolder = require('zip-folder');
var options = {
    "format": "A4",
    "orientation": "landscape",
    "border": {
        "top": "0.1in",
    },
    "timeout": "120000"
};
const fs = require('fs');
var data = [];


/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});

const init = async (res) => {
    try {
        table += "<table border='1' style='width:100%;word-break:break-word;'>";
        table += "<tr>";
        table += "<th >Nombre de archivo</th>";
        table += "<th >Tamaño de archivo";
        table += "</tr>";
        data.forEach(function(row){
            table += "<tr>";
            table += "<td>"+row.nameFile+"</td>";
            table += "<td>"+row.fileSize+"</td>";
            table += "</tr>";
        });
        table += "</table>";
        await pdf.create(table, options).toFile(pathPaginas + name + '/Report.pdf', function(err, result) {
            if (err) return console.log(err);
            console.log("pdf create");
            data = [];
            table = '';
            zipFolder(pathPaginas + name , './zips/request#'+requestNumber +'.zip', async function(err) {
                if(err) {
                    console.log('oh no!', err);
                } else {
                    console.log('EXCELLENT');
                    await res.status(200).send('Download ready');
                    console.log('send')
                    await rimraf.sync(pathPaginas+name);
                }
            });
        });

    } catch (error) {
        console.log('Error generating PDF', error);
        data = {};
        table = '';
    }
};


function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach( f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ?
            walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
};

router.get('/:requestNumber'+".zip",function (req,res,next) {
    res.sendFile(path.join(__dirname, '../zips/request#'+ req.params.requestNumber+".zip"));
});

router.post('/pagina',function (req,res,next) {
    name = req.body.url.replace('https://', '').replace('http://','').replace('www.','').replace('.com','').replace('/','');
    requestNumber = req.body.requestNumber;
    buildPathPdf = path.resolve(pathPaginas + name + '/Report.pdf')
    console.log(name);
    scrape({
        urls: [req.body.url],
        directory: pathPaginas + name+'/assets',
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
        if(error){
            console.log(error)
        }
        else{
            const directoryPath = path.join(pathPaginas+name+'/assets');
            walkDir(directoryPath, function(filePath) {
                const fileContents = fs.statSync(filePath);
                var name  = filePath.replace(/\\/g, '/');
                var name2 = '';
                const countSlash = (name.split('/').length - 1);
                var count = 0;
                for (var i = 0; i < name.length; i++) {
                    if(count == countSlash){
                        name2 += name.charAt(i);
                    }
                    if(name.charAt(i) == '/'){
                        count++;
                    }
                }
                data.push({
                    nameFile: name2,
                    fileSize: Math.trunc((fileContents.size)*0.0009765625)
                })
            });

            data.sort((a,b)=>{
                return b.fileSize-a.fileSize;
            });
            init(res);
        }
    });

});

module.exports = router;