# express-super-dynamic

## installation

edit package.json and add this to the dependencies-object

    "express-super-dynamic": "git@github.com:Sebush/express-super-dynamic.git",

## usage

    var dynamic = require('express-super-dynamic')();
    var dynamicLong = require('express-super-dynamic')({
        maxAge: 300
    });
    app.use(dynamic);
    app.get('/...', dynamicLong);