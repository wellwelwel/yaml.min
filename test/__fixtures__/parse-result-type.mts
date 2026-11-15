import { parse, parseAll } from '../../src/index.ts';

type ServerConfig = { port: number };

const readPort = (config: ServerConfig): number => config.port;
const readPorts = (configs: ServerConfig[]): number[] => configs.map(readPort);

readPort(parse<ServerConfig>('port: 80'));
readPorts(parseAll<ServerConfig>('port: 80\n---\nport: 81\n'));

// @ts-expect-error
readPort(parse('port: 80'));

// @ts-expect-error
readPorts(parseAll('port: 80\n---\nport: 81\n'));
