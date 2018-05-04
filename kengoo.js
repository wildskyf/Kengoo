var KL = {};
KL.KENGOO = {};
KL.KENGOO.POPUP = {};
KL.KENGOO.BACKGROUND = {};
KL.KENGOO.OPTION = {};

/*
 * Utility
 */

var Utility = {
	config: {
		loadSetting: async function(){
		  var { config } = await browser.storage.sync.get('config');

			if (!config) {
			  var config = JSON.stringify({
          "2330": {
            "name": "台積電",
            "notify": { "volume":0, "price":0 }
          },
          "2498": {
            "name":"宏達電",
            "notify":{}
          }
        });
        await browser.storage.sync.set({config});

        return JSON.parse(config);
			}
      else {
        return JSON.parse(config);
      }

		},
		saveSetting: function(setting){
		  browser.storage.sync.set({
        config: JSON.stringify(setting)
		  });
		},
		setReminder: async function(stkid, type, operand, value){
			var c = await Utility.config.loadSetting();
			c[stkid]['notify'][type] = operand * value;
			Utility.config.saveSetting(c);
		},
		getList: async function(){
			var currentConfig = await Utility.config.loadSetting();
			var clist = [];
			$.each(currentConfig, function(key, value){
				clist.push(key);
			});
			return clist;
		},
		composeTooltip: function(name, price, change) {
			var len = 5 - name.length;
			for (var i = 0; i < len; ++i){
				name += "  ";
			}
			price = price + '';
			len = 7 - price.length;
			for (var i = 0; i < len; i++){
				price += ' ';
			}
			change = change + '';
			len = 7 - change.length;
			for (var i = 0; i < len; i ++){
				change + ' ';
			}
			return name + "\t" + price + "\t" + change;
		}
	},
	validate: {
		acceptableCode: [8, 46, 37, 39, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 190],
		isNumber: function(n) {
			return !isNaN(parseFloat(n)) && isFinite(n);
		},
		isNumericKeyCode: function(keyCode){
			console.log(keyCode);
			// back, delete, number-pad
			for (idx in Utility.validate.acceptableCode){
				if (keyCode == Utility.validate.acceptableCode[idx]){
					return ture;
				}
			}

			if(!Utility.validate.isNumber(String.fromCharCode(keyCode))){
				return false;
			}
			return true;
		}
	},
	chrome: {
		updateBadge: function(weight) {
			if (weight) {
				chrome.browserAction.setBadgeText({text:weight.weighted + ''});
				chrome.browserAction.setBadgeBackgroundColor({color: (weight.trend == '跌')? [131, 158, 76, 255] : [189, 40, 60, 255]});
			}
		},
		updateTooltip: function(parser) {
			var tooltip = "";

			$.each(parser.config.list, function(i, v){
				if (!parser.stocks[v]) {
					return;
				}

				var formalized = Utility.config.composeTooltip(parser.stocks[v].name, parser.stocks[v].quotes[1], parser.stocks[v].quotes[4]);
				tooltip += formalized + "\n";
				//tooltip += (parser.stocks[v].name + "\t" + parser.stocks[v].quotes[1] + "\t" + parser.stocks[v].quotes[4] + "\n");
			});
			chrome.browserAction.setTitle({title:tooltip});
		},
		showNotify: function(icon, title, message) {
			var notification =  webkitNotifications.createNotification(
				icon,  // icon url - can be relative
				title,  // notification title
				message  // notification body text
			);
			notification.ondisplay = function(){
				setTimeout(function(){
					notification.cancel()
				}, 15000);
			};
			notification.show();
		}
	}
};

/*
 * Widget for popup
 */
