
function DataParser(config){
	this.config = config;
	this.stocks = {};
	this.consumedList = [];
	this.updateTimer = 0;
	this.weight = null;

	/*
	 * {callback:, interval:, data: };
	 */
	this.begin = function() {

		if (this.config.interval > 0) {
			var This = this;
			this.timer = setInterval(function(){
				This.getWeightedTrend();
				This.updateTimer = This.updateTimer + 1;
				This.consumeList(This.config.callback);
			}, this.config.interval * 1000);
			return;
		}

		this.getWeightedTrend();
		this.consumeList(this.config.callback);
	}

	this.consumeList = function(callback) {
		var list = this.config.list;
		var idx = this.consumedList.length;
		if (idx >= list.length) { // all parsed
			this.consumedList = [];
			if (callback) {
				this.config.list = callback('finished');
			}
			return;
		}
		var id = list[idx];
		this.consumedList.push(id);

		// delay the call
		var This = this;
		setTimeout(function(){
			This.parseInfo(id, function(){
				This.consumeList(callback);
				if (callback) {
					callback('one record finished');
				}
			}); // pass function as callback
		}, 100);
	}

	this.parseInfo = function(id, callback) {
		var This = this;
		$.get('https://tw.stock.yahoo.com/q/q?s='+id, function(data){
      var parser = new DOMParser();
      var doc = parser.parseFromString(data, "text/html");
			var ev = $(doc);
			var entry = This.parseHTMLData(doc, null);
			This.stocks[id] = entry;
			if (callback) {
				callback();
			}
		})
		.fail(function() {
			if (callback) {
				callback();
			}
			console.log("error parsing");
		});
	}

	this.getStockName = function(id, callback) {
		var This = this;
		$.get('https://tw.stock.yahoo.com/q/q?s='+id, function(data){
			var ev = $(data);
			var entry = This.parseHTMLData(ev, null);
			if (callback) {
				callback(entry);
			}
		})
		.fail(function() {
			if (callback) {
				callback('error');
			}
			console.log("error parsing");
		});
	}

	this.parseHTMLData = function (data, callback) {
      var stkname = data.querySelector("table:nth-child(10) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(1) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(2) > td:nth-child(1) > a:nth-child(1)").textContent;
	    if (!stkname) {
	        if (callback) callback("error");
	        return;
	    }

      const the_tr_selector = 'table:nth-child(10) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(1) > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(2)';
	    var stock = {};
	    var stkid = parseInt(stkname);
      stkname = stkname.replace(/[0-9]/g, '');
	    var quotes = [];
	    var quoteCells = data.querySelector(the_tr_selector).querySelectorAll('td')
      quoteCells.forEach((ele, i) => {
        if (i == 0) return;
        quotes.push(ele.textContent.trim())
      })
	    quotes.push(stkid);
	    quotes.push(stkname);
	    stock.id = stkid;
	    stock.name = stkname;
	    stock.quotes = quotes;

	    var lis = data.querySelector("div.bd").querySelectorAll('li')
	    var news = [];

	    lis.forEach(li => {
        var a = li.querySelector('a');
        var meta = li.querySelector("span");
        news_item = {
          'href': a.href,
          'text': a.textContent,
          'source': meta.textContent
        };
        news.push(news_item);
	    })
	    stock.news = news;

	    return stock;
	}

	this.parseWeightedValue = function(data) {
		var currentWeighted = $(data.find("div[class$=tbd0]").find("table[class$=o]")[0]).find("td[class$=dx]").text();
		var currentTrend = $(data.find("div[class$=tbd0]").find("table[class$=o]")[0]).find("td[class$=im]").find("i").text();
		return {
			weighted: currentWeighted,
			trend: currentTrend
		};
	};

	this.getWeightedTrend = function(callback){
		var This = this;
		$.get('https://tw.stock.yahoo.com', function(data){
			var ev = $(data);
			This.weight = This.parseWeightedValue(ev);
			if (callback) {
				callback(This.weight);
			}
		})
		.fail(function() {
			if (callback) {
				callback();
			}
		});
	}
}
