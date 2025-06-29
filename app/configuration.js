/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2022-2025 Toha <tohenk@yahoo.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const fs = require('fs');
const path = require('path');
const Cmd = require('@ntlab/ntlib/cmd');
const Sipd = require('../sipd');

Cmd.addVar('config', 'c', 'Set configuration file', 'filename');
Cmd.addVar('mode', '', 'Processing mode, can be download or upload', 'mode');
Cmd.addVar('url', '', 'Set SIPD url', 'url');
Cmd.addVar('username', 'u', 'Set username', 'username');
Cmd.addVar('password', 'p', 'Set password', 'password');
Cmd.addVar('year', 'y', 'Set year', 'year');
Cmd.addVar('dir', 'd', 'Set input or output directory', 'filename-or-folder');
Cmd.addBool('no-download', '', 'Do not download from SIPD instead use previously downloaded files', false);
Cmd.addBool('clean', '', 'Clean profile directory');
Cmd.addBool('help', '', 'Show program usage', false);

/**
 * Application configuration.
 *
 * @author Toha <tohenk@yahoo.com>
 */
class Configuration {

    defaults = {
        mode: Sipd.DOWNLOAD,
        url: 'https://sipd-ri.kemendagri.go.id',
        year: new Date().getFullYear(),
        username: null,
        password: null,
        dir: null,
        skipDownload: ['no-download', false],
    }

    /**
     * Constructor.
     *
     * @param {string} rootDir Configuration directory
     */
    constructor(rootDir) {
        // read configuration from command line values
        let filename = Cmd.get('config') ? Cmd.get('config') : path.join(rootDir, 'config.json');
        if (fs.existsSync(filename)) {
            Object.assign(this, this.getConfig(filename));
        }
        if (fs.existsSync(filename)) {
            console.log('Configuration loaded from %s', filename);
        }
        if (!this.workdir) {
            this.workdir = rootDir;
        }
        this.checkDefaults();
        if (!this.username || !this.password) {
            console.log('Both username or password must be supplied!');
            return;
        }
        if (this.mode === Sipd.UPLOAD && !this.dir) {
            console.log('No data file to process!');
            return;
        }
        if (this.mode) {
            this.initialize();
        }
    }

    initialize() {
        // load profile
        this.profiles = {};
        let filename = path.join(this.workdir, 'profiles.json');
        if (fs.existsSync(filename)) {
            const profiles = JSON.parse(fs.readFileSync(filename));
            if (profiles.profiles) {
                this.profiles = profiles.profiles;
            }
            if (profiles.active) {
                this.profile = profiles.active;
            }
        }
        this.initialized = true;
    }

    checkDefaults() {
        for (const [k, v] of Object.entries(this.defaults)) {
            const opt = Array.isArray(v) ? v[0] : k;
            const defval = Array.isArray(v) ? v[1] : v;
            // get value from command options
            let value = Cmd.get(opt);
            // fallback to default
            if (value === null) {
                value = defval;
            }
            if (value !== undefined && value !== null) {
                this[k] = value;
            }
        }
    }

    getConfig(filename) {
        let config = JSON.parse(fs.readFileSync(filename));
        if (config.ref) {
            filename = path.join(path.dirname(filename), config.ref);
            if (fs.existsSync(filename)) {
                config = this.getConfig(filename);
            } else {
                throw new Error(`Non existent configuration reference ${config.ref}!`);
            }
        }
        return config;
    }

    applyProfile() {
        let profile = this.profile;
        if (null === profile && Cmd.get('profile')) {
            profile = Cmd.get('profile');
        }
        if (profile && this.profiles[profile]) {
            console.log('Using profile %s', profile);
            const keys = ['timeout', 'wait', 'delay', 'opdelay'];
            for (const key in this.profiles[profile]) {
                if (keys.indexOf(key) < 0) {
                    continue;
                }
                this[key] = this.profiles[profile][key];
            }
        }
        // clean profile
        if (Cmd.get('clean')) {
            const profiledir = path.join(this.workdir, 'profile');
            if (fs.existsSync(profiledir)) {
                fs.rmSync(profiledir, {recursive: true, force: true});
            }
        }
        return this;
    }

    checkDir(defaultDir) {
        if (!this.dir) {
            this.dir = path.join(this.workdir, defaultDir);
        } else if (this.dir.slice(-1) != '/' && this.dir.slice(-1) != '\\') {
            this.dir = fs.realpathSync(path.dirname(this.dir));
        }
    }
}

module.exports = Configuration;
