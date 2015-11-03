# express-super-dynamic

## description

add the method 'dynamic' to request-object
works like req.render(tpl, data) from express with cache, maxAge- & content-length-header
ajax-request (from jquery) + type json return json(arguments)

## installation

edit package.json and add this to the dependencies-object

    "express-super-dynamic": "Sebush/express-super-dynamic",

## usage

    var app = require('express')();
    var dynamic = require('express-super-dynamic')();
    var dynamicLong = require('express-super-dynamic')({
        cache: redisClient,
        maxAge: 300
    });
    app.use(dynamic);
    app.get('/...', dynamicLong, function(req, res){
        res.dynamic('myTemplate', {foo: bar});
    });
    app.listen(8080);