KL.KENGOO.POPUP.StockList = function(renderTo) {
	this.base = $('<table cellspacing="0" cellpadding="0">');
	this.rows = {};
	this.columns = ['id', 'time', 'now', 'buy', 'sell', 'diff', 'volume', 'yesterday', 'open', 'dayhigh', 'daylow'];
	this.header = [	chrome.i18n.getMessage('Name'),
					chrome.i18n.getMessage('Time'),
					chrome.i18n.getMessage('Last_Price'),
					chrome.i18n.getMessage('Buy'),
					chrome.i18n.getMessage('Sell'),
					chrome.i18n.getMessage('Change'),
					chrome.i18n.getMessage('Volume'),
					chrome.i18n.getMessage('Last_Day'),
					chrome.i18n.getMessage('Open'),
					chrome.i18n.getMessage('High'),
					chrome.i18n.getMessage('Low')];

	renderTo.append(this.base);
	this.createCells = function(row, cells, append) {
		row.cells = {};
		$.each(cells.id, function(idx, v){
			var id = v;
			var value = cells.value[idx];
			row.cells[id] = $('<td id="'+id+'">');
			row.cells[id].html(value);
			if (append) {
				row.append(row.cells[id]);
			}
		});
	}

	this.initPanel = function() {
		var tr = this.rows['header'] = $('<tr id="header">');
		this.createCells(tr, {id: this.columns, value:this.header}, true);
		this.base.append(tr);
	}

	this.addStock = function(record) {
		var tr = null;
		var newRow = false;
		if (this.rows[record.id]) {
			tr = this.rows[record.id];
		}else{
			tr = this.rows[record.id] = $('<tr style="cursor:pointer;">');
			newRow = true;

			tr.click(function(){
				window.open("https://tw.stock.yahoo.com/q/bc?s="+record.id);
			});
		}

		var percentage = Math.round(10000 * ((record.quotes[1] - record.quotes[6]) / record.quotes[6]))/100;

		var value = [record.id + '<br>' + record.name];
		for (var i = 0; i <= 9; ++i) {
			value.push(record.quotes[i]);
		}
		value[5] += ("<br>" + percentage + '%');
		this.createCells(tr, {id: this.columns, 'value':value}, newRow);

		// set news as title for tooltip
		var news = "";
		for (var x in record.news) {
			news += record.news[x].text + "\n";
		}
		tr.attr('title', news);

		// Mark color for price trend
		tr.cells['diff'].removeClass('red');
		tr.cells['diff'].removeClass('green');
		if (parseFloat(record.quotes[1]) >= parseFloat(record.quotes[6])){
			tr.cells['diff'].addClass('red');
		}
		else{
			tr.cells['diff'].addClass('green');
		}

		if (newRow) {
			this.base.append(tr);
		}
	}

	this.renderList = async function(){
		var bkg = chrome.extension.getBackgroundPage();
		// console.log(bkg);
		// console.log(bkg._background);
		/*
		$.each(bkg.parser.config.list, function(i, v){
			if (!bkg.parser.stocks[v]) {
				return;
			}
			window.stockPanel.addStock(bkg.parser.stocks[v]);
		});

		Utility.chrome.updateTooltip(bkg.parser);*/

		if (!window.parser){
			return;
		}
    (await window.parser.config.list).forEach(async (v,i) => {
      if (!window.parser.stocks[v]) {
        return;
      }
      await window.stockPanel.addStock(window.parser.stocks[v]);
    })

		Utility.chrome.updateTooltip(window.parser);
	}

	this.initPanel();
}

/*
 * Stock config widget
 */
