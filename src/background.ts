"use strict";
/// <reference path="youtube.d.ts"/>


class DataCache<T> {
	private data: T = null;
	private lastUpdate: number = 0;
	private func: () => T | Promise<T>;
	private timeout: number

	constructor(func:() => T | Promise<T>, timeout:number = 15*60*1000) {
		this.func = func;
		this.timeout = timeout;
	}
	
	invalidate() {
		this.data = null;
		this.lastUpdate = 0;
	}
	
	async get(update: boolean = true) {
		if(this.lastUpdate > Date.now() - this.timeout)
			return this.data;
		
		if(this.lastUpdate != 0 && update == false)
			return this.data;
		
		this.data = await Promise.resolve(this.func())
		this.lastUpdate = Date.now();
		
		return this.data;
	}
}


let unseenCount = 0;
let cache = new DataCache<NotificationState>(() => getNotifications());
let params = getYouTubeParams();

// resolve relative links
let base = document.head.appendChild(document.createElement("base"));
base.href = "https://www.youtube.com/";
function resolveUrl(url: string): string {
	let link = document.createElement("a");
	link.href = url;
	return link.href;
}

setInterval(updateBadge, 600000);
updateBadge();

browser.runtime.onMessage.addListener(async (request: any, sender: any) => {
	try {
		return {
			result: await handleMessage(request),
			success: true,
		};
	} catch(error) {
		return {
			error,
			success: false,
		};
	}
});

function handleMessage(request: any): any {
	switch(request.type) {
		case "getNotifications":
			return cache.get(request.update);
		
		case "loadMoreNotifications":
			return loadMoreNotifications(request.loadMoreHref);
		
		case "watchLater":
			return watchLater(request.id, request.remove);
		
		case "markAsVisited":
			return markAsVisited(request.notification);
		
		case "setScrollPosition":
			cache.get(false).then(state => state.scrollTop = request.scrollTop);
			return;
	}
}

async function getYouTubeParams(): Promise<{headers: Headers, config: any}> {
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

async function getNotificationCount(): Promise<number> {
	let {headers} = await params;
	let response = await fetch("https://www.youtube.com/feed_ajax?action_get_unseen_notification_count=1", {
		credentials: "include",
		headers,
	});
	let obj = await response.json();
	return obj.unseen_notification_count;
}

async function getNotifications(): Promise<NotificationState> {
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
	
	unseenCount = 0;
	updateBadge();
	
	if(!("body" in obj))
		throw "not_logged_in";
	
	return parseNotifications(obj.body["yt-masthead-notifications-content"]);
}

async function loadMoreNotifications(loadMoreHref: string): Promise<NotificationState> {
	let {headers} = await params;
	let response = await fetch(loadMoreHref, {
		credentials: "include",
		headers,
	});
	let obj = await response.json();
	let newState = parseNotifications("<ol>" + obj.content_html + "</ol>" + obj.load_more_widget_html);
	let oldState = await cache.get(false);
	oldState.notifications.push(...newState.notifications);
	oldState.loadMoreHref = newState.loadMoreHref;
	return oldState;
}

function parseNotifications(text: string): NotificationState {
	let node = document.createElement("div");
	node.innerHTML = text; // should be safe, as the node is never attached to the DOM
	
	let loadMoreHref = (<HTMLElement>node.querySelector("button.browse-items-load-more-button")).dataset.uixLoadMoreHref;
	loadMoreHref = resolveUrl(loadMoreHref);
	
	let notifications = [...node.querySelectorAll("li .feed-item-container")].map((node: HTMLElement) => {
		let unseen = !!node.querySelector(".unread-dot");
		let img = <HTMLImageElement>node.querySelector(".notification-avatar .yt-thumb img");
		let avatar = (<HTMLElement>img).dataset.thumb || img.src;
		let link = <HTMLAnchorElement>node.querySelector(".yt-lockup-title a");
		let title = link.title;
		let url = link.href;
		let description = cleanup(node.querySelector(".yt-lockup-byline")).innerHTML;
		img = <HTMLImageElement>node.querySelector(".notification-thumb .yt-thumb img");
		let thumbnail = img.dataset.thumb || img.src;
		let {postAction, postData} = node.dataset;
		postAction = resolveUrl(postAction);
		
		return { unseen, avatar, title, url, description, thumbnail, postAction, postData };
	});
	
	return {
		scrollTop: 0,
		loadMoreHref,
		notifications,
	};
}

function cleanup(node: Element): Element {
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

async function watchLater(id: string, remove: boolean = false): Promise<boolean> {
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

async function markAsVisited(notification: YouTubeNotification) {
	let {headers, config} = await params;
	
	let body = new URLSearchParams(notification.postData);
	body.append("session_token", config["XSRF_TOKEN"]);
	
	let response = await fetch(notification.postAction, {
		method: "POST",
		body,
		credentials: "include",
		headers,
	});
	let obj = await response.json();
	
	if(obj && obj["code"] && obj["code"] === "SUCCESS" && obj.data.success) {
		(await cache.get(false)).notifications.forEach(a => {
			if(notification.postAction == a.postAction && notification.postData == a.postData)
				a.unseen = false;
		});
		return;
	};
	throw obj;
}

async function updateBadge(): Promise<void> {
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
		browser.browserAction.setTitle({title: "YouTube: " + count + " unseen notification" + (count==1?"":"s")});
	}
}

