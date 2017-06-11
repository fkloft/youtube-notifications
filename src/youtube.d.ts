interface NotificationState {
	loadMoreHref: string;
	notifications: YouTubeNotification[];
	scrollTop: number;
}
interface YouTubeNotification {
	unseen: boolean;
	url: string;
	avatar: string;
	title: string;
	description: string;
	thumbnail: string;
	postAction: string;
	postData: string;
}

