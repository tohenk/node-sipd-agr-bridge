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

const WebRobot = require('@ntlab/webrobot');
const Queue = require('@ntlab/work/queue');
const SipdApp = require('./modules/app');
const SipdSubkeg = require('./modules/subkeg');
const SipdRefs = require('./modules/refs');
const { By, error } = require('selenium-webdriver');
const debug = require('debug')('sipdagr:core');

class Sipd extends WebRobot {

    WAIT_GONE = 1
    WAIT_PRESENCE = 2

    initialize() {
        this.delay = this.options.delay || 500;
        this.opdelay = this.options.opdelay || 400;
        this.provinsi = this.options.provinsi;
        this.username = this.options.username;
        this.password = this.options.password;
        this.unit = this.options.unit;
        this.year = this.options.year || (new Date()).getFullYear();
        this.app = new SipdApp(this);
        this.subkeg = new SipdSubkeg(this);
        this.refs = new SipdRefs(this);
        super.constructor.expectErr(error.StaleElementReferenceError);
    }

    getWorks() {
        const works = this.getCommonWorks();
        switch (this.options.mode) {
            case Sipd.UPLOAD:
                break;
            case Sipd.DOWNLOAD:
                works.push([w => this.subkeg.download(this.options.dir, this.options.keg, this.options.skipDownload)]);
                break;
            case Sipd.REFS:
                works.push([w => this.refs.download(this.options.dir, this.options.skipDownload)]);
                break;
        }
        return works;
    }

    getCommonWorks() {
        const works = [];
        const mode = this.options.mode;
        if (mode === Sipd.DOWNLOAD || mode === Sipd.REFS) {
            if (!this.options.skipDownload) {
                const code =
                    'd2luZG93LmdldENvZGUgPSBmdW5jdGlvbigpIHsKICAgIGlmIChBcnJheS5pc0FycmF5KHdpbmRvdy5' +
                    'yZXRfbm9kZXMpKSB7CiAgICAgICAgZm9yIChjb25zdCBub2RlIG9mIHdpbmRvdy5yZXRfbm9kZXMpIH' +
                    'sKICAgICAgICAgICAgaWYgKG5vZGUubm9kZU5hbWUgPT09ICdOR1gtQ0FQVENIQScgJiYgQXJyYXkua' +
                    'XNBcnJheShub2RlLl9fbmdDb250ZXh0X18pKSB7CiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IG8g' +
                    'b2Ygbm9kZS5fX25nQ29udGV4dF9fKSB7CiAgICAgICAgICAgICAgICAgICAgaWYgKG8gJiYgby5jYXB' +
                    '0Y2hTZXJ2aWNlICYmIG8uY29kZSkgewogICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gby5jb2' +
                    'RlOwogICAgICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgI' +
                    'GJyZWFrOwogICAgICAgICAgICB9CiAgICAgICAgfQogICAgfQp9';
                works.push(
                    [w => this.getDriver().sendDevToolsCommand('Page.addScriptToEvaluateOnNewDocument', {
                        source: `
                            addEventListener('load', e => {
                                if (XMLHttpRequest.prototype._send === undefined) {
                                    XMLHttpRequest.prototype._send = XMLHttpRequest.prototype.send;
                                    XMLHttpRequest.prototype.send = function(...args) {
                                        if (window.apis === undefined) {
                                            window.apis = {};
                                        }
                                        const uri = this.__zone_symbol__xhrURL.substr(window.location.origin.length);
                                        if (uri.startsWith('/api/')) {
                                            this.addEventListener('readystatechange', e => {
                                                const xhr = e.target;
                                                if (xhr.readyState === XMLHttpRequest.DONE) {
                                                    if (!window.apis[uri]) {
                                                        window.apis[uri] = [xhr.status, xhr.responseText];
                                                    }
                                                }
                                            });
                                        }
                                        this._send.apply(this, args);
                                    }
                                }
                            });
                            window.getApiResponse = function(path) {
                                return window.apis ? window.apis[path] : null;
                            }
                            ${Buffer.from(code, '\x62\x61\x73\x65\x36\x34').toString()}
                            `
                    })],
                    [w => this.open()],
                    [w => this.app.login()],
                    [w => this.app.setYear()],
                );
            } else {
                works.push([w => Promise.resolve(console.log('Skipping download...'))]);
            }
        }
        return works;
    }

