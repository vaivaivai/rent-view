// Загружаем модуль http
var http = require('http');
var dot = require('dot');
var fs = require('fs');

var MongoClient = require('mongodb').MongoClient, assert = require('assert');
var myDb;
var collection_docs;
var tmp_text;
var template;
var template_page;

var collection_subways;

var getParameter = function (url, name) {
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return null;
    return decodeURIComponent(results[2].replace(/\+/g, " "));
};

/**
 * will reuse connection if already created
 */
function connect(callback) {
    if (myDb === undefined) {

        MongoClient.connect('mongodb://127.0.0.1:27017/rent-collector', function (err, db) {
            console.info('connect to mongodb');
            if (err) {
                return callback(err)
            };

            myDb = db;
            callback(null, db);
        });
    } else {
        callback(null, myDb);
    }
}

var findDocuments = function (db, filter, filter_order, skip, limit, callback) {
    // Get the documents collection
    var collection = db.collection('note');
    // Find some documents

    collection.find(filter).sort(filter_order).skip(skip).limit(limit).toArray(function (err, docs) {
        assert.equal(err, null);
        // console.log("Found the following records");
        console.log('mongo find');
        collection_docs = docs;
        // console.info(docs);
        //  fs.writeFile('message.txt', JSON.stringify(docs));
        callback(docs);
    });
};

var findDocumentsWithoutLimit = function (db, filter, callback) {
    // Get the documents collection
    var collection = db.collection('note');
    // Find some documents

    collection.find(filter).toArray(function (err, docs) {
        assert.equal(err, null);
        // console.log("Found the following records");
        collection_docs = docs;
        // console.info(docs);
        //  fs.writeFile('message.txt', JSON.stringify(docs));
        callback(docs);
    });
};

var findDocument = function (db, filter, callback) {
    // Get the documents collection
    var collection = db.collection('note');
    // Find some documents

    collection.findOne(filter, function (err, doc) {
        assert.equal(err, null);
        // console.log("Found the following records");
        callback(doc);
    });
};

var findSubways = function (db, callback) {

    var collection = db.collection('subway');

    collection.find({}).toArray(function (err, docs) {

        var _subways = {};
        for (var i = 0, length = docs.length; i < length; i++) {
            _subways[docs[i]._id] = docs[i];
        }

        collection_subways = _subways;
    });
};


var formFilter = function (params) {
    var filter = {
        type: 0
    };

    if (params.price_from || params.price_to) {
        filter['price'] = {};
    }

    if (params.price_from) {
        filter['price']['$gte'] = parseInt(params.price_from)
    }

    if (params.price_to) {
        filter['price']['$lte'] = parseInt(params.price_to)
    }

    if (params.area_from || params.area_to) {
        filter['area'] = {};
    }

    if (params.area_from) {
        filter['area']['$gte'] = parseInt(params.area_from)
    }

    if (params.area_to) {
        filter['area']['$lte'] = parseInt(params.area_to)
    }

    if (params.photo) {
        filter['photos'] = {
            '$not': {'$size': 0}
        };
    }

    if (params.subway && params.subway.length) {

        var subway_ids = [];
        for (var i = 0, length = params.subway.length; i < length; i++) {
            subway_ids.push(parseInt(params.subway[i]));
        }

        filter['subways'] = {
            '$in': subway_ids
        };
    }

    if (params.realty && params.realty === 'room') {
        filter['type'] = 0;
    } else if (params.realty_add.length) {
        var realty_ids = [];
        for (var i = 0, length = params.realty_add.length; i < length; i++) {
            realty_ids.push(parseInt(params.realty_add[i]));
        }
        filter['type'] = {'$in': realty_ids};
    } else {
        filter['type'] = {'$ne': 0};
    }

    return filter;
};


var readFile = function (file, callback) {

    if (tmp_text !== undefined) {
        return callback(tmp_text);
    }

    fs.readFile(file, function (err, data) {
        if (err) {
            return console.error(err);
        }

        callback(data.toString());
    });
};

readFile(__dirname + '/view/main/index.html', function (text) {
    template = dot.template(text);
});

readFile(__dirname + '/view/page/index.html', function (text) {
    template_page = dot.template(text);
});

