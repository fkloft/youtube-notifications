declare namespace browser {
	namespace browserAction {
		function setBadgeText(details: SetBadgeTextDetails): void;
		function setTitle(details: SetTitleDetails): void;
		
		interface SetBadgeTextDetails extends OptionalTabIdDetails{
			text: string;
		}
		interface SetTitleDetails extends OptionalTabIdDetails{
			title: string;
		}
		
		interface OptionalTabIdDetails {
			tabId?: number;
		}
	}
	
	namespace runtime {
		var onMessage: EventTarget<(message: any, sender: runtime.MessageSender, sendResponse: (result: any) => void) => (boolean | Promise<any>)>;
		
		function sendMessage(message: any): Promise<any>;
		function sendMessage(message: any, options: SendMessageOptions): Promise<any>;
		function sendMessage(extensionId: string|null, message: any): Promise<any>;
		function sendMessage(extensionId: string|null, message: any, options: SendMessageOptions): Promise<any>;
		
		class MessageSender {
			tab?: tabs.Tab;
			frameId?: number;
			id?: string;
			url?: string;
			tlsChannelId?: string;
		}
		
		interface SendMessageOptions {
			includeTlsChannelIdOptional?: boolean;
			toProxyScript?: boolean;
		}
	}
	
	namespace storage {
		var local: StorageArea;
		var sync: StorageArea;
		var managed: StorageArea;
		
		var onChanged: EventTarget<(changes: {[key: string]: StorageChange}, areaName: "local"|"sync"|"managed") => void>;
		
		class StorageArea {
			set(keys: any): Promise<void>;
			get(keys?: any | null): Promise<any>;
			getBytesInUse(keys?: any | null): Promise<number>;
			remove(keys: string | string[]): Promise<void>;
			clear(): Promise<void>;
		}
		
		interface StorageChange {
			oldValue?: any;
			newValue?: any;
		}
	}
	
	namespace tabs {
		function create(createProperties: TabProperties): Promise<tabs.Tab>;
		function query(queryInfo: QueryProperties): Promise<tabs.Tab[]>;
		function update(tabId: number, updateProperties: UpdateProperties): Promise<tabs.Tab>;
		function update(updateProperties: UpdateProperties): Promise<tabs.Tab>;
		
		class Tab implements TabProperties {
			active: boolean;
			audible?: boolean;
			cookieStoreId?: string;
			favIconUrl?: string;
			height?: number;
			highlighted: boolean;
			id?: number;
			incognito: boolean;
			index: number;
			mutedInfo?: tabs.MutedInfo;
			openerTabId?: number;
			pinned: boolean;
			selected: boolean;
			sessionId?: string;
			status?: string;
			title?: string;
			url?: string;
			width?: number;
			windowId: number;
		}
		
		interface TabProperties {
			active?: boolean;
			index?: number;
			pinned?: boolean;
			selected?: boolean;
			windowId?: number;
		}
		
		interface QueryProperties {
			active?: boolean;
			audible?: boolean;
			cookieStoreId?: string;
			currentWindow?: boolean;
			highlighted?: boolean;
			index?: number;
			muted?: boolean;
			lastFocusedWindow?: boolean;
			pinned?: boolean;
			status?: "loading" | "complete";
			title?: string;
			url?: string | string[];
			windowId?: number;
		}
		
		interface UpdateProperties {
			active?: boolean;
			highlighted?: boolean;
			muted?: boolean;
			openerTabId?: number;
			pinned?: boolean;
			selected ?: boolean;
			url?: string;
		}
		
		interface MutedInfo {
			extensionId?: string;
			muted: boolean;
			reason?: "capture" | "extension" | "user";
		}
	}
	
	namespace windows {
		function create(createData: CreateData): Promise<windows.Window>;
		
		class Window {
			focused: boolean;
			height?: number;
			incognito: boolean;
			left?: number;
			state?: "normal" | "minimized" | "maximized" | "fullscreen" | "docked"
			top?: number;
			type?: "normal" | "popup" | "panel" | "detached_panel";
			width?: number;
		}
		
		interface CreateData {
			focused?: boolean;
			height?: number;
			incognito?: boolean;
			left?: number;
			state?: "normal" | "minimized" | "maximized" | "fullscreen" | "docked"
			tabId?: number;
			top?: number;
			type?: "normal" | "popup" | "panel" | "detached_panel";
			url?: string | string[];
			width?: number;
		}
	}
	
	class EventTarget<T> {
		addListener(callback: T): void;
		hasListener(listener:T ): boolean;
		removeListener(listener: T): void;
	}
	interface EventListener {
		(evt: Event): void;
	}
}