    waitForResponse(uri, options = {}) {
        options = options || {};
        return new Promise((resolve, reject) => {
            const responses = {};
            const t = Date.now();
            const uris = Array.isArray(uri) ? uri : [uri];
            const unobfuscate = payload => {
                let res;
                const data = JSON.parse(payload);
                if (data.data) {
                    if (options.encoded) {
                        const b64dec = s => {
                            return Buffer.from(s, 'base64').toString();
                        }
                        const rev = s => {
                            return s.split('').reduce((acc, char) => char + acc, '');
                        }
                        res = JSON.parse(rev(b64dec(rev(b64dec(data.data)))));
                    } else {
                        res = data.data;
                    }
                }
                return res;
            }
            const f = () => {
                const q = new Queue([...uris], uri => {
                    this.works([
                        [w => this.getDriver().getCurrentUrl(), w => options.referer],
                        [w => Promise.reject(`Unexpected referer ${w.getRes(0)}!`), w => options.referer && options.referer !== w.getRes(0)],
                        [w => this.getDriver().executeScript('return getApiResponse(arguments[0])', uri)],
                    ])
                    .then(result => {
                        if (result && Array.isArray(result)) {
                            const [code, res] = result;
                            // is it aborted?
                            if (code === 0) {
                                reject(`Aborted: ${uri}!`);
                            } else if (code >= 200 && code < 400) {
                                responses[uri] = unobfuscate(res);
                            } else if (code >= 400) {
                                reject(`Status code for ${uri} is ${code}!`);
                            }
                        }
                        q.next();
                    })
                    .catch(err => reject(err));
                });
                q.once('done', () => {
                    if (Object.keys(responses).length === uris.length) {
                        const res = [];
                        for (const k of uris) {
                            res.push(responses[k]);
                        }
                        resolve(Array.isArray(uri) ? res : res[0]);
                    } else {
                        const pending = uris.filter(uri => !responses[uri]);
                        if (options.timeout > 0 && Date.now() - t > options.timeout) {
                            reject(`Wait response timed-out for ${pending}!`);
                        } else {
                            debug('Still waiting response for', pending);
                            setTimeout(f, 100);
                        }
                    }
                });
            }
            f();
        });
    }

    waitForPresence(data, options = {}) {
        options = options || {};
        if (options.time === undefined) {
            options.time = this.wait;
        }
        if (options.mode === undefined) {
            options.mode = this.WAIT_GONE;
        }
        return new Promise((resolve, reject) => {
            let el, presence = false;
            let target;
            if (data.data instanceof By) {
                target = data.data.value;
            } else if (data instanceof By) {
                target = data.value;
            } else {
                target = data;
            }
            const t = Date.now();
            const f = () => {
                this.works([
                    [w => this.isStale(data.el), w => data.el],
                    [w => this.findElements(data), w => !w.getRes(0)],
                    [w => new Promise((resolve, reject) => {
                        let wait = true;
                        if (options.mode === this.WAIT_GONE && presence && w.res.length === 0) {
                            debug(`element ${target} now is gone`);
                            el = w.res[0];
                            wait = false;
                        }
                        if (options.mode === this.WAIT_PRESENCE && !presence && w.res.length === 1) {
                            debug(`element ${target} now is presence`);
                            el = w.res[0];
                            wait = false;
                        }
                        if (w.res.length === 1 && !presence) {
                            presence = true;
                        }
                        // is timed out
                        if (options.time > 0 && !presence && Date.now() - t > options.time) {
                            wait = false;
                        }
                        resolve(wait);
                    }), w => !w.getRes(0)],
                    [w => Promise.resolve(false), w => w.getRes(0)],
                ])
                .then(result => {
                    if (result) {
                        debug(`still waiting ${target} to be ${options.mode === this.WAIT_GONE ? 'gone' : 'presence'}`);
                        setTimeout(f, 50);
                    } else {
                        resolve(el);
                    }
                })
                .catch(err => {
                    if (err instanceof error.StaleElementReferenceError) {
                        debug(`stale on ${target}, resolving instead`);
                        resolve(el);
                    } else {
                        reject(err);
                    }
                });
            }
            f();
        });
    }

    scrollTo(top) {
        return this.getDriver().executeScript(`window.scrollTo(0, ${top});`);
    }

    static get UPLOAD() {
        return 'upload';
    }

    static get DOWNLOAD() {
        return 'download';
    }

    static get REFS() {
        return 'refs';
    }
}

module.exports = Sipd;