KL.KENGOO.OPTION.StockConfigList = function(renderTo){
	this.base = $('<table cellspacing="0" cellpadding="0">');
	this.rows = {};
	renderTo.append(this.base);

	this.initPanel = function() {
		var tr = this.rows['header'] = $('<tr>');

		this.createCells(tr, [
              {
                id: 'id',
                value: chrome.i18n.getMessage('Name')
							}, {
								id: 'volume',
								value: chrome.i18n.getMessage('Volume_Remind')
							}, {
								id: 'price',
								value: chrome.i18n.getMessage('Price_Remind')
							}, {
								id: 'delete',
								value: chrome.i18n.getMessage('Delete')
							}], true);

		this.base.append(tr);
	}

	this.updateNotify = function(id, type) {
		var a = $("select#"+type+"_"+id+" option:selected").val();
		var b = $("input#"+type+"_input_"+id).val();
		Utility.config.setReminder(id, type, (a == 'lower')? -1 : 1, b);
	}

	this.createNotifyControl = async function(cell, type, record) {
		var co = await Utility.config.loadSetting();
		cell.operator = $('<select id="'+type+'_'+record.id+'">');
		cell.append(cell.operator);
		cell.operator.append($('<option value="lower">').text(chrome.i18n.getMessage('LowerThan')));
		cell.operator.append($('<option value="larger">').text(chrome.i18n.getMessage('LargerThan')));

		if (!co[record.id].notify) {
			co[record.id].notify = {};
		}

		var op = (!co[record.id].notify)? 0 : (co[record.id].notify[type]? ((co[record.id].notify[type] > 0)? 1 : 0) : 0);
		cell.operator[0].selectedIndex = op;

		cell.value = $('<input id="'+type+'_input_'+record.id+'" class="'+type+'_input">');
		cell.value.attr('value', co[record.id].notify[type]? Math.abs(co[record.id].notify[type]) : '');
		cell.append(cell.value);
		var This = this;
		cell.operator.change(function(){
			This.updateNotify(record.id, type);
		});
		cell.value.bind('keydown', function(e){
			return Utility.validate.isNumericKeyCode(e.keyCode);
		});
		cell.value.bind('blur', function(e){
			This.updateNotify(record.id, type);
		});
	}

	this.createCells = function(row, cells, append) {
		row.cells = {};
		$.each(cells, function(i, v){
			row.cells[v.id] = $('<td id="'+v.id+'">');
			row.cells[v.id].html(v.value);

			if (append) {
				row.append(row.cells[v.id]);
			}
		});
	}

	this.addStock = async function(record) {
		var tr = null;
		var newRow = false;
		if (this.rows[record.id]) {
			tr = this.rows[record.id];
		}else{
			tr = this.rows[record.id] = $('<tr>');
			tr.attr('stkid', record.id);
			newRow = true;
		}

		this.createCells(tr, [
		                {
		                	id: 'id',
		                	value: record.id + '<br>' + record.name
						}, {
							id: 'volume',
							value: ' '
						}, {
							id: 'price',
							value: ' '
						}, {
							id: 'delete',
							value: chrome.i18n.getMessage('Delete')
						}], newRow);

		await this.createNotifyControl(tr.cells['volume'], 'volume', record);
		await this.createNotifyControl(tr.cells['price'], 'price', record);

		// delete record handler
		var This = this;
		tr.cells['delete'].bind('click', function(){
      Utility.config.loadSetting().then( currentConfig => {
        delete currentConfig[record.id];
        Utility.config.saveSetting(currentConfig);
        delete This.rows[record.id];
        tr.remove();
      })
		});

		if (newRow) {
			this.base.append(tr);
		}
	}

	this.showStocks = function(config) {
		$.each(config, function(key, value){
			window._stockConfig.addStock({
				'id': key,
				'name': value.name,
				'notify': value.notify
			});
		});
	}

	this.addStockToStorage = async function() {
		var config = await Utility.config.loadSetting();

		var count = 0;
		for (x in config) {
			if (count++ >= 64) {
				alert(chrome.i18n.getMessage('Error_AddStockUpperBound'));
				window._stockConfig.showStocks(config);
				return false;
			}
		}

		config[$('input[id=stk_id]').val()] = {
			id: $('input[id=stk_id]').val(),
			name: $('span[id=stk_name]').text(),
			notify: {}
		};
		Utility.config.saveSetting(config);
		window._stockConfig.showStocks(config);
	}

	this.initPanel();
}

KL.KENGOO.OPTION.InputPanel = function(){
	var stkid = $('input[id=stk_id]');
	this.tskid = stkid;
	$('td[class=stock_code]').html(chrome.i18n.getMessage('symbol'));
	$('input[id=stk_id]').keyup(function(event){
		if ($('input[id=stk_id]').val().length < 4) {
			return;
		}

		if (event.keyCode == '13') {
			return window._stockConfig.addStockToStorage();
		}

		window.parser.getStockName($('input[id=stk_id]').val(), function(info){
			if (!info) {
				return;
			}
			$('span[id=stk_name]').html(info.name);
		});
	});
	$('button[id=stk_add]').html(chrome.i18n.getMessage('Add'));
	$('button[id=stk_add]').bind('click', function(){
		window._stockConfig.addStockToStorage();
	});
}