connect(function (err, db) {
    findSubways(db);
});

var pagination = function(page, total, range)
{
    range = parseInt(range) || 5;
    page = parseInt(page);
    total = parseInt(total);

    if (range % 2 === 0) {
        range++;
    }

    var half = (range - 1) / 2;
    var right = page + half;

    if (right > total) {
        var left = page - (right - total) - half;
    } else {
        var left = page - half;
    }

    if (left <= 0) {
        right += Math.abs(left);
        right++;
        left = 1;
    }

    var numbers = [];
    for (var i = left; i <= right && i <= total; i++) {
        numbers.push(i);
    }

    return numbers;
};


var timestampToDate = function(unix_timestamp)
{
    var months = [
        'января',
        'февраля',
        'марта',
        'апреля',
        'мая',
        'июня',
        'июля',
        'августа',
        'сенятбря',
        'октября',
        'ноября',
        'декабря'
    ];
    var date = new Date(unix_timestamp*1000);

    var hours = date.getHours();

    var minutes = "0" + date.getMinutes();

    var year = date.getFullYear();

    var month = months[date.getMonth()];

    var day = date.getDate();

    return day + ' ' + month + ' ' + (year < 2017 ? year : '') + ' ' + hours + ':' + minutes.substr(-2);
};

var phone_format = function(number)
{
    var str = number.toString();
    return '+7 ' + str[0] + str[1] + str[2] + ' ' + str[3] + str[4] + str[5] + ' ' + str[6] + str[7] + ' ' + str[8] + str[9];
};

var timestampToDatePlural = function(unix_timestamp)
{
    var date_now = new Date();

    var date_publish = new Date(unix_timestamp*1000);

    var diff_time = Math.abs(date_now.getTime() - date_publish.getTime());
    var diff_days = Math.ceil(diff_time / (1000 * 3600 * 24));
    var diff_hours = Math.ceil(diff_time / (1000 * 3600));
    var diff_minutes = Math.ceil(diff_time / 1000);
    var equal_day = date_now.getDate() === date_publish.getDate();

    var phrase = null;
    switch (true) {
        case equal_day && diff_hours === 0 && diff_minutes === 0:
            phrase = 'только что';
            break;
        case equal_day && diff_hours === 0:
            phrase = diff_minutes + ' минут' + plural(diff_minutes, 'у', 'ы', '') + ' назад';
            break;
        case equal_day && diff_hours <= 24:
            phrase = diff_hours + ' час' + plural(diff_hours, '', 'а', 'ов') + ' назад';
            break;
        case diff_hours < 48:
            phrase = 'вчера';
            break;
        default:

            var months = [
                'января',
                'февраля',
                'марта',
                'апреля',
                'мая',
                'июня',
                'июля',
                'августа',
                'сенятбря',
                'октября',
                'ноября',
                'декабря'
            ];

            var hours = date_publish.getHours();

            var minutes = "0" + date_publish.getMinutes();

            var year = date_publish.getFullYear();

            var month = months[date_publish.getMonth()];

            var day = date_publish.getDate();

            phrase = (day < 10 ? "0" + day : day) + ' ' + month + ' ' + (year < 2017 ? year : '') + ' ' + hours + ':' + minutes.substr(-2);
    }

    return phrase;

};

var plural = function(value, end_1, end_2, end_3)
{
    if(value % 10 === 1 && value % 100 !== 11) {
        return end_1;
    } else if(value % 10 >= 2 && value % 10 <= 4 && (value % 100 < 10 || value % 100 >= 20)) {
        return end_2;
    } else {
        return end_3;
    }
};

var number_format = function(number)
{
    if(null === number) {
        return null;
    }
    return number.toString().split( /(?=(?:\d{3})+$)/ ).join(' ');
};


