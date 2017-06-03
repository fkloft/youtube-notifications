"use strict";

let list = document.querySelector("ol");

(async () => {
	try {
		let data = await browser.runtime.sendMessage({
			type: "getNotifications",
		});
		list.innerHTML = "";
		list.className = "";
		renderNotifications(data);
	} catch(e) {
		list.innerHTML = "<li>An error has occured, could not load notifications.</li>";
		list.className = "error";
		throw e;
	}
})();

function renderNotifications({loadMoreHref, notifications}) {
	notifications.forEach(notification => {
		let item = list.appendChild(document.createElement("li"));
		if(notification.unseen)
			item.className = "unseen notification";
		else
			item.className = "notification";
		
		let link = item.appendChild(document.createElement("a"));
		link.href = notification.url;
		
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
		desc.innerHTML = notification.description;
		
		let thumb = link.appendChild(document.createElement("div"));
		thumb.className = "thumbnail";
		
		let img = thumb.appendChild(document.createElement("img"));
		img.src = notification.thumbnail;
	});
	
	let item = list.appendChild(document.createElement("li"));
	item.className = "load-more";
	
	let button = item.appendChild(document.createElement("button"));
	button.textContent = "Load more";
	button.addEventListener("click", async ev => {
		button.disabled = true;
		
		try {
			let data = await browser.runtime.sendMessage({
				type: "loadMoreNotifications",
				loadMoreHref,
			});
			
			item.parentNode.removeChild(item);
			renderNotifications(data);
		} catch(e) {
			button.disabled = false;
			throw e;
		}
	});
}

function findLink(event) {
	let element = event.target;
	do {
		if(element.nodeName.toLowerCase() == "a")
			return element;
	} while(element = element.parentNode);
	return null;
}

document.addEventListener("click", ev => {
	let link = findLink(ev);
	if(!link) return;
	
	if(ev.which > 2) return;
	
	ev.preventDefault();
	
	let properties = {
		url: link.href,
	};
	
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

