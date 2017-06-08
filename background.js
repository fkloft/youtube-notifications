"use strict";

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
	
	async getData() {
		if(this.lastUpdate > Date.now() - this.timeout)
			return this.data;
		
		this.data = await Promise.resolve(this.func())
		this.lastUpdate = Date.now();
		
		return this.data;
	}
}


let unseenCount = 0;
let cache = new Cache(() => getNotifications());
let params = getYouTubeParams();

let base = document.head.appendChild(document.createElement("base"));
base.href = "https://www.youtube.com/";

setInterval(updateBadge, 600000);
updateBadge();

browser.runtime.onMessage.addListener(async (request, sender) => {
	try {
		return {
			result: await handleMessage(request, sender),
			success: true,
		};
	} catch(error) {
		return {
			error,
			success: false,
		};
	}
});

function handleMessage(request) {
	if(request.type == "getNotifications") {
		return cache.getData();
	} else if(request.type == "loadMoreNotifications") {
		return loadMoreNotifications(request.loadMoreHref);
	} else if(request.type == "watchLater") {
		return watchLater(request.id, request.remove);
	}
}

async function getYouTubeParams() {
	let response = await fetch("https://www.youtube.com/", {
		redirect: "follow",
		credentials: "include",
	});
	let text = await response.text();
	
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
}

async function getNotificationCount() {
	let {headers} = await params;
	let response = await fetch("https://www.youtube.com/feed_ajax?action_get_unseen_notification_count=1", {
		credentials: "include",
		headers,
	});
	let obj = await response.json();
	return obj.unseen_notification_count;
}

async function getNotifications() {
	let {headers, config} = await params;
	
	let body = new URLSearchParams();
	body.append("session_token", config["XSRF_TOKEN"]);
	body.append("action_get_notifications_flyout", "1");
	
	let response = await fetch("https://www.youtube.com/feed_ajax?spf=load", {
		method: "POST",
		body,
		credentials: "include",
		headers,
	});
	let obj = await response.json();
	
	if(!("body" in obj))
		throw "not_logged_in";
	
	return parseNotifications(obj.body["yt-masthead-notifications-content"]);
}

async function loadMoreNotifications(loadMoreHref) {
	let {headers} = await params;
	let response = await fetch(loadMoreHref, {
		credentials: "include",
		headers,
	});
	let obj = await response.json();
	return parseNotifications("<ol>" + obj.content_html + "</ol>" + obj.load_more_widget_html);
}

function parseNotifications(text) {
	let node = document.createElement("div");
	node.innerHTML = text;
	
	let loadMoreHref = node.querySelector("button.browse-items-load-more-button").dataset.uixLoadMoreHref;
	// resolve relative URL (due to base url set to https://youtube.com)
	let link = document.createElement("a");
	link.href = loadMoreHref;
	loadMoreHref = link.href;
	
	let notifications = [...node.querySelectorAll("li .feed-item-container")].map(node => {
		let unseen = !!node.querySelector(".unread-dot");
		let img = node.querySelector(".notification-avatar .yt-thumb img");
		let avatar = img.dataset.thumb || img.src;
		let link = node.querySelector(".yt-lockup-title a");
		let title = link.title;
		let url = link.href;
		let description = cleanup(node.querySelector(".yt-lockup-byline")).innerHTML;
		img = node.querySelector(".notification-thumb .yt-thumb img");
		let thumbnail = img.dataset.thumb || img.src;
		
		return { unseen, avatar, title, url, description, thumbnail };
	});
	
	return {
		loadMoreHref,
		notifications,
	};
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

async function watchLater(id, remove=false) {
	let {headers, config} = await params;
	
	let body = new URLSearchParams();
	body.append("session_token", config["XSRF_TOKEN"]);
	body.append("video_ids", id);
	
	let response = await fetch("https://www.youtube.com/playlist_video_ajax?action_" + (remove ? "delete_from" : "add_to") + "_watch_later_list=1", {
		method: "POST",
		body,
		credentials: "include",
		headers,
	});
	let obj = await response.json();
	
	if(obj && obj["code"] && obj["code"] === "SUCCESS") return !remove;
	throw obj;
}

async function updateBadge() {
	let count = await getNotificationCount();
	
	if(typeof count === "undefined") {
		browser.browserAction.setBadgeText({text: "!"});
		browser.browserAction.setTitle({title: "YouTube: not logged in"});
		return;
	}
	
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
}

