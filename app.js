
/**
 * Module dependencies.
 */

var express = require('express');
var promise = require('node-promise');

var app = module.exports = express.createServer();

// Retrieve
var mongodb = require('mongodb');
var BSON = mongodb.BSONPure;
var MongoClient = mongodb.MongoClient;

var mongoUri = "mongodb://localhost:27017/stellaDb";


// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'none');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes

app.post('/projects/:projectId', function (req, res) {
    MongoClient.connect(mongoUri, function(err, db) {
        if(err) { return console.dir(err); }
    
        if (req.body.scenes) {
            db.collection('scenes', function(err, collection) {
                if(err) { return console.dir(err); }
                
                var input = req.body.scenes;
                var output = new Array(input.length);
                var promises = [];
                
                input.forEach(function (item, i) {
                    var defered = new promise.defer();
                    //TODO: escape '$'
                    if ('_id' in item) {
                        var _id = BSON.ObjectID(item._id);
                        delete item._id;
                        collection.update({'_id': _id}, {$set: item}, {w: 1, multi:false, upsert: true}, function (err, result) {
                            if(err) { return console.dir('update failed:' + err); }
                            else { output[i] = { _id: _id }; }  //return only _id
                            defered.resolve();
                        });
                    } else {
                        collection.insert(item, {w: 1}, function (err, result) {
                            if(err) { return console.dir('insert failed:' + err); }
                            else { output[i] = result; }  //return new document
                            defered.resolve();
                        });
                    }
                    promises.push(defered.promise);
                });
                
                promise.all(promises).then(function () {
                    if (output.indexOf(null) === -1) res.status(200);
                    else res.status(422);
                    res.json({"scenes": output});
                });
            });
        }
    });
});

app.get('/projects/:projectId/scenes.json', function (req, res) {
    /*
    var stubData = [
        {title:'scene-1', content: 'Hello!<p>This is an <strong>example</strong> paragraph</p>'},
        {title:'', content: '池のほとりにかえるが住んでいました。かえるは自分の名前があまり好きではありませんでした。「かえるなんて名前より、もっとふさわしい素敵な名前があるはずだよ。」かえるはまいにちそう考えて暮らしていました。'},
        {title:'', content: 'ある朝かえるは思いました。「そうだ、神様にお願いして新しい名前をつけてもらおう。神様ならきっと素敵な名前をつけてくださるはずだよ。」そう思うといてもたってもいられなくなり、かえるは神様のところへ出かけました。'},
        {title:'', content: '半日歩いて神様のところへついたかえるはいいました。「神様、ぼくにはかえるという名前は似合っていません。もっと上等な名前をくださいな。」神様はおっしゃいました。「かえるよ、お前は以前にも同じ願いをしにきたのを忘れたのか。お前が名前をかえるかえるといってばかりなので、とうとうかえるという名前になったのじゃ。」'},
    ];
    return stubData;
    */
    
    MongoClient.connect(mongoUri, function(err, db) {
        if(err) { return console.dir(err); }
    
        db.collection('scenes', function(err, collection) {
            if(err) { return console.dir(err); }
            collection.find({}).toArray(function (err, result) {
                if(err) { return console.dir(err); }

                res.json(result);
            });
        });
    });
});

app.listen(process.env.PORT || 3000);
