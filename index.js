var _ = require('underscore'),
    zlib = require('zlib'),
    listeners = [],
    dictCache = {
        raw: {},
        gzip: {},
        deflate: {},
    };

/*
 * Middleware
 */

module.exports = function(options){
    options = _.extend({
        status: 200,
        maxAge: 0,
        chunked: false,
        cache: false,  // express-super-cache
        cachePrefix: 'dynamic:',
        compress: true,
        download: false
    }, options || {});
    return function(req, res, next){
        var type = 'raw';
        var encodingHeader = req.headers['accept-encoding'];
        if(encodingHeader){
            if(encodingHeader.match(/\bgzip\b/)){
                type = 'gzip';
            }else if(encodingHeader.match(/\bdeflate\b/)){
                type = 'deflate';
            }
        }
        var jsonBool = req.xhr && (req.get('Accept') == 'application/json, text/javascript, */*; q=0.01' || req.get('Accept') == '*/*');
        var cacheKey = options.cachePrefix+req.url+':'+type+':'+jsonBool;

        var _fn = function(){
            res.dynamic = function() {
                if(jsonBool){
                    var result = {
                        template: arguments[0],
                        data: _.extend({}, res.app.locals, res.locals, arguments[1] || {})
                    };
                    if(options.cache){
                        options.cache.set(cacheKey, result);
                    }
                    return res.json(result);
                }

                var self = this,
                    template = null,
                    renderOptions = {},
                    cb = null;

                if(typeof arguments[0] == 'string'){
                    template = arguments[0];
                }else if(typeof arguments[0] == 'object' && arguments[0]._layout){
                    template = arguments[0]._layout;
                }

                if(typeof arguments[1] == 'object'){
                    renderOptions = arguments[1];
                }else if(typeof arguments[1] == 'function'){
                    cb = arguments[1];
                }

                if(typeof arguments[2] == 'function'){
                    cb = arguments[2];
                }

                res.render(template, renderOptions, function(err, html){
                    if(err){
                        console.error(err, err.stack);
                        return cb && cb(err);
                    }

                    // Clean comments & Whitespace
                    html = html.replace(/<!--(?!\s*?\[\s*?if)[\s\S]*?-->/gi, '')
                               .replace(/(^\s+|\s+$)/gim,'')
                               .replace(/(\r?\n)+/g, '\n')
                               .replace(/>(\r?\n|\s+)</g, '> <');

                    if(cb) return cb(err, html);

                    var headers = {
                        'ETag': ''+html.length,
                        'Content-Type': 'text/html; charset=utf-8'
                    };

                    if (req.headers['if-none-match'] === headers.ETag) {
                        return res.status(304).end();
                    }

                    if(options.maxAge){
                      headers['Cache-Control'] = 'public, max-age='+options.maxAge;
                      // headers['Last-Modified'] = req.app.vars['Last-Modified'];
                    }else{
                      headers['Cache-Control'] = 'public, max-age=0';
                    }
                    // headers['X-UA-Compatible'] = 'IE=edge,chrome=1';
                    headers['Vary'] = 'Accept-Encoding';
                    // headers['transfer-encoding'] = '';
                    headers['Connection'] = 'keep-alive';

                    if(type == 'raw'){
                        headers['Content-Length'] = html.length;
                        if(options.cache){
                            options.cache.set(cacheKey, {
                                headers: headers,
                                content: html
                            });
                        }
                        res.writeHead(options.status, headers);
                        return res.end(html);
                    }

                    zlib[type](new Buffer(html, 'utf-8'), function (err, result) {
                        if(err){
                            console.error('zlib', err, err.stack);
                            return cb && cb(err);
                        }
                        headers['Content-Encoding'] = type;
                        headers['Content-Length'] = result.length;
                        if(options.cache){
                            options.cache.set(cacheKey, {
                                headers: headers,
                                content: result
                            });
                        }
                        res.writeHead(options.status, headers);
                        res.end(result);
                    });
                });
            };

            next();
        };

        if(options.cache){
            options.cache.get(cacheKey, function(err, item){
                if(err){
                    console.error('express-super-dynamic', err, err.stack);
                }
                if(item){
                    if(jsonBool){
                        return res.json(item);
                    }else if (req.headers['if-none-match'] === item.headers.ETag) {
                        return res.status(304).end();
                    }else{
                        res.writeHead(options.status, item.headers);
                        return res.end(Buffer(item.content));
                    }
                }else{
                    return _fn();
                }
            });
        }else{
            return _fn();
        }

    };
};