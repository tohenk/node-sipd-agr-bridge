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

const Cmd = require('@ntlab/ntlib/cmd');
const Configuration = require('./configuration');
const Sipd = require('../sipd');

/**
 * Main application entry point.
 *
 * @author Toha <tohenk@yahoo.com>
 */
class App {

    /**
     * Constructor.
     *
     * @param {string} rootDir Application configuration root directory
     */
    constructor(rootDir) {
        this.rootDir = rootDir;
    }

    initialize() {
        this.config = new Configuration(this.rootDir);
        this.config
            .applyProfile();
        return this.config.initialized;
    }

    startApp() {
        const sipd = new Sipd(this.config);
        switch (this.config.mode) {
            case Sipd.UPLOAD:
                console.log('Processing agr upload, please wait...');
                break;
            case Sipd.DOWNLOAD:
                console.log('Processing agr download, please wait...');
                this.config.checkDir('agr');
                break;
            case Sipd.REFS:
                console.log('Processing references update, please wait...');
                this.config.checkDir('refs');
                break;
        }
        const works = sipd.getWorks();
        if (works) {
            sipd.works(works, {
                callback(next) {
                    setTimeout(() => next(), 500);
                }
            })
            .then(() => {
                sipd.app.showMessage('Information', 'The process has been completed! :)');
                console.log('Done');
            })
            .catch(err => {
                process.exitCode = 2;
                if (err) {
                    console.error(err);
                } else {
                    console.error('Unknown error, aborting!!!');
                }
            });
        } else {
            process.exitCode = 1;
            console.error('Unknown mode %s!!!', this.config.mode);
        }
    }

    run() {
        if (this.initialize()) {
            this.startApp();
            return true;
        }
    }
}

module.exports = App;
