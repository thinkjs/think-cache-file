/*
* @Author: lushijie
* @Date:   2017-03-16 09:23:41
* @Last Modified by:   lushijie
* @Last Modified time: 2017-03-19 15:08:30
*/
const path = require('path');
const helper = require('think-helper');
const assert = require('assert');
const fs = require('fs');
const debounce = require('think-debounce');
const FileStore = require('think-store-file');
const debounceInst = new debounce();
const readFileFn = helper.promisify(fs.readFile, fs);

/**
 * file cache adapter
 */
class FileCache {
  constructor(config) {
    assert(config.cachePath && helper.isString(config.cachePath), 'config.cachePath must be set');
    this.store = new FileStore(config.cachePath);
    this.timeout = config.timeout;
    this.fileExt = config.fileExt;
    this.cachePath = config.cachePath;
    this.pathDepth = config.pathDepth || 1;
  }

  /**
   * get file path by the cache key
   * @param  {String} key [description]
   * @return {String}     [description]
   */
  _getRelativePath(key) {
    key = helper.md5(key);
    let dir = key.slice(0, this.pathDepth).split('').join(path.sep);
    return path.join(dir, key) + this.fileExt;
  }

  /**
   * get cache content by the cache key
   * @param  {String} key [description]
   * @return {Promise}      [description]
   */
  get(key) {
    let relativePath = this._getRelativePath(key);
    return debounceInst.debounce(relativePath, () => {
      return this.store.get(relativePath).then(content => {
        if(!content) {
          return;
        }
        try{
          content = JSON.parse(content);
          if(Date.now() > content.expire){
            return this.store.delete(relativePath);
          }else{
            return content.content;
          }
        }catch(e){
          return this.store.delete(relativePath);
        }
      }).catch(() => {});
    });
  }

  /**
   * get cache key's content
   * @param {String} key     [description]
   * @param {Mixed} content [description]
   * @return {Promise}      [description]
   */
  set(key, content, timeout = this.timeout) {
    let relativePath = this._getRelativePath(key);
    let tmp = {
      content: content,
      expire: Date.now() + timeout * 1000
    }
    return this.store.set(relativePath, JSON.stringify(tmp)).catch(() => {});
  }

  /**
   * delete cache key
   * @param  {String} key [description]
   * @return {Promise}     [description]
   */
  delete(key) {
    let relativePath = this._getRelativePath(key);
    return this.store.delete(relativePath).catch(() => {});
  }

  /**
   * delete expired key
   * @return {[type]} [description]
   */
  gc() {
    let now = Date.now();
    return helper.getdirFiles(this.cachePath).map(file => {
      let relativePath = path.join(this.cachePath, file);
      return readFileFn(relativePath, 'utf8').then((content) => {
        if(content) {
          try{
            content = JSON.parse(content);
            if(now > content.expire){
              fs.unlink(relativePath, () => {});
            }
          }catch(e){
            fs.unlink(relativePath, () => {});
          }
        }
      })
    })
  }

}

module.exports = FileCache;
