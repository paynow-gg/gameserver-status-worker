export const WORKER_CACHE_HOSTNAME = 'https://srvstatus.paynow.gg';
export const MINECRAFT_CACHE_TTL = 60;

export const MINECRAFT_IP_ADDRESS_REGEX = new RegExp(
	/^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/,
);

export const MINECRAFT_HOSTNAME_REGEX = new RegExp(
	/^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/,
);
