var async = require('async');
var fs = require('fs-extra');
var marked = require('marked');
var request = require('request');
var util = require('util');

var url = {
  dist: 'https://nodejs.org/dist/%s',
  github: 'https://raw.githubusercontent.com/nodejs/node/%s/doc/api/%s.md',
};

// create dist directory if not exists
try {
  fs.accessSync('./dist', fs.R_OK | fs.W_OK);
} catch (e) {
  fs.mkdirSync('./dist');
}

// compy assets to dist
fs.copySync('./assets', './dist/assets');

// check list of nodejs versions
request(util.format(url.dist, 'index.json'), function (error, response, body) {
  if (!error && response.statusCode == 200) {
    var version = JSON.parse(body)[0].version;
    var branch = util.format('%s.x', version.substring(0, 2));
    console.log('node:', version);
    console.log('branch:', branch);

    // get list of files
    request(util.format(url.dist, util.format('%s/docs/api/index.json', version)), function (error, response, body) {
      if (!error && response.statusCode == 200) {

        var items = JSON.parse(body).desc;

        var modules = [];
        items.forEach(function (item) {
          if (item.type === 'text') {
            // spit string based http://rubular.com/r/O212WaPVqA
            var match = item.text.match(/\[(.*)\]\((.*)\.html\)/i);
            if (match !== null) {
              modules.push({
                title: match[1],
                name: match[2],
              });
            }
          };
        });

        // instance index.json
        var indexJson = {
          version: version,
          modules: modules,
        };

        // create index.json
        fs.writeFile('./dist/index.json', JSON.stringify(indexJson), function (err) {
          if (!err) {
            console.log('✓ index.json');
          }
        });

        // read template file
        fs.readFile('./html/template.html', 'utf8', function (err, htmlTemplate) {
          if (err) {
            console.log('Error reading template file');
          } else {
            console.log('modules:', modules.length);

            // download all markdown files and converts to html files
            async.forEachOf(modules, function (value, key, callback) {
              request(util.format(url.github, branch, value.name), function (error, response, body) {
                if (!error && response.statusCode == 200) {
                  marked(body, function (err, content) {
                    if (err) {
                      callback(err);
                    } else {
                      var htmlContent = util.format(htmlTemplate, value.title, content);
                      fs.writeFile(util.format('./dist/%s.html', value.name), htmlContent, function (err) {
                        if (!err) {
                          console.log('✓', value.name);
                          callback();
                        } else {
                          console.log('✗', value.name);
                          callback(err);
                        }
                      });
                    }
                  });
                } else {
                  callback(error);
                }
              });
            }, function (err) {
              console.log('done');
            });
          }
        });
      } else {
        console.log('Error on load list of files from version:', version);
      }
    });
  } else {
    console.log('Error on load list of node versions');
  }
});