KL.KENGOO.BACKGROUND.NotifyChecker = function(){
	this.interval = 150 * 1000; // 150sec
	this.timer = null;
	var This = this;

	this.initTimer = function() {
		this.timer = window.setInterval(this.intervalHandler, this.interval);
	}

	this.intervalHandler = function() {
		This.checkPrice(window.parser);
		This.checkVolume(window.parser);
	}

	this.checkPrice = async function(parser) {
		var setting = await Utility.config.loadSetting();
		var msg = "";
		for (var key in setting) {
			if (!setting[key].notify.price) {
				continue;
			}

			if (!parser.stocks[key]) {
				continue;
			}
			if (setting[key].notify.price < 0 && Math.abs(setting[key].notify.price) >= parser.stocks[key].quotes[1]) {
				msg += (setting[key].name + '(' + key + ') '+ parser.stocks[key].quotes[1] + ' ' + chrome.i18n.getMessage('Message_Price_Lower_Than')+' ' + Math.abs(setting[key].notify.price));
				setting[key].notify.price = 0;
				Utility.config.saveSetting(setting);
			}
			if (setting[key].notify.price > 0 && Math.abs(setting[key].notify.price) <= parser.stocks[key].quotes[1]) {
				msg += (setting[key].name + '(' + key + ') '+ parser.stocks[key].quotes[1] + ' ' + chrome.i18n.getMessage('Message_Price_Higher_Than')+' ' + Math.abs(setting[key].notify.price));
				setting[key].notify.price = 0;
				Utility.config.saveSetting(setting);
			}
		}

		if (!msg) {
			return;
		}
		Utility.chrome.showNotify('', chrome.i18n.getMessage('PriceVolume_Remind'), msg);
		return msg;
	}

	this.checkVolume = async function(parser) {
		var setting = await Utility.config.loadSetting();
		var msg = "";
		for (key in setting) {
			if (!setting[key].notify.price) {
				continue;
			}

			if (!parser.stocks[key]) {
				continue;
			}
			if (setting[key].notify.volume > 0 && Math.abs(setting[key].notify.volume) <= parseInt(parser.stocks[key].quotes[5])) {
				msg += (setting[key].name + '(' + key + ') '+ parser.stocks[key].quotes[5] + ' ' + chrome.i18n.getMessage('Message_Volume_Higher_Than')+' ' + Math.abs(setting[key].notify.volume));
				setting[key].notify.volume = 0;
				Utility.config.saveSetting(setting);
			}
		}

		if (!msg) {
			return;
		}
		Utility.chrome.showNotify('', chrome.i18n.getMessage('PriceVolume_Remind'), msg);
		return msg;
	}

	this.initTimer();
}

KL.KENGOO.OPTION.init = async function() {
	$("div[id=logo]").html(chrome.i18n.getMessage("extName"));
	window.parser = new DataParser({});
	// create option page UI widget
	window._stockConfig = new KL.KENGOO.OPTION.StockConfigList($("div[id=description]"));
	var currentConfig = await Utility.config.loadSetting();
	window._stockConfig.showStocks(currentConfig);
	window._inputPanel = new KL.KENGOO.OPTION.InputPanel();
}

KL.KENGOO.BACKGROUND.init = function() {
	var config = {
			list: Utility.config.getList(),
			interval: 120, // 2mins
			callback: function(state) {
				Utility.chrome.updateTooltip(window.parser);
				Utility.chrome.updateBadge(window.parser.weight);
				return Utility.config.getList();
			}
		};

	window.parser = new DataParser(config);
	window.parser.begin();
	window.notifyChecker = new KL.KENGOO.BACKGROUND.NotifyChecker();
}

KL.KENGOO.POPUP.init = async function() {
	window.stockPanel = new KL.KENGOO.POPUP.StockList($('body'));
	await window.stockPanel.renderList();
	var config = {
			list: await Utility.config.getList(),
			interval:  0,
			callback: async function(state) {
				await window.stockPanel.renderList();
				Utility.chrome.updateBadge(window.parser.weight);
				return await Utility.config.getList();
			}
		};

	window.parser = new DataParser(config);
	await window.stockPanel.renderList();
	window.parser.begin();
}

/*
 * Global init function to dispatch handler
 */
$(document).ready(function() {
	if (window._options) {
		return KL.KENGOO.OPTION.init();
	} else if (window._background) {
		return KL.KENGOO.BACKGROUND.init();
	} else {
		return KL.KENGOO.POPUP.init();
	}
});
