#!/usr/bin/env node

const fs = require('fs');

const cleanCSS = require('clean-css');
const mustache = require('mustache');
const uglifyJS = require('uglify-js');

function mkdirp(dirname) {
    try {
        fs.mkdirSync(dirname);
    } catch (e) {
        // ignore, directory already exists
    }
}

function generate() {
    const nationalStats = JSON.parse(fs.readFileSync('national.json', 'utf-8').toString());
    const provincesStats = JSON.parse(fs.readFileSync('provinces.json', 'utf-8').toString());

    /* news is an array of object, each with `title` and `url` properties.
       Example:
         [
           {
            "title": "Pemerintah Setujui Status PSBB untuk Tangerang dan Tangsel",
            "url": "https://nasional.tempo.co/read/1330740/pemerintah-setujui-status-psbb-untuk-tangerang-dan-tangsel"
           }
        ]
    */
    let news = [];
    if (fs.existsSync('news.json')) {
        news = JSON.parse(fs.readFileSync('news.json', 'utf-8').toString());
    }

    const include = {};
    const fnames = ['meta.mustache', 'header.mustache', 'footer.mustache', 'style.css', 'animation.js', 'filter.js'];
    fnames.forEach((name) => {
        const filename = `template/${name}`;
        let content = fs.readFileSync(filename, 'utf-8').toString();
        const key = name.replace('.mustache', '').replace('.', '-');
        include[key] = content;
        if (name.indexOf('.js') > 0) {
            content = uglifyJS.minify(content).code;
        } else if (name.indexOf('.css') > 0) {
            const process = new cleanCSS({}).minify(content);
            content = process.styles;
        }
        include[key] = content;
    });

    let timestamp = null;
    if (fs.existsSync('update.timestamp')) {
        const updateContent = fs.readFileSync('update.timestamp', 'utf-8').toString().trim();
        const unixEpoch = parseInt(updateContent, 10);
        if (Number.isNaN(unixEpoch)) {
            console.error('Invalid update timestamp', updateContent);
        } else {
            const jakartaTZOffset = 7;
            const updateDateTime = new Date(unixEpoch + jakartaTZOffset * 60 * 60 * 1000);
            const monthNames = 'JanFebMarAprMeiJunJulAgtSepOktNovDes';
            let minutes = updateDateTime.getMinutes().toString();
            if (minutes.length < 2) minutes = '0' + minutes;
            timestamp = [
                updateDateTime.getDate(),
                monthNames.substr(3 * updateDateTime.getMonth(), 3),
                updateDateTime.getHours() + ':' + minutes,
                'WIB'
            ].join(' ');
        }
    }

    function format(numbers) {
        ['infected', 'recovered', 'fatal'].forEach((key) => {
            // Adapted from https://stackoverflow.com/a/2901298/2399252
            numbers[key] = numbers[key].toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        });
        return numbers;
    }

    const stats = { ...nationalStats, regions: provincesStats };
    stats.numbers = format(stats.numbers);
    stats.regions = stats.regions.sort((p, q) => q.numbers.infected - p.numbers.infected);
    stats.regions.forEach((prov) => {
        prov.numbers = format(prov.numbers);
        prov.name = prov.name.replace('Daerah Istimewa', 'DI');
        prov.id = prov.name.replace(/\s/g, '').toLowerCase();
    });
    const preview = news.length >= 3;
    const snippets = preview ? news.slice(0, 3) : [];
    const indexData = { timestamp, include, stats, preview, snippets };
    const indexTemplate = fs.readFileSync('template/index.mustache', 'utf-8').toString();
    const intermediateIndex = mustache.render(indexTemplate, indexData);
    const indexHtml = mustache.render(intermediateIndex, indexData);
    mkdirp('public');
    fs.writeFileSync('public/index.html', indexHtml);

    const newsData = { include, news };
    const newsTemplate = fs.readFileSync('template/news.mustache', 'utf-8').toString();
    const intermediateNews = mustache.render(newsTemplate, newsData);
    const newsHtml = mustache.render(intermediateNews, newsData);
    mkdirp('public/berita');
    fs.writeFileSync('public/berita/index.html', newsHtml);

    fs.copyFileSync('template/favicon.ico', 'public/favicon.ico');
}

module.exports = generate;

generate();
