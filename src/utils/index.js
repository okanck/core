/**
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Salakar
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
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
 *
 */

const { createHash } = require('crypto');
const { sep, join, resolve } = require('path');
const { Logger, transports } = require('winston');
const { existsSync, readFileSync } = require('fs');
const { dateNow, throwError } = require('./aliases');

/**
 * Generates from sha1 sum from an object.
 * @param data
 * @returns {*}
 */
function sha1sum(data) {
  return createHash('sha1')
    .update(JSON.stringify(data))
    .digest('hex');
}

/**
 * Get the current timestamp, but way faster,
 * Caches the timestamp per 50ms or 1000 calls
 * @param date
 * @returns {number}
 */
let _timestamp;
let _ncalls = 0;
function getTimeStamp() {
  if (!_timestamp || ++_ncalls > 1000) {
    _timestamp = dateNow();
    _ncalls = 0;
    setTimeout(() => {
      _timestamp = null;
    }, 50);
  }
  return _timestamp;
}

/**
 * Throttle a function call once per limit ms.
 * @param func
 * @param limit
 * @returns {Function}
 */
function throttle(func, limit) {
  let wait = false;                    // Initially, we're not waiting
  return function _throttle(...args) { // We return a throttled function
    if (!wait) {                       // If we're not waiting
      func.call(this, ...args);        // Execute function
      wait = true;                     // Prevent future invocations
      setTimeout(() => {               // After a period of time
        wait = false;                  // And allow future invocations
      }, limit);
    }
  };
}

/**
 * Deep get a nested property from an object using a dot notation path
 * @param obj
 * @param path
 * @returns {*}
 */
function deepGet(obj, path) {
  let tmpObj = obj;
  path.split('.').forEach((key) => {
    if (!tmpObj || !Object.hasOwnProperty.call(tmpObj, key)) {
      tmpObj = null;
      return;
    }
    tmpObj = tmpObj[key];
  });
  return tmpObj;
}

/**
 * @description Quick implementation of lodash's 'after' function
 * @param {number} n count
 * @param {Function} done  after count condition met callback
 * @returns {Function} After runner
 */
function after(n, done) {
  let times = n;
  return () => {
    times -= 1;
    if (times === 0) return typeof done === 'function' && done();
    return undefined;
  };
}

/**
 * Wrapper to only allow a function to run once
 * @param fn
 * @param context
 * @returns {Function}
 */
function once(fn, context) {
  let called = false;
  return function onceInternal(...args) {
    if (!called) {
      called = true;
      fn.apply(context || this, args);
    }
  };
}

/**
 * Simple is function check
 * @param item
 * @returns {*|boolean}
 */
function isFunction(item) {
  return (item && typeof item === 'function');
}

/**
 * Empty callback filler func.
 */
function noop() {
}

/**
 * Allow promises or callbacks on native es6 promises - no prototyping because ew.
 * @param promise
 * @param callback
 * @returns {*}
 */
const queueThrow = e =>
  setTimeout(() =>
    throwError(e), 0);

function nodify(promise, callback, qt = queueThrow) {
  if (callback) {
    // prevent any callback exceptions getting swallowed by the Promise handlers
    promise.then((v) => {
      try {
        callback(null, v);
      } catch (e) {
        qt(e);
      }
    }).catch((r) => {
      try {
        callback(r);
      } catch (e) {
        qt(e);
      }
    });
  }
  return promise;
}

/**
 * Returns a new instance of winston logger with console transport only.
 * @param {Object} options logging level, defaults to warn
 * @returns {Logger} Winston Logger
 */
function createLogger(options) {
  return new Logger({
    transports: [
      new (transports.Console)(options),
    ],
  });
}

/**
 * Simple is object check.
 * @param item
 * @returns {boolean}
 */
function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item) && item !== null);
}

/**
 * Generate a random integer between two numbers
 * @returns {number}
 * No point testing a random number generator as tests cannot be deterministic.
 */
/* istanbul ignore next */
function randomInt() {
  /* eslint no-bitwise:0 */
  return Math.floor(Math.random() * 0x100000000 | 0).toString(16);
}

/**
 * Deep merge two objects.
 * @param target
 * @param source
 */
function mergeDeep(target, source) {
  if (isObject(target) && isObject(source)) {
    /* eslint no-restricted-syntax: 0 */
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }
  return target;
}

function arrayChunks(array, chunkSize) {
  const results = [];
  for (let i = 0, len = array.length; i < len; i += chunkSize) {
    results.push(array.slice(i, i + chunkSize));
  }
  return results;
}

/**
 *
 * @param string
 * @returns {*}
 */
function tryJSONParse(string) {
  try {
    return JSON.parse(string);
  } catch (jsonError) {
    return string;
  }
}

/**
 *
 * @param data
 * @returns {*}
 */
function tryJSONStringify(data) {
  try {
    return JSON.stringify(data);
  } catch (jsonError) {
    return undefined;
  }
}

/**
 * Find package.json files.
 *
 * @param {String} root The root directory we should look in.
 * @returns {Object} Iterator interface.
 * @api public
 */
function loadPackageJSON(root = process.cwd()) {
  if (root === sep) {
    return undefined;
  }

  const file = join(root, 'package.json');

  if (existsSync(file)) {
    return tryJSONParse(readFileSync(file));
  }

  // try go up one and look for a package.json
  // mainly for projects that compile to a sub folder in the project root.
  const fileUp = join(resolve(root, './../'), 'package.json');

  if (existsSync(fileUp)) {
    return tryJSONParse(readFileSync(fileUp));
  }

  return undefined;
}

module.exports = {
  loadPackageJSON,
  tryJSONStringify,
  tryJSONParse,
  arrayChunks,
  mergeDeep,
  randomInt,
  isObject,
  createLogger,
  queueThrow,
  nodify,
  noop,
  isFunction,
  once,
  after,
  deepGet,
  throttle,
  getTimeStamp,
  sha1sum,
};
