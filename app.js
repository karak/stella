
/**
 * Module dependencies.
 */

var express = require('express');

var app = module.exports = express.createServer();


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
    res.status(200);
});

app.get('/projects/:projectId/scenes.json', function (req, res) {
    res.json([
        {title:'scene-1', content: 'Hello!<p>This is an <strong>example</strong> paragraph</p>'},
        {title:'', content: '池のほとりにかえるが住んでいました。かえるは自分の名前があまり好きではありませんでした。「かえるなんて名前より、もっとふさわしい素敵な名前があるはずだよ。」かえるはまいにちそう考えて暮らしていました。'},
        {title:'', content: 'ある朝かえるは思いました。「そうだ、神様にお願いして新しい名前をつけてもらおう。神様ならきっと素敵な名前をつけてくださるはずだよ。」そう思うといてもたってもいられなくなり、かえるは神様のところへ出かけました。'},
        {title:'', content: '半日歩いて神様のところへついたかえるはいいました。「神様、ぼくにはかえるという名前は似合っていません。もっと上等な名前をくださいな。」神様はおっしゃいました。「かえるよ、お前は以前にも同じ願いをしにきたのを忘れたのか。お前が名前をかえるかえるといってばかりなので、とうとうかえるという名前になったのじゃ。」'},
    ]);
});

app.listen(process.env.PORT);