// Создаем web-сервер с обработчиком запросов
var server = http.createServer(function (req, res) {
    // console.log('Начало обработки запроса');
    // Передаем код ответа и http-заголовки
    res.writeHead(200, {
        'Content-Type': 'text/html; charset=UTF-8'
    });

    switch (true) {
        case null !== req.url.match(/\/page\/.*/i):

            connect(function (err, db) {

                var reg = req.url.match(/\/page\/(.*)/i);
                var id = reg[1];

                if (err) {
                    return console.log('mongo db connection error!');
                }

                findDocument(db, {_id: id}, function (doc) {

                    doc['timestamp'] = timestampToDate(doc['timestamp']);
                    doc['price'] = number_format(doc['price']);

                    var phones = doc['contacts']['phones'];
                    var new_phones = [];
                    for(var p = 0, plength = phones.length; p < plength; p++) {
                        new_phones.push(phone_format(phones[p]));
                    }

                    doc['contacts']['phones'] = new_phones;

                    res.end(template_page({
                        item: doc,
                        subways: collection_subways
                    }));
                });
            });

            break;
        default:

            var req_price_from = getParameter(req.url, 'price_from');
            var price_from = null !== req_price_from ? parseInt(req_price_from) : '';

            var req_price_to = getParameter(req.url, 'price_to');
            var price_to = null !== req_price_to ? parseInt(req_price_to) : '';

            var req_area_from = getParameter(req.url, 'area_from');
            var area_from = null !== req_area_from ? parseInt(req_area_from) : '';

            var req_area_to = getParameter(req.url, 'area_to');
            var area_to = null !== req_area_to ? parseInt(req_area_to) : '';

            var req_realty = getParameter(req.url, 'realty');
            var realty = null !== req_realty ? req_realty : 'flat';

            var req_order = getParameter(req.url, 'order');
            var order = null !== req_order ? req_order : 'date';

            var req_photo = getParameter(req.url, 'photo');
            var photo = null !== req_photo ? req_photo : false;

            var req_page = getParameter(req.url, 'page');
            var page = null !== req_page ? req_page : 1;

            var req_realty_add = getParameter(req.url, 'realty_add');
            var realty_add = null !== req_realty_add ? req_realty_add.split(',') : [];

            var req_subway = getParameter(req.url, 'subway');
            var subway = null !== req_subway ? req_subway.split(',') : [];


            connect(function (err, db) {
                if (err) {
                    return console.log('mongo db connection error!');
                }

                var filter = formFilter({
                    price_from: price_from,
                    price_to: price_to,
                    area_from: area_from,
                    area_to: area_to,
                    realty: realty,
                    realty_add: realty_add,
                    subway: subway,
                    photo: photo
                });

                var subway_name = null;
                var subway_names = [];

                for (var i = 0, length = subway.length; i < length; i++) {
                    var subway_id = subway[i];
                    if (typeof collection_subways[subway_id] === 'undefined') {
                        continue;
                    }
                    subway_names.push(collection_subways[subway_id].name);
                }

                switch (subway_names.length) {
                    case 0:
                        subway_name = 'Метро';
                        break;
                    case 1:
                        subway_name = 'м. ' + subway_names[0];
                        break;
                    default:
                        subway_name = 'м. ' + subway_names[0] + ', ...';

                }

                var filter_order = {};

                if (order === 'date') {
                    filter_order['timestamp'] = -1;
                } else {
                    filter_order['price'] = 1;
                }

                var items_on_page = 10;
                var skip = items_on_page * (page - 1);
                var limit = 10;
                findDocuments(db, filter, filter_order, skip, limit, function (docs) {
                    findDocumentsWithoutLimit(db, filter, function (unlimit_docs) {

                        for(var i = 0, length = docs.length; i < length; i++) {
                            var timestamp = docs[i]['timestamp'];
                            var price = docs[i]['price'];

                            docs[i]['timestamp'] = timestampToDatePlural(timestamp);
                            docs[i]['price'] = number_format(price);
                        }

                        res.end(template({
                            req: {
                                price_from: price_from,
                                price_to: price_to,
                                area_from: area_from,
                                area_to: area_to,
                                realty: realty,
                                order: order,
                                realty_add: realty_add,
                                subway: subway,
                                photo: photo,
                                page: page
                            },
                            subway_name: subway_name,
                            items_count: unlimit_docs.length,
                            items: docs,
                            subways: collection_subways,
                            pagination: pagination(page, Math.ceil(unlimit_docs.length / items_on_page))
                        }));
                    });
                });
            });

            break;
    }
});


// Запускаем web-сервер
server.listen(2000, "127.0.0.1", function () {
    console.log('Сервер запущен http://127.0.0.1:2000/');
});