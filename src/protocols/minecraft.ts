// This file is based on https://github.com/PassTheMayo/minecraft-server-util,
// under the MIT License, and adapted for Cloudflare Workers

import { connect } from 'cloudflare:sockets';
import { resolveSrv } from '../helpers/dns';

export interface StatusResult {
	players: {
		online: number;
		max: number;
	};
	favicon?: string;
	error?: string;
}

export async function status(address: string, srv = true) {
	const [hostname, port] = address.split(':');
	const dns = srv ? await resolveSrv(`_minecraft._tcp.${hostname}`) : undefined;

	if (dns) {
		return rawStatus(dns.hostname, dns.port);
	}

	return rawStatus(hostname, port ? Number(port) : 25565);
}

async function rawStatus(hostname: string, port: number) {
	const socket = connect({ hostname, port });
	const writer = socket.writable.getWriter();

	await writer.write(createHandshakePacket(hostname, port));
	await writer.write(createRequestPacket());

	const reader = new SocketReader(socket.readable.getReader());
	await reader.readVarInt();
	const packetType = await reader.readVarInt();

	if (packetType !== 0x00) {
		throw new Error(`Unexpected packet type: ${packetType}`);
	}

	const json = await reader.readStringVarInt();

	await writer.close();
	await socket.close();

	return JSON.parse(json) as StatusResult;
}

function createHandshakePacket(host: string, port: number) {
	// Handshake packet
	// https://wiki.vg/Server_List_Ping#Handshake
	return new SocketWriter().writeVarInt(0x00).writeVarInt(47).writeStringVarInt(host).writeUInt16(port).writeVarInt(1).buffer();
}

function createRequestPacket() {
	// Request packet
	// https://wiki.vg/Server_List_Ping#Request
	return new SocketWriter().writeVarInt(0x00).buffer();
}

class SocketWriter {
	private readonly encoder = new TextEncoder();
	private data = new Uint8Array(0);

	write(byteLength: number, callback: (view: DataView) => void) {
		const buffer = new Uint8Array(byteLength);

		callback(new DataView(buffer.buffer));

		return this.writeBytes(buffer);
	}

	writeBytes(data: Uint8Array) {
		this.data = concatBuffers(this.data, data);

		return this;
	}

	writeUInt16(value: number) {
		return this.write(2, (view) => view.setUint16(0, value));
	}

	writeStringVarInt(value: string) {
		const data = this.encoder.encode(value);

		this.writeVarInt(data.byteLength);
		return this.writeBytes(data);
	}

	writeVarInt(value: number) {
		return this.writeBytes(writeVarInt(value));
	}

	buffer() {
		return concatBuffers(writeVarInt(this.data.byteLength), this.data);
	}
}

class SocketReader {
	private readonly reader: ReadableStreamDefaultReader;
	private readonly decoder = new TextDecoder();
	private buffer = new Uint8Array(0);

	constructor(reader: ReadableStreamDefaultReader) {
		this.reader = reader;
	}

	async readByte(): Promise<number> {
		if (this.buffer.length === 0) {
			await this.readMoreData();
		}

		const byte = this.buffer[0];
		this.buffer = this.buffer.slice(1);
		return byte;
	}

	async readBytes(length: number) {
		while (this.buffer.length < length) {
			await this.readMoreData();
		}

		const result = this.buffer.slice(0, length);
		this.buffer = this.buffer.slice(length);
		return result;
	}

	readVarInt() {
		return readVarInt(() => this.readByte());
	}

	async readString(length: number) {
		const data = await this.readBytes(length);
		return this.decoder.decode(data);
	}

	async readStringVarInt() {
		const length = await this.readVarInt();
		return this.readString(length);
	}

	private async readMoreData() {
		const read = await this.reader.read();

		if (read.done) {
			throw new Error('Connection is closed.');
		}

		// Append new data to existing buffer
		const newBuffer = new Uint8Array(this.buffer.length + read.value.length);
		newBuffer.set(this.buffer);
		newBuffer.set(read.value, this.buffer.length);
		this.buffer = newBuffer;
	}
}

function concatBuffers(a: Uint8Array, b: Uint8Array) {
	const buffer = new Uint8Array(a.length + b.length);
	buffer.set(a, 0);
	buffer.set(b, a.length);
	return buffer;
}

async function readVarInt(readByte: () => Promise<number>): Promise<number> {
	let numRead = 0;
	let result = 0;
	let read: number;

	do {
		read = await readByte();
		result |= (read & 0x7f) << (7 * numRead);

		if (numRead++ > 4) {
			throw new Error('VarInt is too big');
		}
	} while ((read & 0x80) !== 0);

	return result;
}

function writeVarInt(value: number) {
	let buf = new Uint8Array(0);

	do {
		const current = value & 0x7f;

		value >>>= 7;

		const array = new Uint8Array([value !== 0 ? current | 0x80 : current]);

		buf = concatBuffers(buf, array);
	} while (value !== 0);

	return buf;
}
