import * as fs from 'fs';
import { sha256 } from 'js-sha256';

export const fluentConf = fs.readFileSync('./fluentd/fluent.conf','utf8').toString();
export const containersConf = fs.readFileSync('./fluentd/containers.conf','utf8').toString();
export const systemdConf = fs.readFileSync('./fluentd/systemd.conf','utf8').toString();
export const hostConf = fs.readFileSync('./fluentd/host.conf','utf8').toString();
export const confHash = 
    sha256(fluentConf).substring(0,8) + 
    sha256(containersConf).substring(0,8) +
    sha256(systemdConf).substring(0,8) +
    sha256(hostConf).substring(0,8);
