"use strict";

function getYouTubeParams() {
	return fetch("https://www.youtube.com/", {
		redirect: "follow",
		credentials: "include",
	})
	.then(response => response.text())
	.then(text => {
		let index = text.indexOf("config['request-headers']");
		if(index == -1) throw "string not found";
		let start = text.indexOf("{", index);
		if(start == -1) throw "string not found";
		let end = text.indexOf("}", start);
		if(end == -1) throw "string not found";
		
		let requestHeaders = JSON.parse(
			text.substring(start, end + 1)
			.replace(/\'/g, '"')
		);
		
		let headers = new Headers();
		for(let key in requestHeaders)
			headers.append(key, requestHeaders[key]);
		
		index = text.indexOf("XSRF_TOKEN");
		if(index == -1) throw "string not found";
		start = text.lastIndexOf("{", index);
		if(start == -1) throw "string not found";
		end = text.indexOf("}", index);
		if(end == -1) throw "string not found";
		
		
		let config = JSON.parse(
			text.substring(start, end + 1)
			.replace(/\'/g, '"')
		);
		return {headers, config};
	});
}

function getNotificationCount({headers, config}) {
	return fetch('https://www.youtube.com/feed_ajax?action_get_unseen_notification_count=1', {
		credentials: "include",
		headers,
	})
	.then(response => response.json())
	.then(obj => obj.unseen_notification_count);
}

function getNotifications({headers, config}) {
	let body = new URLSearchParams();
	body.append("session_token", config["XSRF_TOKEN"]);
	body.append("action_get_notifications_flyout", "1");
	
	return fetch('https://www.youtube.com/feed_ajax?spf=load', {
		method: 'POST',
		body,
		credentials: "include",
		headers,
	})
	.then(response => response.json())
	.then(obj => obj.body["yt-masthead-notifications-content"])
	.then(parseNotifications);
}

function parseNotifications(text) {
	let node = document.createElement("div");
	node.innerHTML = text;
	
	return [...node.querySelectorAll("li .feed-item-container")].map(node => {
		let unseen = !!node.querySelector(".unread-dot");
		let avatar = node.querySelector(".notification-avatar .yt-thumb img").src;
		let link = node.querySelector(".yt-lockup-title a");
		let title = link.title;
		let url = link.href;
		
		let description = cleanup(node.querySelector(".yt-lockup-byline")).innerHTML;
		let thumbnail = node.querySelector(".notification-thumb .yt-thumb img").src;
		
		return { unseen, avatar, title, url, description, thumbnail };
	});
}

function cleanup(node) {
	while(node.attributes.length)
		node.removeAttribute(node.attributes[0].name);
	
	for(let i = 0; i < node.children.length; i++) {
		if(node.children[i].nodeName == "script") {
			node.removeChild(node.children[i]);
			i--;
		} else {
			cleanup(node.children[i]);
		}
	}
	return node;
}

class Cache {
	constructor(func, timeout = 15*60*1000) {
		this.data = null;
		this.lastUpdate = 0;
		this.func = func;
		this.timeout = timeout;
	}
	
	invalidate() {
		this.data = null;
		this.lastUpdate = 0;
	}
	
	getData() {
		return new Promise((resolve, reject) => {
			if(this.lastUpdate > Date.now() - this.timeout) {
				resolve(this.data);
				return;
			}
			
			Promise.resolve(this.func())
			.then(data => {
				this.data = data;
				this.lastUpdate = Date.now();
				resolve(data);
			})
			.catch(reject);
		});
	}
}


let unseenCount = 0;
let cache;

function setup(data) {
	cache = new Cache(() => getNotifications(data));
	
	setInterval(() => updateBadge(data), 600000);
	updateBadge(data);
	
	browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
		if(request.type == "getNotifications") {
			return cache.getData();
		}
	});
}

function updateBadge(data) {
	getNotificationCount(data)
	.then(count => {
		if(unseenCount != count)
			cache.invalidate();
		unseenCount = count;
		
		if(count == 0) {
			browser.browserAction.setBadgeText({text: ""});
			browser.browserAction.setTitle({title: "YouTube"});
		} else {
			browser.browserAction.setBadgeText({text: "" + count});
			browser.browserAction.setTitle({title: "YouTube: " + count + " unseen notification(s)"});
		}
	});
}

let base = document.head.appendChild(document.createElement("base"));
base.href = "https://youtube.com/";

getYouTubeParams()
.then(setup);


