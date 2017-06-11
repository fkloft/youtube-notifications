"use strict";
/// <reference path="web-ext.d.ts"/>
/// <reference path="dom.d.ts"/>
/// <reference path="youtube.d.ts"/>


let list = <HTMLElement>document.querySelector("ol");
let renderedNotifications: YouTubeNotification[] = [];

list.addEventListener("scroll", ev => {
	sendMessage({
		type: "setScrollPosition",
		scrollTop: list.scrollTop,
	});
});

(async () => {
	let prefs = await browser.storage.local.get({
		hide_dupes: true,
		hide_seen: true,
	});
	
	for(let key in prefs) {
		(<HTMLInputElement>document.getElementById(key)).checked = prefs[key];
		if(prefs[key])
			document.body.classList.add(key);
	}
})();

document.querySelector(".options").addEventListener("click", ev => {
	[...document.querySelectorAll(".options input[type='checkbox']")].forEach(async (input: HTMLInputElement) => {
		await browser.storage.local.set({
			[input.id]: input.checked,
		});
		
		if(input.checked)
			document.body.classList.add(input.id);
		else
			document.body.classList.remove(input.id);
	});
});

async function loadNotifications(update: boolean = true) {
	try {
		let data = await sendMessage({
			type: "getNotifications",
			update,
		});
		list.className = "";
		renderNotifications(data);
	} catch(e) {
		if(e === "not_logged_in")
			list.innerHTML = "<li>You must <a href='https://www.youtube.com/feed/subscriptions'>log in</a> to see your notifications.</li>";
		else
			list.innerHTML = "<li>An error has occured, could not load notifications.</li>";
		list.className = "error";
		throw e;
	}
}
loadNotifications();

async function sendMessage(params: any): Promise<any> {
	let data = await browser.runtime.sendMessage(params);
	if(data.success)
		return data.result;
	throw data.error;
}

function renderNotifications(state: NotificationState): void {
	renderedNotifications = [];
	list.innerHTML = "";
	state.notifications.forEach(notification => {
		let item = list.appendChild(document.createElement("li"));
		if(notification.unseen)
			item.className = "unseen notification";
		else
			item.className = "notification";
		
		if(notificationExists(notification))
			item.classList.add("dupe");
		else
			renderedNotifications.push(notification);
		
		let link = item.appendChild(document.createElement("a"));
		link.href = notification.url;
		link.addEventListener("click", ev => {
			if(ev.which != 1) return;
			visit(notification);
		});
		link.addEventListener('visit', ev => visit(notification), false);
		
		let avatar = link.appendChild(document.createElement("img"));
		avatar.className = "avatar";
		avatar.src = notification.avatar;
		
		let content = link.appendChild(document.createElement("div"));
		content.className = "content";
		
		let title = content.appendChild(document.createElement("h1"));
		title.className = "title";
		title.textContent = notification.title;
		
		let desc = content.appendChild(document.createElement("ul"));
		desc.className = "description";
		desc.innerHTML = notification.description; // was sanitized in background.js
		
		let thumb = link.appendChild(document.createElement("div"));
		thumb.className = "thumbnail";
		
		let img = thumb.appendChild(document.createElement("img"));
		img.src = notification.thumbnail;
		
		let toolbar = item.appendChild(document.createElement("div"));
		toolbar.className = "toolbar";
		
		if(notification.unseen) {
			let button = toolbar.appendChild(document.createElement("button"));
			button.title = "Mark as read";
			button.textContent = "Mark as read";
			button.className = "mark-read yt-uix-button yt-uix-button-default";
			button.addEventListener("click", async (ev) => {
				try {
					button.disabled = true;
					await visit(notification);
				} finally {
					button.disabled = false;
				}
			});
		}
		
		if(notification.url.match(/https:\/\/(?:www)?\.youtube\.com\/watch\?(?:[^&]*&)*v=([^&]+)(?:&|#|$)/)) {
			let id = RegExp.$1;
			
			let button = toolbar.appendChild(document.createElement("button"));
			button.title = "Watch later";
			button.textContent = "Watch later";
			button.className = "watch-later yt-uix-button yt-uix-button-default";
			button.addEventListener("click", async (ev) => {
				try {
					button.disabled = true;
					button.classList.remove("error");
					await addToWatchLater(button, id);
				} finally {
					button.disabled = false;
				}
			});
		}
	});
	
	let item = list.appendChild(document.createElement("li"));
	item.className = "load-more";
	
	let button = item.appendChild(document.createElement("button"));
	button.textContent = "Load more";
	button.addEventListener("click", async (ev) => {
		button.disabled = true;
		
		try {
			let data = await sendMessage({
				type: "loadMoreNotifications",
				loadMoreHref: state.loadMoreHref,
			});
			
			renderNotifications(data);
		} catch(e) {
			button.disabled = false;
			throw e;
		}
	});
	
	list.scrollTop = state.scrollTop;
}

async function addToWatchLater(button: HTMLButtonElement, id: string): Promise<void> {
	let remove = button.classList.contains("added");
	
	let added = await sendMessage({
		type: "watchLater",
		id,
		remove,
	});
	
	if(added)
		button.classList.add("added");
	else
		button.classList.remove("added");
}

function notificationExists(a: YouTubeNotification): boolean {
	const keys = ["title", "url", "description"];
	return renderedNotifications.some((b: any) => keys.every(key => (<any>a)[key] === b[key]));
}

function findLink(event: MouseEvent): HTMLAnchorElement | null {
	let element = <Element>event.target;
	do {
		if(element instanceof HTMLAnchorElement)
			return element;
	} while(element = element.parentNode);
	return null;
}

async function visit(notification: YouTubeNotification) {
	await sendMessage({
		type: "markAsVisited",
		notification: notification,
	});
	await loadNotifications(false);
}

document.addEventListener("click", ev => {
	let link = findLink(ev);
	if(!link) return;
	
	if(ev.which > 2) return;
	
	ev.preventDefault();
	
	let properties: any = {
		url: link.href,
	};
	
	link.dispatchEvent(new Event('visit'));
	
	if(ev.which == 2 || ev.ctrlKey) {
		// new tab
		properties.active = !ev.shiftKey; // background if with shift
		browser.tabs.create(properties)
		.then(() => close());
	} else if(ev.shiftKey) {
		// new window
		browser.windows.create(properties)
		.then(() => close());
	} else {
		// current tab or new tab
		browser.tabs.query({
			active: true,
			currentWindow: true,
		})
		.then(tabs => tabs[0].id)
		.then(tabId => browser.tabs.update(tabId, properties))
		.catch(e => browser.tabs.create(properties))
		.then(() => close());
	}
});

