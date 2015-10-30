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
        maxAge: 0,
        chunked: false,
        cache: false,  // express-super-cache
        cachePrefix: 'dynamic:',
        compress: true,
        download: false
    }, options || {});
    return function(req, res, next){
        if(req.xhr && req.get('X-Requested-With') == 'XMLHttpRequest'){
            req.isAjax = true;
        }
        var type = 'raw';
        var encodingHeader = req.headers['accept-encoding'];
        if(encodingHeader){
            if(encodingHeader.match(/\bgzip\b/)){
                type = 'gzip';
            }else if(req.headers['accept-encoding'].match(/\bdeflate\b/)){
                type = 'deflate';
            }
        }
        var cacheKey = options.cachePrefix+req.url+':'+type;

        var _fn = function(){
            res.dynamic = function() {

                var self = this;
                var template = null;
                var renderOptions = {};
                var cb = undefined;

                if(req.isAjax && req.get('Accept') == 'application/json, text/javascript, */*; q=0.01'){
                    return res.json({arguments: arguments});
                }

                if(typeof arguments[0] == 'string'){
                    template = arguments[0];
                }

                if(typeof arguments[0] == 'object' && arguments[0]._layout){
                    template = arguments[0]._layout;
                }

                if(typeof arguments[1] == 'object'){
                    renderOptions = arguments[1];
                }

                res.render(template, renderOptions, function(err, html){
                    if(err){
                        return console.error(err, err.stack);
                    }
                    var headers = {
                        'ETag': ''+html.length,
                        'Content-Type': 'text/html; charset=utf-8'
                    };

                    if(options.maxAge){
                      headers['Cache-Control'] = 'public, max-age='+options.maxAge;
                      // headers['Last-Modified'] = req.app.vars['Last-Modified'];
                    }else{
                      headers['Cache-Control'] = 'public, max-age=0';
                    }
                    headers['X-UA-Compatible'] = 'IE=edge,chrome=1';
                    headers['Vary'] = 'Accept-Encoding';
                    // headers['transfer-encoding'] = '';
                    headers['Connection'] = 'keep-alive';

                    if(type == 'raw'){
                        headers['content-length'] = html.length;
                        if(options.cache){
                            options.cache.set(cacheKey, {
                                headers: headers,
                                content: html
                            });
                        }
                        res.writeHead(200, headers);
                        return res.end(html);
                    }

                    zlib[type](new Buffer(html, 'utf-8'), function (err, result) {
                        if(err){
                            return console.error('zlib', err, err.stack);
                        }
                        headers['Content-Encoding'] = type;
                        headers['Content-Length'] = result.length;

                        if(options.cache){
                            options.cache.set(cacheKey, {
                                headers: headers,
                                content: result
                            });
                        }

                        res.writeHead(200, headers);
                        res.end(result);
                    });
                });
            };

            next();
        };

        if(options.cache){
            options.cache.get(cacheKey, function(err, item){
                // console.log('// #########################', item);
                err && console.error('express-super-dynamic', err, err.stack);
                if(item){
                    // console.log('// #########################', req.headers['if-none-match'] === item.headers.ETag);
                    if (req.headers['if-none-match'] === item.headers.ETag) {
                        return res.status(304).end();
                    }else{
                        // console.log(item.headers);
                        res.writeHead(200, item.headers);
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